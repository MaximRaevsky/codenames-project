/**
 * AI AGENTS - OpenAI Implementation
 * ==================================
 * 
 * Real LLM-powered agents for CoName using OpenAI API.
 * 
 * Agents:
 * - Partner Spymaster: Gives clues when user is guesser
 * - Partner Guesser: Guesses when user is spymaster  
 * - Rival Team: Both spymaster and guesser for opponent
 * - Validator: Checks clue legality
 */

import { callAgent, parseAgentJson } from './openai-client';
import {
  buildSpymasterSystemPrompt,
  buildSpymasterUserPrompt,
  buildGuesserSystemPrompt,
  buildGuesserUserPrompt,
  buildRivalSpymasterSystemPrompt,
  buildRivalGuesserSystemPrompt,
} from './prompt-builders';
import {
  BoardState,
  UserProfile,
  SpymasterResponse,
  GuesserResponse,
  TurnEvent,
  Team,
  ValidationResult,
} from '../types/game';

// ============================================
// RESPONSE INTERFACES
// ============================================

interface AgentSpymasterResponse {
  clue: string;
  number: number;
  reasoning?: string;
  targetWords?: string[];
  wordsToAvoid?: string[];
}

interface AgentGuesserResponse {
  guesses: string[];
  confidence?: number[];
  reasoning?: string;
  shouldContinue?: boolean;
}

interface AgentValidationResponse {
  valid: boolean;
  reason?: string;
  violation?: string;
}

// ============================================
// PARTNER SPYMASTER AGENT
// ============================================

/**
 * AI Spymaster for the user's team (when user is Guesser)
 * Personalized based on user profile
 * Will keep retrying until a valid clue is generated (no max attempts)
 */
export async function aiSpymaster(
  board: BoardState,
  team: Team,
  profile?: UserProfile,
  turnHistory: TurnEvent[] = []
): Promise<SpymasterResponse> {
  
  // Get all board words for validation
  const allBoardWords = board.cards.filter(c => !c.revealed).map(c => c.word);

  let rejectedClues: { clue: string; reason: string }[] = [];
  let attempt = 0;

  // Keep trying until we get a valid clue
  while (true) {
    attempt++;
    
    const systemPrompt = buildSpymasterSystemPrompt(team, true, profile);
    let userPrompt = buildSpymasterUserPrompt(board, team, turnHistory);
    
    // Add rejected clues WITH REASONS to the prompt
    if (rejectedClues.length > 0) {
      userPrompt += `\n\n⚠️ REJECTED CLUES - DO NOT USE THESE OR SIMILAR:\n${rejectedClues.map(r => `- "${r.clue}" was INVALID because: ${r.reason}`).join('\n')}\n\nPick a COMPLETELY DIFFERENT word that doesn't violate these same rules!`;
    }

    const response = await callAgent(systemPrompt, userPrompt, {
      temperature: Math.min(1.0 + (attempt - 1) * 0.1, 1.3), // Higher temp for more creative clues
      maxTokens: 4096,
      jsonMode: true,
    });

    const parsed = parseAgentJson<AgentSpymasterResponse>(response);

    // Validate the response format
    if (!parsed.clue || typeof parsed.number !== 'number') {
      console.error('❌ [AI SPYMASTER] Invalid response format, retrying...');
      continue;
    }

    const clueCandidate = parsed.clue.toUpperCase().trim();
    
    // VALIDATE THE CLUE using AI validation
    
    const validation = await validateClueWithAI(clueCandidate, allBoardWords);
    
    if (!validation.valid) {
      console.warn(`⚠️ [AI SPYMASTER] Clue "${clueCandidate}" is INVALID: ${validation.reason}`);
      rejectedClues.push({ clue: clueCandidate, reason: validation.reason || 'Unknown reason' });
      continue;
    }

    // Valid clue found!
    const finalTargetWords = (parsed as unknown as { targetWords?: string[] }).targetWords || [];
    
    // REQUIRE target words - if missing, reject and retry
    if (finalTargetWords.length === 0) {
      console.warn('⚠️ [AI SPYMASTER] No targetWords in response! Clue is INVALID without targets.');
      rejectedClues.push({ 
        clue: clueCandidate, 
        reason: 'You MUST include "targetWords" array listing the EXACT words you\'re targeting. Example: "targetWords": ["WORD1", "WORD2"]' 
      });
      continue;
    }
    
    // Validate that targetWords actually exist on the board as team words
    const teamWords = board.cards.filter(c => c.category === team && !c.revealed).map(c => c.word);
    const invalidTargets = finalTargetWords.filter(w => !teamWords.includes(w.toUpperCase()));
    if (invalidTargets.length > 0) {
      console.warn(`⚠️ [AI SPYMASTER] Invalid targetWords: ${invalidTargets.join(', ')} - not on board or already revealed`);
      rejectedClues.push({ 
        clue: clueCandidate, 
        reason: `targetWords must be UNREVEALED team words. Invalid: ${invalidTargets.join(', ')}. Valid team words: ${teamWords.join(', ')}` 
      });
      continue;
    }
    
    const result = {
      clue: clueCandidate,
      number: Math.max(1, parsed.number),
      reasoning: parsed.reasoning,
      targetWords: finalTargetWords.map(w => w.toUpperCase()), // Normalize to uppercase
    };


    return result;
  }
}

// ============================================
// PARTNER GUESSER AGENT
// ============================================

/**
 * AI Guesser for the user's team (when user is Spymaster)
 * Uses PERSISTENT WORD CONFIDENCE tracking across all turns
 */
export async function aiGuesser(
  clue: string,
  clueNumber: number,
  board: BoardState,
  team: Team,
  profile?: UserProfile,
  turnHistory: TurnEvent[] = [],
  currentGuesses: string[] = []
): Promise<GuesserResponse> {
  
  const isAvoidanceClue = clueNumber === 0;
  const unrevealedWords = board.cards.filter(c => !c.revealed).map(c => c.word);
  const teamHistory = turnHistory.filter(t => t.team === team);
  const rivalHistory = turnHistory.filter(t => t.team !== team);
  const currentTurnNumber = teamHistory.length + 1;
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: BUILD PERSISTENT WORD CONFIDENCE MAP FROM ALL PREVIOUS TURNS
  // ═══════════════════════════════════════════════════════════════════════
  
  // Initialize confidence map for all unrevealed words
  const wordConfidenceMap: Map<string, { 
    confidence: number; 
    fromClue: string; 
    fromTurn: number;
  }> = new Map();
  
  // Initialize all words at 0%
  unrevealedWords.forEach(word => {
    wordConfidenceMap.set(word.toUpperCase(), { 
      confidence: 0, 
      fromClue: '', 
      fromTurn: 0
    });
  });
  
  // Process each of OUR TEAM's previous turns (chronologically)
  // Use STORED GUESSER CONFIDENCES from each turn (not just intended targets)
  
  for (let i = 0; i < teamHistory.length; i++) {
    const turn = teamHistory[i];
    const turnNumber = i + 1;
    const turnsAgo = currentTurnNumber - turnNumber;
    const decayMultiplier = Math.pow(0.9, turnsAgo);
    
    
    // Use stored guesser confidence evaluations from this turn (if available)
    if (turn.guesserWordConfidences && turn.guesserWordConfidences.length > 0) {
      
      turn.guesserWordConfidences.forEach(wc => {
        const wordUpper = wc.word.toUpperCase();
        
        // Skip if word is no longer on board (was revealed)
        if (!unrevealedWords.map(w => w.toUpperCase()).includes(wordUpper)) {
          return;
        }
        
        // Apply decay to stored confidence
        const decayedConfidence = Math.round(wc.confidence * decayMultiplier);
        
        // Only update if this gives higher confidence
        const existing = wordConfidenceMap.get(wordUpper);
        if (!existing || decayedConfidence > existing.confidence) {
          wordConfidenceMap.set(wordUpper, {
            confidence: decayedConfidence,
            fromClue: turn.clue,
            fromTurn: turnNumber
          });
        }
      });
    } else {
      // Fallback: use intended targets if no stored confidences
      if (turn.intendedTargets && turn.intendedTargets.length > 0) {
        turn.intendedTargets.forEach((targetWord: string) => {
          const wordUpper = targetWord.toUpperCase();
          const wasGuessedCorrectly = turn.guessResults.some(
            r => r.word.toUpperCase() === wordUpper && r.correct
          );
          
          if (!wasGuessedCorrectly && unrevealedWords.map(w => w.toUpperCase()).includes(wordUpper)) {
            const baseConfidence = 90;
            const decayedConfidence = Math.round(baseConfidence * decayMultiplier);
            
            const existing = wordConfidenceMap.get(wordUpper);
            if (!existing || decayedConfidence > existing.confidence) {
              wordConfidenceMap.set(wordUpper, {
                confidence: decayedConfidence,
                fromClue: turn.clue,
                fromTurn: turnNumber
              });
            }
          }
        });
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: PROCESS RIVAL TURNS - ZERO OUT WORDS THAT MATCH RIVAL CLUES
  // ═══════════════════════════════════════════════════════════════════════
  
  // Note: We don't use rival's intended targets - that would be cheating!
  // The AI guesser only knows about revealed cards (visible to all players)
  if (rivalHistory.length > 0) {
  } else {
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: LOG CURRENT CONFIDENCE STATE (BEFORE CURRENT CLUE)
  // ═══════════════════════════════════════════════════════════════════════

  try {
    const systemPrompt = buildGuesserSystemPrompt(team, true, profile);
    const userPrompt = buildGuesserUserPrompt(
      clue,
      clueNumber,
      board,
      team,
      turnHistory,
      currentGuesses
    );

    const response = await callAgent(systemPrompt, userPrompt, {
      temperature: 0.6,
      maxTokens: 4096,
      jsonMode: true,
    });

    const parsed = parseAgentJson<AgentGuesserResponse>(response);
    
    // Log ALL word confidences for tracking
    const allWordConfidences = (parsed as unknown as { allWordConfidences?: { word: string; confidence: number }[] }).allWordConfidences;
    if (allWordConfidences && Array.isArray(allWordConfidences) && allWordConfidences.length > 0) {
      
      // ═══════════════════════════════════════════════════════════════════════
      // MERGE: Take HIGHER of current clue confidence vs stored confidence
      // ═══════════════════════════════════════════════════════════════════════
      
      const mergedConfidences: { word: string; confidence: number; source: string; fromClue: string }[] = [];
      
      allWordConfidences.forEach(w => {
        const wordUpper = w.word.toUpperCase();
        const currentConf = w.confidence;
        const stored = wordConfidenceMap.get(wordUpper);
        const storedConf = stored?.confidence || 0;
        const storedClue = stored?.fromClue || '';
        
        let finalConf: number;
        let source: string;
        let fromClue: string;
        
        if (storedConf > currentConf) {
          // Stored is higher - use it
          finalConf = storedConf;
          source = 'stored';
          fromClue = storedClue;
        } else if (currentConf > storedConf && currentConf > 0) {
          // Current is higher - use it
          finalConf = currentConf;
          source = 'current';
          fromClue = clue;
          if (storedConf > 0) {
          }
        } else {
          // Equal or both low - use current
          finalConf = currentConf;
          source = 'current';
          fromClue = clue;
        }
        
        mergedConfidences.push({ word: w.word, confidence: finalConf, source, fromClue });
      });
      
      
      // Sort by MERGED confidence descending
      const sorted = [...mergedConfidences].sort((a, b) => b.confidence - a.confidence);
      
      // ═══════════════════════════════════════════════════════════════════════
      // BUILD GUESSES FROM allWordConfidences (don't trust AI's guesses array!)
      // The AI sometimes picks wrong words even when it evaluated correctly.
      // ═══════════════════════════════════════════════════════════════════════
      
      // Filter to valid unrevealed words only
      const validBoardWords = board.cards
        .filter(c => !c.revealed)
        .map(c => c.word.toUpperCase());
      
      // Filter and sort by confidence (only unrevealed words not already guessed this turn)
      const sortedValidWords = sorted
        .filter(w => validBoardWords.includes(w.word.toUpperCase()) && !currentGuesses.includes(w.word.toUpperCase()));
      
      // Select top words based on clue number (with minimum confidence threshold)
      const MINIMUM_CONFIDENCE = 10; // Don't guess words below 10%
      const maxGuesses = clueNumber === -1 || clueNumber === 0 ? sortedValidWords.length : clueNumber + 1; // +1 for leftover rule
      
      const selectedFromConfidence = sortedValidWords
        .filter(w => w.confidence >= MINIMUM_CONFIDENCE)
        .slice(0, maxGuesses);
      
      // ═══════════════════════════════════════════════════════════════════════
      // AVOIDANCE CLUE (0) HANDLING: ZERO OUT related words, keep unrelated
      // ═══════════════════════════════════════════════════════════════════════
      if (isAvoidanceClue) {
        
        const safeToGuess: { word: string; existingConf: number; relatedness: number; fromClue: string }[] = [];
        const zeroedOut: { word: string; existingConf: number; relatedness: number }[] = [];
        
        // Build a map of AI's RAW relatedness assessment for each word
        // IMPORTANT: Use the AI's ORIGINAL response (allWordConfidences), NOT the merged values!
        // For avoidance clues, we need "how related is this word to the clue word"
        const relatednessMap = new Map<string, number>();
        
        // Use allWordConfidences (the RAW AI response) not sorted (which is merged)
        allWordConfidences.forEach(w => {
          relatednessMap.set(w.word.toUpperCase(), w.confidence);
        });
        
        const relatednessEntries = Array.from(relatednessMap.entries()).sort((a, b) => b[1] - a[1]);
        relatednessEntries.slice(0, 10).forEach(([word, rel]) => {
          const bar = '█'.repeat(Math.floor(rel / 10)) + '░'.repeat(10 - Math.floor(rel / 10));
        });
        
        // Build updated confidence map for ALL unrevealed words
        const finalConfidenceMap: { word: string; confidence: number }[] = [];
        const RELATEDNESS_THRESHOLD = 30; // If 30%+ related to avoidance clue, it's dangerous
        
        // Process ALL unrevealed words, not just those in AI response
        unrevealedWords.forEach(word => {
          const wordUpper = word.toUpperCase();
          const relatedness = relatednessMap.get(wordUpper) || 0;
          const existingData = wordConfidenceMap.get(wordUpper);
          const existingConf = existingData?.confidence || 0;
          const fromClue = existingData?.fromClue || '';
          
          // If word is RELATED to avoidance clue, mark it dangerous (but don't "zero" permanently)
          if (relatedness >= RELATEDNESS_THRESHOLD) {
            zeroedOut.push({ word, existingConf, relatedness });
            finalConfidenceMap.push({ word: wordUpper, confidence: 0 });
          } else if (existingConf > 0) {
            // SAFE - not related to avoidance clue AND has existing confidence
            safeToGuess.push({ word, existingConf, relatedness, fromClue });
            finalConfidenceMap.push({ word: wordUpper, confidence: existingConf });
          } else {
            // No existing confidence and not highly related - keep at 0
            finalConfidenceMap.push({ word: wordUpper, confidence: 0 });
          }
        });
        
        
        if (safeToGuess.length > 0) {
          safeToGuess.sort((a, b) => b.existingConf - a.existingConf);
          safeToGuess.forEach((w, i) => {
          });
        } else {
        }
        
        // Log the final confidence state that will be saved
        finalConfidenceMap
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 10)
          .forEach((w, i) => {
            const marker = w.confidence > 0 ? '✅' : '❓';
            const bar = '█'.repeat(Math.floor(w.confidence / 10)) + '░'.repeat(10 - Math.floor(w.confidence / 10));
          });
        
        // Return with ALL word confidences for storage (including zeroed ones)
        return {
          guesses: safeToGuess.length > 0 ? safeToGuess.map(w => w.word) : [],
          reasoning: safeToGuess.length > 0 
            ? `The clue '${clue}' with number 0 is a warning - I'm avoiding words related to it (${zeroedOut.map(w => w.word).join(', ')}). Instead, I'm guessing ${safeToGuess.map(w => `'${w.word}' from the previous clue '${w.fromClue}'`).join(', ')}.`
            : `The clue '${clue}' with number 0 is a warning - I'm avoiding ${zeroedOut.length} related words. No other confident guesses available from previous clues.`,
          allWordConfidences: finalConfidenceMap.map(w => ({ word: w.word, confidence: w.confidence }))
        };
      }
    
    // ═══════════════════════════════════════════════════════════════════════
    // USE CONFIDENCE-BASED GUESSES (built from allWordConfidences above)
    // This replaces the old logic that trusted AI's guesses array
    // ═══════════════════════════════════════════════════════════════════════
    
    // Extended format for guess details
    interface GuessDetail {
      word: string;
      confidence: number;
      rawConfidence: number;
      source: 'current' | 'previous';
      fromClue?: string;
      turnsAgo?: number;
    }
    
    // Build confidence-based guesses from sorted confidences
    let guessesWithDetails: GuessDetail[] = selectedFromConfidence.map(w => ({
      word: w.word.toUpperCase(),
      confidence: w.confidence,
      rawConfidence: w.confidence,
      source: (w.source === 'stored' ? 'previous' : 'current') as 'current' | 'previous',
      fromClue: w.fromClue,
      turnsAgo: w.source === 'stored' ? 1 : undefined
    }));
    
    // ═══════════════════════════════════════════════════════════════════════
    // CALCULATE "OPEN MISTAKES" - clueNumber minus correct guesses
    // +1 rule ONLY applies if there are open mistakes to catch up on!
    // ═══════════════════════════════════════════════════════════════════════
    
    let openMistakes = 0;
    
    if (teamHistory.length === 0) {
    } else {
      teamHistory.forEach((turn, i) => {
        const expected = turn.clueNumber;
        if (expected <= 0) return; // Skip avoidance/unlimited clues
        
        // Simple: clueNumber - correct guesses = missed words
        const correctCount = turn.guessResults.filter(r => r.correct).length;
        const missed = Math.max(0, expected - correctCount);
        
        if (missed > 0) {
          openMistakes += missed;
        } else {
        }
      });
      
      if (openMistakes > 0) {
      } else {
      }
    }
    
    // Filter to only valid unrevealed words
    const validWords = board.cards
      .filter(c => !c.revealed)
      .map(c => c.word.toUpperCase());

    const validGuesses = guessesWithDetails
      .filter(g => validWords.includes(g.word.toUpperCase().trim()) && !currentGuesses.includes(g.word.toUpperCase().trim()))
      .map(g => ({ 
        word: g.word.toUpperCase().trim(), 
        confidence: g.confidence,
        rawConfidence: g.rawConfidence,
        source: g.source,
        fromClue: g.fromClue,
        turnsAgo: g.turnsAgo
      }));
    
    // +1 ONLY if there are open mistakes from previous turns!
    const canUse_PlusOne = openMistakes > 0;
    const maxGuessesAllowed = clueNumber === -1 || clueNumber === 0 
      ? validGuesses.length 
      : canUse_PlusOne ? clueNumber + 1 : clueNumber; // +1 ONLY if open mistakes exist
    
    const finalGuesses = validGuesses
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxGuessesAllowed);
    
    finalGuesses.forEach((g, i) => {
      const bar = '█'.repeat(Math.floor(g.confidence / 10)) + '░'.repeat(10 - Math.floor(g.confidence / 10));
      const sourceInfo = g.source === 'previous' ? ` ← LEFTOVER from "${g.fromClue}"` : '';
      const isPlusOne = i >= clueNumber && canUse_PlusOne;
      const marker = isPlusOne ? '➕' : '🎯';
    });
    
    if (finalGuesses.length === 0) {
    }
    
    // Track which are from current vs previous for logging
    const finalCurrentClue = finalGuesses.filter(g => g.source === 'current');
    const finalLeftover = finalGuesses.filter(g => g.source === 'previous');
    
    // Build COMPLETE allWordConfidences for persistent storage
    const aiResponseConfidences = (parsed as unknown as { allWordConfidences?: { word: string; confidence: number }[] }).allWordConfidences || [];
    const completedConfidenceMap = new Map<string, number>();
    
    // Start with AI's response confidences
    aiResponseConfidences.forEach(w => {
      completedConfidenceMap.set(w.word.toUpperCase(), w.confidence);
    });
    
    // Add stored confidences for words not in AI response (taking higher of stored vs current)
    wordConfidenceMap.forEach((data, word) => {
      if (!completedConfidenceMap.has(word)) {
        completedConfidenceMap.set(word, data.confidence);
      } else if (data.confidence > (completedConfidenceMap.get(word) || 0)) {
        completedConfidenceMap.set(word, data.confidence);
      }
    });
    
    const finalAllWordConfidences = Array.from(completedConfidenceMap.entries()).map(([word, confidence]) => ({
      word,
      confidence
    }));
    
    // Log the complete confidence map being saved
    const sortedForSave = [...finalAllWordConfidences].sort((a, b) => b.confidence - a.confidence);
    sortedForSave.slice(0, 10).forEach((w, i) => {
      const marker = w.confidence >= 50 ? '✅' : (w.confidence > 0 ? '⚠️' : '❓');
      const bar = '█'.repeat(Math.floor(w.confidence / 10)) + '░'.repeat(10 - Math.floor(w.confidence / 10));
    });
    if (sortedForSave.length > 10) {
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // BUILD HUMAN-READABLE REASONING based on what we ACTUALLY chose
    // ═══════════════════════════════════════════════════════════════════════
    const currentClueGuessesForReasoning = finalGuesses.filter(g => g.source === 'current');
    const leftoverGuessesForReasoning = finalGuesses.filter(g => g.source === 'previous');
    
    // Get word explanations from AI response (if available)
    const wordExplanations = (parsed as unknown as { wordExplanations?: Record<string, string> }).wordExplanations || {};
    
    let accurateReasoning = '';
    
    // Explain current clue guesses with semantic reasoning (no percentages)
    if (currentClueGuessesForReasoning.length > 0) {
      const guessExplanations = currentClueGuessesForReasoning.map(g => {
        const explanation = wordExplanations[g.word] || wordExplanations[g.word.toUpperCase()] || wordExplanations[g.word.toLowerCase()];
        if (explanation) {
          return `'${g.word}' because ${explanation.toLowerCase().replace(/^because\s*/i, '')}`;
        }
        return `'${g.word}'`;
      });
      
      if (guessExplanations.length === 1) {
        accurateReasoning += `For the clue '${clue}', I chose ${guessExplanations[0]}.`;
      } else {
        accurateReasoning += `For the clue '${clue}', I chose ${guessExplanations.join('; ')}.`;
      }
    }
    
    // Only mention +1 rule if it was actually used
    if (leftoverGuessesForReasoning.length > 0) {
      const leftover = leftoverGuessesForReasoning[0];
      const leftoverExplanation = wordExplanations[leftover.word] || wordExplanations[leftover.word.toUpperCase()] || wordExplanations[leftover.word.toLowerCase()];
      if (leftoverExplanation) {
        accurateReasoning += ` I also guessed '${leftover.word}' using the +1 rule - it was related to the previous clue '${leftover.fromClue}'.`;
      } else {
        accurateReasoning += ` I also guessed '${leftover.word}' using the +1 rule from the previous clue '${leftover.fromClue}'.`;
      }
    }
    // Don't mention +1 rule if not used - keep the summary clean
    
    const result = {
      guesses: finalGuesses.map(g => g.word),
      reasoning: accurateReasoning,
      allWordConfidences: finalAllWordConfidences, // Complete map for persistent tracking
      wordExplanations: wordExplanations, // Store for building reasoning based on actual guesses
    };

    if (finalGuesses.length > 0) {
      finalGuesses.forEach((g, i) => {
        if (g.source === 'previous') {
          const decayCalc = `AI: ${g.rawConfidence}% × 0.9^${g.turnsAgo || 1} = ${g.confidence}%`;
        } else {
        }
      });
      
      // +1 Rule analysis
      
      if (finalLeftover.length > 0) {
        const leftover = finalLeftover[0];
        const decayCalc = `${leftover.rawConfidence}% × 0.9^${leftover.turnsAgo || 1} = ${leftover.confidence}%`;
      } else {
      }
    } else {
    }

    return result;
    }
    
    // AI MUST return allWordConfidences - if it didn't, throw error to retry
    console.error('❌ [AI GUESSER] AI did not return allWordConfidences! This should not happen.');
    console.error('   Parsed response:', JSON.stringify(parsed, null, 2));
    throw new Error('AI guesser did not return allWordConfidences - required for tracking');
  } catch (error) {
    console.error('❌ [AI GUESSER] Error:', error);
    throw error; // Let the caller handle it
  }
}

// ============================================
// RIVAL TEAM AGENT
// ============================================

export interface RivalTurnResult {
  clue: string;
  number: number;
  guesses: string[];
  reasoning?: string;
  intendedTargets?: string[];
  guesserWordConfidences?: { word: string; confidence: number }[];
}

/**
 * Complete AI turn for the rival team
 * Generates clue and then guesses
 * Will keep retrying until valid clue is generated (no max attempts)
 */
export async function rivalTurn(
  board: BoardState,
  team: Team,
  turnHistory: TurnEvent[] = []
): Promise<RivalTurnResult> {
  
  // Get all board words for validation
  const allBoardWords = board.cards.filter(c => !c.revealed).map(c => c.word);
  
  // Get rival's words for clue generation
  const rivalWords = board.cards.filter(c => c.category === team && !c.revealed).map(c => c.word);
  
  // Step 1: Generate clue as spymaster (keep trying until valid)
  
  let clue = '';
  let number = 0;
  let clueReasoning = '';
  let rejectedClues: { clue: string; reason: string }[] = [];
  let attempt = 0;
  
  while (!clue) {
    attempt++;
    
    const spymasterSystemPrompt = buildRivalSpymasterSystemPrompt(team);
    let spymasterUserPrompt = buildSpymasterUserPrompt(board, team, turnHistory);
    
    // Add rejected clues WITH REASONS to the prompt
    if (rejectedClues.length > 0) {
      spymasterUserPrompt += `\n\n⚠️ REJECTED CLUES - DO NOT USE THESE OR SIMILAR:\n${rejectedClues.map(r => `- "${r.clue}" was INVALID because: ${r.reason}`).join('\n')}\n\nPick a COMPLETELY DIFFERENT word that doesn't violate these same rules!`;
    }

    const clueResponse = await callAgent(spymasterSystemPrompt, spymasterUserPrompt, {
      temperature: Math.min(0.8 + (attempt - 1) * 0.1, 1.2),
      maxTokens: 4096,
      jsonMode: true,
    });

    const clueData = parseAgentJson<AgentSpymasterResponse>(clueResponse);

    if (!clueData.clue || typeof clueData.number !== 'number') {
      console.error('❌ [RIVAL TURN] Invalid clue response format, retrying...');
      continue;
    }

    const clueCandidate = clueData.clue.toUpperCase().trim();
    
    // VALIDATE THE CLUE using AI validation
    const validation = await validateClueWithAI(clueCandidate, allBoardWords);
    
    if (!validation.valid) {
      console.warn(`⚠️ [RIVAL TURN] Clue "${clueCandidate}" is INVALID: ${validation.reason}`);
      rejectedClues.push({ clue: clueCandidate, reason: validation.reason || 'Unknown reason' });
      continue;
    }
    
    // Valid clue found!
    clue = clueCandidate;
    number = Math.max(1, clueData.number);
    clueReasoning = clueData.reasoning || 'No reasoning provided';
  }


  // ═══════════════════════════════════════════════════════════════════════
  // RIVAL GUESSER: BUILD PERSISTENT CONFIDENCE MAP (same logic as partner)
  // ═══════════════════════════════════════════════════════════════════════
  
  const unrevealedWords = board.cards.filter(c => !c.revealed).map(c => c.word);
  const rivalTeamHistory = turnHistory.filter(t => t.team === team);
  const userTeamHistory = turnHistory.filter(t => t.team !== team);
  const rivalCurrentTurn = rivalTeamHistory.length + 1;
  
  // Initialize confidence map for rival
  const rivalConfidenceMap: Map<string, {
    confidence: number;
    fromClue: string;
    fromTurn: number;
    isZeroedByOpponent: boolean;
  }> = new Map();
  
  unrevealedWords.forEach(word => {
    rivalConfidenceMap.set(word.toUpperCase(), {
      confidence: 0,
      fromClue: '',
      fromTurn: 0,
      isZeroedByOpponent: false
    });
  });
  
  // Process RIVAL's previous turns
  for (let i = 0; i < rivalTeamHistory.length; i++) {
    const turn = rivalTeamHistory[i];
    const turnNumber = i + 1;
    const turnsAgo = rivalCurrentTurn - turnNumber;
    const decayMultiplier = Math.pow(0.9, turnsAgo);
    
    
    if (turn.guesserWordConfidences && turn.guesserWordConfidences.length > 0) {
      turn.guesserWordConfidences.forEach(wc => {
        const wordUpper = wc.word.toUpperCase();
        if (!unrevealedWords.map(w => w.toUpperCase()).includes(wordUpper)) return;
        
        const decayedConfidence = Math.round(wc.confidence * decayMultiplier);
        const existing = rivalConfidenceMap.get(wordUpper);
        if (!existing || decayedConfidence > existing.confidence) {
          rivalConfidenceMap.set(wordUpper, {
            confidence: decayedConfidence,
            fromClue: turn.clue,
            fromTurn: turnNumber,
            isZeroedByOpponent: false
          });
        }
      });
    }
  }
  
  // Process USER's turns - zero out words that match user's clues
  userTeamHistory.forEach(userTurn => {
    if (userTurn.intendedTargets) {
      userTurn.intendedTargets.forEach(targetWord => {
        const wordUpper = targetWord.toUpperCase();
        if (rivalConfidenceMap.has(wordUpper)) {
          const existing = rivalConfidenceMap.get(wordUpper)!;
          rivalConfidenceMap.set(wordUpper, {
            ...existing,
            confidence: 0,
            isZeroedByOpponent: true
          });
        }
      });
    }
  });
  
  // Log rival's confidence state
  const sortedRivalConf = Array.from(rivalConfidenceMap.entries())
    .sort((a, b) => b[1].confidence - a[1].confidence);
  sortedRivalConf.slice(0, 10).forEach(([word, data], i) => {
    const bar = '█'.repeat(Math.floor(data.confidence / 10)) + '░'.repeat(10 - Math.floor(data.confidence / 10));
    const source = data.fromClue ? ` (from "${data.fromClue}")` : '';
  });

  // Step 2: Generate guesses based on the clue
  const guesserSystemPrompt = buildRivalGuesserSystemPrompt(team);
  const guesserUserPrompt = buildGuesserUserPrompt(
    clue,
    number,
    board,
    team,
    turnHistory
  );

  const guessResponse = await callAgent(guesserSystemPrompt, guesserUserPrompt, {
    temperature: 0.5,
    maxTokens: 4096,
    jsonMode: true,
  });

  const guessData = parseAgentJson<AgentGuesserResponse>(guessResponse);

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD GUESSES PURELY FROM allWordConfidences (by semantic confidence)
  // The guesser doesn't know categories - it picks based on clue relevance ONLY
  // ═══════════════════════════════════════════════════════════════════════
  
  const allWordConfidences = (guessData as unknown as { allWordConfidences?: { word: string; confidence: number }[] }).allWordConfidences || [];
  
  
  // Get valid unrevealed words
  const validWords = board.cards
    .filter(c => !c.revealed)
    .map(c => c.word.toUpperCase());
  
  // Build confidence map from AI's allWordConfidences
  const confidenceByWord = new Map<string, number>();
  allWordConfidences.forEach(wc => {
    confidenceByWord.set(wc.word.toUpperCase(), wc.confidence);
  });
  
  // Merge with stored confidences (take higher)
  rivalConfidenceMap.forEach((data, word) => {
    const currentConf = confidenceByWord.get(word) || 0;
    if (data.confidence > currentConf && !data.isZeroedByOpponent) {
      confidenceByWord.set(word, data.confidence);
    }
  });
  
  // Sort all words by confidence descending
  const sortedByConfidence = Array.from(confidenceByWord.entries())
    .filter(([word]) => validWords.includes(word))
    .sort((a, b) => b[1] - a[1]);
  
  sortedByConfidence.forEach(([word, conf], i) => {
    const bar = '█'.repeat(Math.floor(conf / 10)) + '░'.repeat(10 - Math.floor(conf / 10));
  });
  
  // ═══════════════════════════════════════════════════════════════════════
  // +1 RULE CHECK: Only allow +1 if there are "open mistakes" from previous turns
  // Open mistake = clueNumber - correct guesses (simple count)
  // ═══════════════════════════════════════════════════════════════════════
  
  let rivalOpenMistakes = 0;
  const rivalTeamHistoryForPlusOne = turnHistory.filter(t => t.team === team);
  
  if (rivalTeamHistoryForPlusOne.length === 0) {
  } else {
    rivalTeamHistoryForPlusOne.forEach((turn, i) => {
      const expected = turn.clueNumber;
      if (expected <= 0) return; // Skip avoidance/unlimited clues
      
      // Simple: clueNumber - correct guesses = missed words
      const correctCount = turn.guessResults.filter(r => r.correct).length;
      const missed = Math.max(0, expected - correctCount);
      
      if (missed > 0) {
        rivalOpenMistakes += missed;
      } else {
      }
    });
    
    if (rivalOpenMistakes > 0) {
    } else {
    }
  }
  
  // Pick top N words by confidence - +1 ONLY if there are open mistakes!
  const MINIMUM_CONFIDENCE = 10;
  const rivalCanUsePlusOne = rivalOpenMistakes > 0;
  const maxRivalGuesses = rivalCanUsePlusOne ? number + 1 : number;
  
  const validGuesses = sortedByConfidence
    .filter(([, conf]) => conf >= MINIMUM_CONFIDENCE)
    .slice(0, maxRivalGuesses)
    .map(([word]) => word);
  
  validGuesses.forEach((word, i) => {
    const conf = confidenceByWord.get(word) || 0;
    const isPlusOne = i >= number && rivalCanUsePlusOne;
    const marker = isPlusOne ? '➕' : '🎯';
  });

  // Create final word confidences array
  const finalWordConfidences: { word: string; confidence: number }[] = [];
  confidenceByWord.forEach((confidence, word) => {
    finalWordConfidences.push({ word, confidence });
  });

  // Get intended targets from the spymaster response
  const intendedTargets = rivalWords.slice(0, number); // Best guess at intended targets

  const result: RivalTurnResult = {
    clue,
    number,
    guesses: validGuesses,
    reasoning: clueReasoning,
    intendedTargets,
    guesserWordConfidences: finalWordConfidences,
  };

  return result;
}

// ============================================
// VALIDATION AGENT
// ============================================

/**
 * AI-powered clue validation - checks each word against each rule explicitly
 */
export async function validateClueWithAI(
  clue: string,
  boardWords: string[]
): Promise<ValidationResult> {

  // Quick programmatic check for spaces (must be single word)
  if (clue.includes(' ')) {
    return { valid: false, reason: 'Clue must be a single word (no spaces)' };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROGRAMMATIC PRE-CHECK: Check all rules before calling AI
  // ═══════════════════════════════════════════════════════════════════════
  
  const clueUpper = clue.toUpperCase();
  const suffixes = ['S', 'ES', 'ED', 'ING', 'ER', 'LY', 'TION', 'NESS', 'MENT', 'ABLE', 'IBLE'];
  
  // Extract root of clue by removing common suffixes
  let clueRoot = clueUpper;
  for (const suf of suffixes) {
    if (clueRoot.endsWith(suf) && clueRoot.length > suf.length + 2) {
      clueRoot = clueRoot.slice(0, -suf.length);
      break;
    }
  }
  
  
  for (const word of boardWords) {
    const wordUpper = word.toUpperCase();
    
    // Extract root of board word
    let wordRoot = wordUpper;
    for (const suf of suffixes) {
      if (wordRoot.endsWith(suf) && wordRoot.length > suf.length + 2) {
        wordRoot = wordRoot.slice(0, -suf.length);
        break;
      }
    }
    
    // RULE 1: Exact match
    if (clueUpper === wordUpper) {
      return { valid: false, reason: `Your clue "${clue}" is exactly the same as the board word "${word}". Try a different word.` };
    }
    
    // RULE 2: Clue contains board word
    if (clueUpper.length > wordUpper.length && clueUpper.includes(wordUpper)) {
      return { valid: false, reason: `Your clue "${clue}" contains the board word "${word}". Try a different word.` };
    }
    
    // RULE 3: Board word contains clue
    if (wordUpper.length > clueUpper.length && wordUpper.includes(clueUpper)) {
      return { valid: false, reason: `The board word "${word}" contains your clue "${clue}". Try a different word.` };
    }
    
    // RULE 4: Suffix forms (clue + suffix = word OR word + suffix = clue)
    for (const suf of suffixes) {
      if (clueUpper === wordUpper + suf || wordUpper === clueUpper + suf) {
        return { valid: false, reason: `Your clue "${clue}" is just "${word}" with a suffix. Try a completely different word.` };
      }
    }
    
    // RULE 5: SHARED ROOT - This catches HEROES/SUPERHERO!
    // Check if clue root appears in board word OR board word root appears in clue
    if (clueRoot.length >= 3 && wordUpper.includes(clueRoot)) {
      return { valid: false, reason: `Your clue "${clue}" shares the root "${clueRoot}" with board word "${word}". Try a different word.` };
    }
    if (wordRoot.length >= 3 && clueUpper.includes(wordRoot)) {
      return { valid: false, reason: `Your clue "${clue}" contains the root "${wordRoot}" from board word "${word}". Try a different word.` };
    }
  }
  

  try {
    // Build a very explicit prompt that checks each word against each rule
    const systemPrompt = `You are a strict Codenames clue validator. Check ALL rules for ALL board words.

## RULES (if ANY fails for ANY word → INVALID):

☐ RULE 1 - EXACT MATCH: Clue = board word (identical spelling)
☐ RULE 2 - CLUE CONTAINS WORD: Clue has board word as substring
   "BEARTRAP" contains "BEAR" → INVALID
☐ RULE 3 - WORD CONTAINS CLUE: Board word has clue as substring  
   "SUNFLOWER" contains "SUN" → INVALID
☐ RULE 4 - SUFFIX FORMS: Clue is word ± (S/ES/ED/ING/ER/LY)
   "RUNS" and "RUN" → INVALID
☐ RULE 5 - SHARED ROOT: Clue and word share a common root
   "HEROES" and "SUPERHERO" both contain "HERO" → INVALID
   "PLAYING" and "PLAYER" both contain "PLAY" → INVALID
☐ RULE 6 - ABBREVIATIONS: Clue abbreviates word or vice versa
   "NYC" and "NEW YORK" → INVALID

## VALID (these are OK):
- Synonyms: THEATER/SCREEN, LIPS/MOUTH = VALID (different strings!)
- Related concepts = VALID (that's the game!)
- Semantic connections = VALID

Return JSON: {"valid": true/false, "reason": "user-friendly explanation"}`;

    // Build explicit checklist for each word
    const wordChecklist = boardWords.map((word, i) => {
      const wordUpper = word.toUpperCase();
      let wordRoot = wordUpper;
      for (const s of suffixes) {
        if (wordRoot.endsWith(s) && wordRoot.length > s.length + 2) {
          wordRoot = wordRoot.slice(0, -s.length);
          break;
        }
      }
      return `
## Word ${i + 1}: "${word}" (root: "${wordRoot}")
☐ Is "${clueUpper}" exactly "${wordUpper}"?
☐ Does "${clueUpper}" contain "${wordUpper}"?
☐ Does "${wordUpper}" contain "${clueUpper}"?
☐ Is "${clueUpper}" = "${wordUpper}" + suffix (or vice versa)?
☐ Do they share a root? (clue root: "${clueRoot}", word root: "${wordRoot}")
☐ Is "${clue}" an abbreviation of "${word}" (or vice versa)?`;
    }).join('\n');

    const userPrompt = `## VALIDATE THIS CLUE

**Clue:** "${clue}" (uppercase: "${clueUpper}", root: "${clueRoot}")

**Check against each board word:**
${wordChecklist}

## RESPOND:
If ANY checkbox is YES for ANY word → {"valid": false, "reason": "user-friendly explanation"}
If ALL checkboxes are NO for ALL words → {"valid": true, "reason": "All rules pass"}

Give helpful, friendly error messages like:
- "Your clue 'HEROES' shares the root 'HERO' with 'SUPERHERO'. Try a different word."
- "Your clue 'NYC' is an abbreviation of 'NEW YORK'. Try a different word."

JSON response:`;

    const response = await callAgent(systemPrompt, userPrompt, {
      temperature: 0.0,
      maxTokens: 2048,
      jsonMode: true,
    });

    const parsed = parseAgentJson<AgentValidationResponse>(response);
    
    // SANITY CHECK: If AI says invalid, verify with actual string check
    if (!parsed.valid) {
      const clueUpper = clue.toUpperCase();
      let actualViolation = false;
      
      for (const word of boardWords) {
        const wordUpper = word.toUpperCase();
        // Check actual string rules
        if (clueUpper === wordUpper) actualViolation = true; // exact match
        if (clueUpper.length > wordUpper.length && clueUpper.includes(wordUpper)) actualViolation = true; // clue contains word
        if (wordUpper.length > clueUpper.length && wordUpper.includes(clueUpper)) actualViolation = true; // word contains clue
        // Check suffix forms
        const suffixes = ['S', 'ES', 'ING', 'ED', 'ER'];
        for (const suf of suffixes) {
          if (clueUpper === wordUpper + suf || wordUpper === clueUpper + suf) actualViolation = true;
        }
      }
      
      if (!actualViolation) {
        console.warn(`⚠️ [AI VALIDATOR] AI said INVALID but no actual string violation found!`);
        return { valid: true, reason: 'No string rule violations found' };
      }
    }
    

    return {
      valid: parsed.valid,
      reason: parsed.reason,
    };
  } catch (error) {
    console.error('❌ [AI VALIDATOR] AI validation error:', error);
    // On error, be lenient - mark as valid (let the game continue)
    return {
      valid: true,
      reason: 'Validation error - allowing clue',
    };
  }
}
// ============================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================

// These match the old stub function signatures
export const aiSpymasterStub = aiSpymaster;
export const aiGuesserStub = async (
  clue: string,
  clueNumber: number,
  board: BoardState,
  team: Team,
  profile?: UserProfile,
  turnHistory?: TurnEvent[],
  _allowMistakes?: boolean
): Promise<GuesserResponse> => {
  return aiGuesser(clue, clueNumber, board, team, profile, turnHistory || []);
};
export const rivalTurnStub = rivalTurn;
