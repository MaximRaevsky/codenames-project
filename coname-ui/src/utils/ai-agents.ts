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
    const result = {
      clue: clueCandidate,
      number: Math.max(1, parsed.number),
      reasoning: parsed.reasoning,
    };

    console.log('✅ [AI SPYMASTER] FINAL DECISION:');
    console.log('   📢 Clue: "' + result.clue + '" for ' + result.number + ' words');
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
  console.log('🔍 [AI GUESSER] Max guesses allowed:', clueNumber === -1 ? 'Unlimited' : clueNumber + 1);

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
    
    // Handle both old format (string[]) and new format ({word, confidence}[])
    let guessesWithConfidence: { word: string; confidence: number }[] = [];
    
    if (parsed.guesses && Array.isArray(parsed.guesses)) {
      if (parsed.guesses.length > 0) {
        if (typeof parsed.guesses[0] === 'string') {
          // Old format: string[]
          guessesWithConfidence = (parsed.guesses as unknown as string[]).map((g, i) => ({
            word: g,
            confidence: 100 - (i * 10) // Assign descending confidence for old format
          }));
        } else {
          // New format: {word, confidence}[]
          guessesWithConfidence = parsed.guesses as unknown as { word: string; confidence: number }[];
        }
      }
    }
    
    // Sort by confidence (descending)
    guessesWithConfidence.sort((a, b) => b.confidence - a.confidence);
    
    console.log('🔍 [AI GUESSER] AI thinking:');
    console.log('   💭 Reasoning:', parsed.reasoning);
    console.log('   📊 CONFIDENCE SCORES (descending):');
    guessesWithConfidence.forEach((g, i) => {
      const bar = '█'.repeat(Math.floor(g.confidence / 10)) + '░'.repeat(10 - Math.floor(g.confidence / 10));
      console.log(`      ${i + 1}. ${g.word.padEnd(15)} ${bar} ${g.confidence}%`);
    });

    if (guessesWithConfidence.length === 0) {
      console.log('      (No guesses - AI decided to PASS)');
    }

    // Filter to only valid unrevealed words
    const validWords = board.cards
      .filter(c => !c.revealed)
      .map(c => c.word.toUpperCase());

    const validGuesses = guessesWithConfidence
      .filter(g => validWords.includes(g.word.toUpperCase().trim()) && !currentGuesses.includes(g.word.toUpperCase().trim()))
      .map(g => ({ word: g.word.toUpperCase().trim(), confidence: g.confidence }));

    // Limit guesses based on clue number
    const maxGuesses = clueNumber === -1 || clueNumber === 0 
      ? validGuesses.length 
      : Math.min(clueNumber + 1, validGuesses.length);

    const finalGuesses = validGuesses.slice(0, maxGuesses);
    
    const result = {
      guesses: finalGuesses.map(g => g.word),
      reasoning: parsed.reasoning,
    };

    console.log('✅ [AI GUESSER] FINAL DECISION:');
    if (finalGuesses.length > 0) {
      console.log('   🎯 Will guess (in order):');
      finalGuesses.forEach((g, i) => {
        console.log(`      ${i + 1}. ${g.word} (${g.confidence}% confident)`);
      });
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

  // Filter to valid words
  const validWords = board.cards
    .filter(c => !c.revealed)
    .map(c => c.word.toUpperCase());

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

YOUR ONLY JOB: Check if the clue violates ANY of these 4 rules with ANY board word.

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
      `"${clue}" vs "${word}": exact match? contains? contained? suffix form?`
    ).join('\n');

    const userPrompt = `CLUE: "${clue}"

CHECK EACH BOARD WORD:
${wordChecks}

For EACH word above, answer:
1. Is "${clue}" spelled exactly as this word? (letter by letter)
2. Does "${clue}" contain this word as letters inside it?
3. Does this word contain "${clue}" as letters inside it?
4. Is one the other + s/es/ed/ing/er?

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

