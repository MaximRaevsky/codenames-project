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
  buildValidatorSystemPrompt,
  buildValidatorUserPrompt,
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
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎯 [AI SPYMASTER] Starting clue generation...');
  console.log('🎯 [AI SPYMASTER] Team:', team === 'teamA' ? 'RED' : 'BLUE');
  
  // Get all board words for validation
  const allBoardWords = board.cards.filter(c => !c.revealed).map(c => c.word);
  
  // Log board state for debugging
  const teamWords = board.cards.filter(c => c.category === team && !c.revealed).map(c => c.word);
  const rivalWords = board.cards.filter(c => c.category === (team === 'teamA' ? 'teamB' : 'teamA') && !c.revealed).map(c => c.word);
  const assassin = board.cards.find(c => c.category === 'assassin' && !c.revealed)?.word;
  
  console.log('🎯 [AI SPYMASTER] Board State:');
  console.log('   ✅ Team words to find:', teamWords.join(', '));
  console.log('   🚫 ASSASSIN:', assassin);
  console.log('   ⚠️ Rival words:', rivalWords.join(', '));
  console.log('   📊 Score - Team:', board.teamARemaining, 'vs Rival:', board.teamBRemaining);

  let rejectedClues: { clue: string; reason: string }[] = [];
  let attempt = 0;

  // Keep trying until we get a valid clue
  while (true) {
    attempt++;
    console.log(`🎯 [AI SPYMASTER] Attempt ${attempt}`);
    
    const systemPrompt = buildSpymasterSystemPrompt(team, true, profile);
    let userPrompt = buildSpymasterUserPrompt(board, team, turnHistory);
    
    // Add rejected clues WITH REASONS to the prompt
    if (rejectedClues.length > 0) {
      userPrompt += `\n\n⚠️ REJECTED CLUES - DO NOT USE THESE OR SIMILAR:\n${rejectedClues.map(r => `- "${r.clue}" was INVALID because: ${r.reason}`).join('\n')}\n\nPick a COMPLETELY DIFFERENT word that doesn't violate these same rules!`;
    }

    console.log('🎯 [AI SPYMASTER] Sending prompt to AI...');
    
    const response = await callAgent(systemPrompt, userPrompt, {
      temperature: Math.min(0.8 + (attempt - 1) * 0.1, 1.2),
      maxTokens: 4096,
      jsonMode: true,
    });

    console.log('🎯 [AI SPYMASTER] Raw AI response:', response);
    const parsed = parseAgentJson<AgentSpymasterResponse>(response);
    
    console.log('🎯 [AI SPYMASTER] Parsed response:');
    console.log('   📝 Clue:', parsed.clue);
    console.log('   🔢 Number:', parsed.number);
    console.log('   💭 Reasoning:', parsed.reasoning);
    
    // Log target words if provided
    const targetWords = (parsed as unknown as { targetWords?: string[] }).targetWords;
    if (targetWords && Array.isArray(targetWords)) {
      console.log('   🎯 TARGET WORDS for this clue:');
      targetWords.forEach((w, i) => {
        console.log(`      ${i + 1}. ${w}`);
      });
    }
    
    // Log danger check (assassin + rival words)
    const dangerCheck = (parsed as unknown as { dangerCheck?: { word: string; risk: number }[] }).dangerCheck;
    if (dangerCheck && Array.isArray(dangerCheck)) {
      console.log('   ⚠️ DANGER CHECK (Assassin + Rival words):');
      dangerCheck.forEach(w => {
        const riskColor = w.risk > 50 ? '🔴' : w.risk > 25 ? '🟠' : w.risk > 10 ? '🟡' : '🟢';
        const riskBar = '█'.repeat(Math.floor(w.risk / 10)) + '░'.repeat(10 - Math.floor(w.risk / 10));
        console.log(`      ${riskColor} ${w.word.padEnd(15)} Risk: ${riskBar} ${w.risk}%`);
      });
      
      // Warn if any high risk
      const riskyWords = dangerCheck.filter(w => w.risk > 25);
      if (riskyWords.length > 0) {
        console.warn('   ⚠️ WARNING: High risk connections:', riskyWords.map(w => `${w.word}(${w.risk}%)`).join(', '));
      }
    }

    // Validate the response format
    if (!parsed.clue || typeof parsed.number !== 'number') {
      console.error('❌ [AI SPYMASTER] Invalid response format, retrying...');
      continue;
    }

    const clueCandidate = parsed.clue.toUpperCase().trim();
    
    // VALIDATE THE CLUE using AI validation
    console.log('🔍 [AI SPYMASTER] Validating clue with AI validator...');
    
    const validation = await validateClueWithAI(clueCandidate, allBoardWords);
    
    if (!validation.valid) {
      console.warn(`⚠️ [AI SPYMASTER] Clue "${clueCandidate}" is INVALID: ${validation.reason}`);
      rejectedClues.push({ clue: clueCandidate, reason: validation.reason || 'Unknown reason' });
      console.log(`🔄 [AI SPYMASTER] Retrying with different clue...`);
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
      console.log(`🔄 [AI SPYMASTER] Retrying - need targetWords...`);
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
      console.log(`🔄 [AI SPYMASTER] Retrying - invalid targetWords...`);
      continue;
    }
    
    const result = {
      clue: clueCandidate,
      number: Math.max(1, parsed.number),
      reasoning: parsed.reasoning,
      targetWords: finalTargetWords.map(w => w.toUpperCase()), // Normalize to uppercase
    };

    console.log('✅ [AI SPYMASTER] FINAL DECISION:');
    console.log('   📢 Clue: "' + result.clue + '" for ' + result.number + ' words');
    console.log('   🎯 Targets: ' + (result.targetWords.length > 0 ? result.targetWords.join(', ') : '(NONE SPECIFIED!)'));
    console.log('   💭 Why: ' + result.reasoning);
    console.log('═══════════════════════════════════════════════════════════');

    return result;
  }
}

// ============================================
// PARTNER GUESSER AGENT
// ============================================

/**
 * AI Guesser for the user's team (when user is Spymaster)
 * Interprets user's clues, personalized to understand their style
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
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 [AI GUESSER] Starting guess generation...');
  console.log('🔍 [AI GUESSER] Received clue: "' + clue + '" for ' + clueNumber + ' words');
  console.log('🔍 [AI GUESSER] Team:', team === 'teamA' ? 'RED' : 'BLUE');
  
  // Log available words (guesser doesn't know categories)
  const unrevealedWords = board.cards.filter(c => !c.revealed).map(c => c.word);
  console.log('🔍 [AI GUESSER] Available words on board:', unrevealedWords.join(', '));
  console.log('🔍 [AI GUESSER] Already guessed this turn:', currentGuesses.length > 0 ? currentGuesses.join(', ') : 'None');
  
  // +1 RULE ANALYSIS
  const maxGuessesAllowed = clueNumber === -1 ? 99 : clueNumber + 1;
  console.log('🔍 [AI GUESSER] ═══ +1 RULE ANALYSIS ═══');
  console.log('   📢 Current clue: "' + clue + '" for ' + clueNumber);
  console.log('   🎯 Max guesses allowed: ' + maxGuessesAllowed + ' (clue number + 1)');
  
  // Analyze previous turns for leftover words
  const teamHistory = turnHistory.filter(t => t.team === team);
  const leftoverClues: { clue: string; expected: number; got: number; missed: number }[] = [];
  
  for (const turn of teamHistory) {
    const correctCount = turn.guessResults.filter(r => r.correct).length;
    if (turn.clueNumber > 0 && correctCount < turn.clueNumber) {
      const missed = turn.clueNumber - correctCount;
      leftoverClues.push({
        clue: turn.clue,
        expected: turn.clueNumber,
        got: correctCount,
        missed
      });
    }
  }
  
  if (leftoverClues.length > 0) {
    console.log('   ⚠️ LEFTOVER WORDS FROM PREVIOUS TURNS:');
    leftoverClues.forEach(l => {
      console.log(`      • "${l.clue}" - expected ${l.expected}, got ${l.got} → ${l.missed} word(s) still unguessed!`);
    });
    console.log('   💡 Can use +1 to catch up on these if VERY confident (>80%)');
  } else {
    console.log('   ✅ No leftover words from previous turns');
  }
  console.log('🔍 [AI GUESSER] ═══════════════════════');

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

    console.log('🔍 [AI GUESSER] Sending prompt to AI...');
    const response = await callAgent(systemPrompt, userPrompt, {
      temperature: 0.6,
      maxTokens: 4096,
      jsonMode: true,
    });

    console.log('🔍 [AI GUESSER] Raw AI response:', response);
    const parsed = parseAgentJson<AgentGuesserResponse>(response);
    
    // Log ALL word confidences for tracking
    const allWordConfidences = (parsed as unknown as { allWordConfidences?: { word: string; confidence: number }[] }).allWordConfidences;
    if (allWordConfidences && Array.isArray(allWordConfidences) && allWordConfidences.length > 0) {
      // Sort by confidence descending
      const sorted = [...allWordConfidences].sort((a, b) => b.confidence - a.confidence);
      
      console.log('📋 [AI GUESSER] ═══ ALL WORD CONFIDENCES FOR CURRENT CLUE "' + clue + '" ═══');
      sorted.forEach((w, i) => {
        const bar = '█'.repeat(Math.floor(w.confidence / 10)) + '░'.repeat(10 - Math.floor(w.confidence / 10));
        const marker = w.confidence >= 50 ? '✅' : w.confidence >= 30 ? '⚠️' : '❌';
        console.log(`   ${marker} ${(i + 1).toString().padStart(2)}. ${w.word.padEnd(15)} ${bar} ${w.confidence}%`);
      });
      console.log('📋 [AI GUESSER] ═══════════════════════════════════════════════════════');
    }
    
    // Extended format: {word, confidence, source, fromClue, turnsAgo}
    // For "previous" source: confidence is AI's CURRENT assessment, we apply decay
    interface GuessDetail {
      word: string;
      confidence: number;           // Final confidence (after decay for previous)
      rawConfidence: number;        // AI's raw assessment (before decay)
      source: 'current' | 'previous';
      fromClue?: string;
      turnsAgo?: number;
    }
    
    let guessesWithDetails: GuessDetail[] = [];
    
    if (parsed.guesses && Array.isArray(parsed.guesses)) {
      if (parsed.guesses.length > 0) {
        if (typeof parsed.guesses[0] === 'string') {
          // Old format: string[] - assume all are for current clue
          guessesWithDetails = (parsed.guesses as unknown as string[]).map((g, i) => ({
            word: g,
            confidence: 100 - (i * 10),
            rawConfidence: 100 - (i * 10),
            source: 'current' as const
          }));
        } else {
          // New format - apply decay for previous clue words
          guessesWithDetails = (parsed.guesses as unknown as {
            word: string;
            confidence: number;
            source?: string;
            fromClue?: string;
            turnsAgo?: number;
          }[]).map(g => {
            const isPrevious = g.source === 'previous';
            const turnsAgo = g.turnsAgo || 1;
            const rawConfidence = g.confidence;
            
            // Apply decay: confidence × 0.9^turnsAgo for previous clue words
            const decayMultiplier = isPrevious ? Math.pow(0.9, turnsAgo) : 1;
            const decayedConfidence = Math.round(rawConfidence * decayMultiplier);
            
            return {
              word: g.word,
              confidence: decayedConfidence,
              rawConfidence: rawConfidence,
              source: (isPrevious ? 'previous' : 'current') as 'current' | 'previous',
              fromClue: g.fromClue,
              turnsAgo: turnsAgo
            };
          });
        }
      }
    }
    
    // Sort by FINAL confidence (after decay) - descending
    guessesWithDetails.sort((a, b) => b.confidence - a.confidence);
    
    // Separate current clue guesses from leftover guesses
    const currentClueGuesses = guessesWithDetails.filter(g => g.source === 'current');
    let leftoverGuesses = guessesWithDetails.filter(g => g.source === 'previous');
    
    // Apply decay-based sorting for leftovers and take only the BEST one
    leftoverGuesses.sort((a, b) => b.confidence - a.confidence);
    
    // ENFORCE: Only ONE leftover allowed for +1 rule - take the best one (highest after decay)
    if (leftoverGuesses.length > 1) {
      console.log('   ⚠️ AI suggested multiple leftovers, but +1 allows only ONE. Taking highest after decay:');
      leftoverGuesses.slice(1).forEach(g => {
        const decayInfo = `${g.rawConfidence}% × 0.9^${g.turnsAgo} = ${g.confidence}%`;
        console.log(`      ❌ Dropping: ${g.word} (${decayInfo} from "${g.fromClue}")`);
      });
      leftoverGuesses = [leftoverGuesses[0]];
    }
    
    console.log('🔍 [AI GUESSER] AI thinking:');
    console.log('   💭 Reasoning:', parsed.reasoning);
    
    if (currentClueGuesses.length > 0) {
      console.log('   📊 FOR CURRENT CLUE "' + clue + '":');
      currentClueGuesses.forEach((g, i) => {
        const bar = '█'.repeat(Math.floor(g.confidence / 10)) + '░'.repeat(10 - Math.floor(g.confidence / 10));
        console.log(`      ${i + 1}. ${g.word.padEnd(15)} ${bar} ${g.confidence}%`);
      });
    }
    
    if (leftoverGuesses.length > 0) {
      console.log('   🔄 LEFTOVER FOR +1 RULE (max 1 allowed):');
      leftoverGuesses.forEach((g) => {
        const bar = '█'.repeat(Math.floor(g.confidence / 10)) + '░'.repeat(10 - Math.floor(g.confidence / 10));
        const decayCalc = `${g.rawConfidence}% × 0.9^${g.turnsAgo || 1} = ${g.confidence}%`;
        console.log(`      • ${g.word.padEnd(15)} ${bar} ${g.confidence}% (AI said ${g.rawConfidence}%, decay: ${decayCalc})`);
        if (g.fromClue) console.log(`        └─ from clue "${g.fromClue}" (${g.turnsAgo} turn(s) ago)`);
      });
    }

    if (guessesWithDetails.length === 0) {
      console.log('      (No guesses - AI decided to PASS)');
    }
    
    // Merge back: current clue guesses + at most 1 leftover
    guessesWithDetails = [...currentClueGuesses, ...leftoverGuesses];

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

    // Separate by source for proper limiting
    const validCurrentClue = validGuesses.filter(g => g.source === 'current');
    const validLeftover = validGuesses.filter(g => g.source === 'previous').slice(0, 1); // Max 1 leftover
    
    // Limit current clue guesses based on clue number, then add 1 leftover if available
    const maxCurrentGuesses = clueNumber === -1 || clueNumber === 0 
      ? validCurrentClue.length 
      : Math.min(clueNumber, validCurrentClue.length);
    
    const finalCurrentClue = validCurrentClue.slice(0, maxCurrentGuesses);
    const finalLeftover = validLeftover.length > 0 && (clueNumber === -1 || clueNumber === 0 || finalCurrentClue.length >= clueNumber)
      ? validLeftover 
      : []; // Only use +1 if we've guessed enough for current clue
    
    // Combine: current clue guesses first, then the single leftover (if any)
    const finalGuesses = [...finalCurrentClue, ...finalLeftover];
    
    const result = {
      guesses: finalGuesses.map(g => g.word),
      reasoning: parsed.reasoning,
    };

    console.log('✅ [AI GUESSER] FINAL DECISION:');
    if (finalGuesses.length > 0) {
      console.log('   🎯 Will guess (in order):');
      finalGuesses.forEach((g, i) => {
        if (g.source === 'previous') {
          const decayCalc = `AI: ${g.rawConfidence}% × 0.9^${g.turnsAgo || 1} = ${g.confidence}%`;
          console.log(`      ${i + 1}. ${g.word} (${g.confidence}%) ← +1 LEFTOVER from "${g.fromClue}" [${decayCalc}]`);
        } else {
          console.log(`      ${i + 1}. ${g.word} (${g.confidence}%) ← matches current clue "${clue}"`);
        }
      });
      
      // +1 Rule analysis
      console.log('   ═══ +1 RULE ANALYSIS ═══');
      console.log(`   📢 Current clue "${clue}" asked for: ${clueNumber} word(s)`);
      console.log(`   🎯 Guessing for CURRENT clue: ${finalCurrentClue.length} word(s)`);
      
      if (finalLeftover.length > 0) {
        const leftover = finalLeftover[0];
        const decayCalc = `${leftover.rawConfidence}% × 0.9^${leftover.turnsAgo || 1} = ${leftover.confidence}%`;
        console.log(`   ✅ USING +1 FOR ONE LEFTOVER:`);
        console.log(`      • "${leftover.word}" from clue "${leftover.fromClue}"`);
        console.log(`      • AI confidence: ${leftover.rawConfidence}% → after decay: ${leftover.confidence}% (${decayCalc})`);
      } else {
        console.log(`   ❌ NOT USING +1: No confident leftover word`);
      }
      console.log('   ═══════════════════════');
    } else {
      console.log('   🎯 PASSING TURN - no confident guesses');
    }
    console.log('   💭 Why:', result.reasoning);
    console.log('═══════════════════════════════════════════════════════════');

    return result;
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
  console.log('═══════════════════════════════════════════════════════════');
  console.log('👿 [RIVAL TURN] Starting rival team turn...');
  console.log('👿 [RIVAL TURN] Team:', team === 'teamA' ? 'RED' : 'BLUE');
  
  // Get all board words for validation
  const allBoardWords = board.cards.filter(c => !c.revealed).map(c => c.word);
  
  // Log rival's board state
  const rivalWords = board.cards.filter(c => c.category === team && !c.revealed).map(c => c.word);
  const yourWords = board.cards.filter(c => c.category === (team === 'teamA' ? 'teamB' : 'teamA') && !c.revealed).map(c => c.word);
  const assassin = board.cards.find(c => c.category === 'assassin' && !c.revealed)?.word;
  
  console.log('👿 [RIVAL TURN] Rival sees:');
  console.log('   ✅ Their team words:', rivalWords.join(', '));
  console.log('   🚫 ASSASSIN:', assassin);
  console.log('   ⚠️ Your team words (their rivals):', yourWords.join(', '));

  // Step 1: Generate clue as spymaster (keep trying until valid)
  console.log('👿 [RIVAL TURN] Step 1: Rival spymaster generating clue...');
  
  let clue = '';
  let number = 0;
  let clueReasoning = '';
  let rejectedClues: { clue: string; reason: string }[] = [];
  let attempt = 0;
  
  while (!clue) {
    attempt++;
    console.log(`👿 [RIVAL TURN] Clue generation attempt ${attempt}`);
    
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

    console.log('👿 [RIVAL TURN] Spymaster raw response:', clueResponse);
    const clueData = parseAgentJson<AgentSpymasterResponse>(clueResponse);

    if (!clueData.clue || typeof clueData.number !== 'number') {
      console.error('❌ [RIVAL TURN] Invalid clue response format, retrying...');
      continue;
    }

    const clueCandidate = clueData.clue.toUpperCase().trim();
    
    // VALIDATE THE CLUE using AI validation
    console.log('🔍 [RIVAL TURN] Validating clue with AI validator...');
    const validation = await validateClueWithAI(clueCandidate, allBoardWords);
    
    if (!validation.valid) {
      console.warn(`⚠️ [RIVAL TURN] Clue "${clueCandidate}" is INVALID: ${validation.reason}`);
      rejectedClues.push({ clue: clueCandidate, reason: validation.reason || 'Unknown reason' });
      console.log(`🔄 [RIVAL TURN] Retrying with different clue...`);
      continue;
    }
    
    // Valid clue found!
    clue = clueCandidate;
    number = Math.max(1, clueData.number);
    clueReasoning = clueData.reasoning || 'No reasoning provided';
  }

  console.log('👿 [RIVAL TURN] Spymaster decided:');
  console.log('   📢 Clue: "' + clue + '" for ' + number + ' words');
  console.log('   💭 Reasoning:', clueReasoning);

  // Step 2: Generate guesses based on the clue
  console.log('👿 [RIVAL TURN] Step 2: Rival guesser interpreting clue...');
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

  console.log('👿 [RIVAL TURN] Guesser raw response:', guessResponse);
  const guessData = parseAgentJson<AgentGuesserResponse>(guessResponse);

  // Handle both old format (string[]) and new format ({word, confidence}[])
  let rivalGuessesWithConfidence: { word: string; confidence: number }[] = [];
  
  if (guessData.guesses && Array.isArray(guessData.guesses)) {
    if (guessData.guesses.length > 0) {
      if (typeof guessData.guesses[0] === 'string') {
        // Old format: string[]
        rivalGuessesWithConfidence = (guessData.guesses as unknown as string[]).map((g, i) => ({
          word: g,
          confidence: 100 - (i * 10)
        }));
      } else {
        // New format: {word, confidence}[]
        rivalGuessesWithConfidence = guessData.guesses as unknown as { word: string; confidence: number }[];
      }
    }
  }
  
  // Sort by confidence (descending)
  rivalGuessesWithConfidence.sort((a, b) => b.confidence - a.confidence);
  
  console.log('👿 [RIVAL TURN] 📊 CONFIDENCE SCORES (descending):');
  rivalGuessesWithConfidence.forEach((g, i) => {
    const bar = '█'.repeat(Math.floor(g.confidence / 10)) + '░'.repeat(10 - Math.floor(g.confidence / 10));
    console.log(`      ${i + 1}. ${g.word.padEnd(15)} ${bar} ${g.confidence}%`);
  });

  // Filter to valid (unrevealed) words only
  const validWords = board.cards
    .filter(c => !c.revealed)
    .map(c => c.word.toUpperCase());
  
  const revealedWords = board.cards
    .filter(c => c.revealed)
    .map(c => c.word.toUpperCase());

  // Check if AI tried to guess already-revealed words (bug detection)
  const invalidGuesses = rivalGuessesWithConfidence
    .filter(g => revealedWords.includes(g.word.toUpperCase().trim()));
  
  if (invalidGuesses.length > 0) {
    console.warn('⚠️ [RIVAL TURN] BUG DETECTED: AI tried to guess already-revealed words!');
    invalidGuesses.forEach(g => {
      console.warn(`   ❌ "${g.word}" is already revealed - FILTERED OUT`);
    });
  }

  const validGuesses = rivalGuessesWithConfidence
    .filter(g => validWords.includes(g.word.toUpperCase().trim()))
    .map(g => g.word.toUpperCase().trim());

  const result = {
    clue,
    number,
    guesses: validGuesses.slice(0, number + 1),
    reasoning: clueReasoning,
  };

  console.log('✅ [RIVAL TURN] FINAL RIVAL DECISION:');
  console.log('   📢 Clue: "' + result.clue + '" for ' + result.number);
  console.log('   🎯 Will guess:', result.guesses.join(' → '));
  if (invalidGuesses.length > 0) {
    console.log('   ⚠️ Filtered out ' + invalidGuesses.length + ' already-revealed word(s)');
  }
  console.log('═══════════════════════════════════════════════════════════');
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
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✔️ [AI VALIDATOR] Validating clue: "' + clue + '"');
  console.log('✔️ [AI VALIDATOR] Board words:', boardWords.join(', '));

  // Quick programmatic check for spaces (must be single word)
  if (clue.includes(' ')) {
    console.log('❌ [AI VALIDATOR] INVALID - Clue contains spaces');
    return { valid: false, reason: 'Clue must be a single word (no spaces)' };
  }

  try {
    // Build a very explicit prompt that checks each word against each rule
    const systemPrompt = `You are a Codenames clue validator. You must check EXACT STRING PATTERNS ONLY.

YOUR ONLY JOB: Check if the clue violates ANY of these 5 rules with ANY board word.

RULE 1 - EXACT MATCH: Is clue spelled EXACTLY the same as a board word?
RULE 2 - CLUE CONTAINS WORD: Does the clue contain a board word as consecutive letters?
  Example: "BEARTRAP" contains "BEAR" → INVALID
  Example: "SUNLIGHT" contains "SUN" → INVALID
RULE 3 - WORD CONTAINS CLUE: Does any board word contain the clue as consecutive letters?
  Example: Board has "SUNFLOWER", clue is "SUN" → INVALID
  Example: Board has "FIREPLACE", clue is "FIRE" → INVALID
RULE 4 - SUFFIX FORMS: Is clue = word + (S/ES/ED/ING/ER) or word = clue + (S/ES/ED/ING/ER)?
  Example: clue "RUNS" and word "RUN" → INVALID
  Example: clue "RUN" and word "RUNNING" → INVALID
RULE 5 - ABBREVIATIONS/ACRONYMS: Is the clue an abbreviation of a board word, or vice versa?
  Example: clue "NYC" and word "NEW YORK" → INVALID (NYC = New York City)
  Example: clue "USA" and word "AMERICA" → INVALID (USA = United States of America)
  Example: clue "UK" and word "ENGLAND" → INVALID (UK = United Kingdom, England is part of UK)
  Example: clue "LA" and word "LOS ANGELES" → INVALID
  Example: clue "TV" and word "TELEVISION" → INVALID
  Example: clue "AMERICA" and word "USA" → INVALID (expansion of abbreviation)

**CRITICAL - WHAT IS VALID:**
- Different words with NO letter overlap = VALID
- LIPS and MOUTH = completely different strings = VALID
- THEATER and SCREEN = completely different strings = VALID  
- BREATHE and MOUTH = completely different strings = VALID
- Synonyms = VALID (that's the game!)
- Related concepts = VALID (that's the game!)

Return JSON: {"valid": true/false, "reason": "explanation"}`;

    // Build explicit word-by-word check
    const wordChecks = boardWords.map(word => 
      `"${clue}" vs "${word}": exact match? contains? contained? suffix form? abbreviation?`
    ).join('\n');

    const userPrompt = `CLUE: "${clue}"

CHECK EACH BOARD WORD:
${wordChecks}

For EACH word above, answer:
1. Is "${clue}" spelled exactly as this word? (letter by letter)
2. Does "${clue}" contain this word as letters inside it?
3. Does this word contain "${clue}" as letters inside it?
4. Is one the other + s/es/ed/ing/er?
5. Is "${clue}" an abbreviation/acronym of this word? (e.g., NYC for NEW YORK, TV for TELEVISION)

If ANY answer is YES for ANY word → {"valid": false, "reason": "word X violates rule Y"}
If ALL answers are NO for ALL words → {"valid": true, "reason": "no violations"}

Remember: Different words like LIPS/MOUTH, THEATER/SCREEN are VALID!
JSON response:`;

    const response = await callAgent(systemPrompt, userPrompt, {
      temperature: 0.0,
      maxTokens: 2048,
      jsonMode: true,
    });

    console.log('✔️ [AI VALIDATOR] AI raw response:', response);
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
        console.log('✔️ [AI VALIDATOR] Overriding to VALID - AI made semantic judgment');
        console.log('═══════════════════════════════════════════════════════════');
        return { valid: true, reason: 'No string rule violations found' };
      }
    }
    
    console.log('✔️ [AI VALIDATOR] AI DECISION:');
    console.log('   ' + (parsed.valid ? '✅ VALID' : '❌ INVALID'));
    console.log('   💭 Reason:', parsed.reason);
    console.log('═══════════════════════════════════════════════════════════');

    return {
      valid: parsed.valid,
      reason: parsed.reason,
    };
  } catch (error) {
    console.error('❌ [AI VALIDATOR] AI validation error:', error);
    // On error, be lenient - mark as valid (let the game continue)
    console.log('⚠️ [AI VALIDATOR] Error during validation, marking as VALID to not block game');
    console.log('═══════════════════════════════════════════════════════════');
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

