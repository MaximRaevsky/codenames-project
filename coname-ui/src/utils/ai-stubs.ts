/**
 * AI STUB FUNCTIONS
 * =================
 * 
 * This file contains mock implementations for all AI-related functionality.
 * These stubs provide deterministic/semi-random behavior for demo purposes.
 * 
 * TODO: AI INTEGRATION ROADMAP
 * ----------------------------
 * 
 * 1. SPYMASTER AI (when user is Guesser)
 *    Location: aiSpymasterStub function
 *    Current: Returns pre-defined clues based on word matching
 *    Integration:
 *    - Replace with LLM API call (OpenAI/Anthropic/etc.)
 *    - Input: board state, user profile, turn history, remaining words
 *    - Output: clue word, number, reasoning for transparency
 *    - Consider: Use profile.clueStyle, profile.riskTolerance to tune
 *    - Consider: Stream reasoning to UI for engagement
 * 
 * 2. GUESSER AI (when user is Spymaster)
 *    Location: aiGuesserStub function
 *    Current: Picks team words with simulated mistakes
 *    Integration:
 *    - Replace with LLM API call
 *    - Input: clue, number, board state, user profile, history
 *    - Output: ranked guesses with confidence scores
 *    - Consider: Show AI "thinking" process to user
 *    - Consider: Allow user to give hints/feedback mid-guess
 * 
 * 3. RIVAL TEAM AI
 *    Location: rivalTurnStub function
 *    Current: Simple random clue + mistake-prone guessing
 *    Integration:
 *    - Use same LLM but with different "personality" prompt
 *    - Should feel like a distinct opponent
 *    - Consider: Difficulty levels (easy/medium/hard rival)
 * 
 * 4. CLUE VALIDATION
 *    Location: ../utils/validator.ts
 *    Current: Basic word matching check
 *    Integration:
 *    - Use LLM to check semantic similarity to board words
 *    - Detect multi-word clues disguised as compound words
 *    - Check for proper nouns, non-English words if applicable
 * 
 * 5. PERSONALIZATION
 *    The UserProfile contains rich context:
 *    - knowledgeDomains: Use for clue style/references
 *    - clueStyle: creative/literal/abstract/concise
 *    - riskTolerance: How many words to connect at once
 *    - culturalContext: Regional references
 *    - additionalContext: Free-form user notes
 *    All of this should be passed to the AI prompts.
 */

import {
  BoardState,
  UserProfile,
  SpymasterResponse,
  GuesserResponse,
  TurnEvent,
  Team,
  CardCategory,
} from '../types/game';

// ============================================
// CONSTANTS
// ============================================

// Increased mistake chances for more realistic demo gameplay
const NEUTRAL_MISTAKE_BASE_CHANCE = 0.22;   // Higher base chance of neutral word
const NEUTRAL_MISTAKE_INCREMENT = 0.08;     // More risky with each guess
const RIVAL_MISTAKE_CHANCE = 0.12;          // Higher chance of hitting rival word
const ASSASSIN_MISTAKE_CHANCE = 0.03;       // Small chance of catastrophic mistake
const MIN_GUESSES = 1;
const DEFAULT_CLUE_NUMBER = 2;
const DEFAULT_CONFIDENCE = 0.92;
const CONFIDENCE_DECAY = 0.12;
const MIN_CONFIDENCE = 0.45;

// Rival team settings - they should attempt more words
const RIVAL_MIN_WORDS = 2;
const RIVAL_MAX_WORDS = 4;

const RIVAL_CLUE_OPTIONS = [
  'STRATEGY',
  'RIVAL',
  'COUNTER',
  'TEAM',
  'MOVE',
  'PLAY',
  'TARGET',
  'ATTACK',
  'DEFENSE',
  'PLAN',
  'CONNECT',
  'LINK',
  'THEME',
];

interface StubClue {
  clue: string;
  number: number;
  relatedWords: string[];
}

const STUB_CLUES: StubClue[] = [
  { clue: 'OCEAN', number: 3, relatedWords: ['WAVE', 'SHIP', 'WHALE', 'BEACH', 'WATER', 'SEAL', 'SHARK'] },
  { clue: 'WINTER', number: 2, relatedWords: ['SNOW', 'ICE', 'COLD', 'FROST', 'SNOWMAN'] },
  { clue: 'SPACE', number: 3, relatedWords: ['STAR', 'MOON', 'ROCKET', 'SATELLITE', 'JUPITER', 'SATURN'] },
  { clue: 'KITCHEN', number: 2, relatedWords: ['PAN', 'KNIFE', 'COOK', 'SPOON', 'FORK', 'PLATE'] },
  { clue: 'JUNGLE', number: 2, relatedWords: ['TIGER', 'SNAKE', 'TREE', 'VINE', 'LION', 'ELEPHANT'] },
  { clue: 'MUSIC', number: 3, relatedWords: ['PIANO', 'DRUM', 'BAND', 'SONG', 'FLUTE', 'OPERA', 'CONCERT'] },
  { clue: 'ANCIENT', number: 2, relatedWords: ['TEMPLE', 'PYRAMID', 'SCROLL', 'STONE', 'ROME', 'EGYPT', 'GREECE'] },
  { clue: 'CRIME', number: 2, relatedWords: ['THIEF', 'LOCK', 'ESCAPE', 'MASK', 'PRISON', 'POLICE'] },
  { clue: 'FLIGHT', number: 2, relatedWords: ['PILOT', 'PLANE', 'EAGLE', 'WING', 'JET', 'HELICOPTER'] },
  { clue: 'ROYALTY', number: 3, relatedWords: ['CROWN', 'KING', 'QUEEN', 'CASTLE', 'KNIGHT', 'PRINCE', 'PRINCESS'] },
  { clue: 'SPORTS', number: 2, relatedWords: ['BALL', 'STADIUM', 'RACKET', 'MATCH', 'FIELD', 'CRICKET'] },
  { clue: 'MAGIC', number: 2, relatedWords: ['WITCH', 'SPELL', 'WAND', 'DRAGON', 'UNICORN', 'WIZARD'] },
  { clue: 'MEDICAL', number: 2, relatedWords: ['DOCTOR', 'NURSE', 'HOSPITAL', 'NEEDLE', 'DISEASE'] },
  { clue: 'MONEY', number: 2, relatedWords: ['BANK', 'GOLD', 'DIAMOND', 'MILLIONAIRE', 'CASINO', 'STOCK'] },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

const shuffleArray = <T>(array: T[]): T[] => [...array].sort(() => Math.random() - 0.5);

const pickRandom = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

const getRivalTeam = (team: Team): Team => (team === 'teamA' ? 'teamB' : 'teamA');

const getUnrevealedCardsByCategory = (board: BoardState, category: CardCategory) =>
  board.cards.filter((card) => card.category === category && !card.revealed);

const getUnrevealedWords = (board: BoardState, category: CardCategory) =>
  getUnrevealedCardsByCategory(board, category).map((card) => card.word);

const calculateMistakeChance = (guessIndex: number) =>
  NEUTRAL_MISTAKE_BASE_CHANCE + guessIndex * NEUTRAL_MISTAKE_INCREMENT;

const calculateConfidence = (guessIndex: number) =>
  Math.max(MIN_CONFIDENCE, DEFAULT_CONFIDENCE - guessIndex * CONFIDENCE_DECAY);

const findMatchingClue = (teamWords: string[]): StubClue | null => {
  const shuffledClues = shuffleArray(STUB_CLUES);

  for (const stub of shuffledClues) {
    const hasMatch = stub.relatedWords.some((relatedWord) =>
      teamWords.some((teamWord) => teamWord.includes(relatedWord) || relatedWord.includes(teamWord))
    );

    if (hasMatch) {
      return stub;
    }
  }

  return null;
};

// ============================================
// AI SPYMASTER STUB
// ============================================

/**
 * TODO: Replace with real AI integration
 * 
 * API Call Structure:
 * ```
 * const response = await openai.chat.completions.create({
 *   model: "gpt-4",
 *   messages: [
 *     { role: "system", content: buildSpymasterPrompt(profile) },
 *     { role: "user", content: buildBoardContext(board, team, history) }
 *   ],
 *   response_format: { type: "json_object" }
 * });
 * return parseSpymasterResponse(response);
 * ```
 * 
 * The prompt should include:
 * - User's knowledge domains and clue preferences
 * - Risk tolerance for multi-word clues
 * - Board state with word categories
 * - Previous turns for context continuity
 */
export const aiSpymasterStub = (
  board: BoardState,
  team: Team,
  _profile?: UserProfile,
  _memory?: TurnEvent[]
): SpymasterResponse => {
  const teamWords = getUnrevealedWords(board, team).map((word) => word.toUpperCase());
  const matchingClue = findMatchingClue(teamWords);

  if (matchingClue) {
    return {
      clue: matchingClue.clue,
      number: Math.min(matchingClue.number, teamWords.length),
      reasoning: `Connecting words that relate to ${matchingClue.clue.toLowerCase()}`,
    };
  }

  return {
    clue: 'HINT',
    number: Math.min(DEFAULT_CLUE_NUMBER, teamWords.length),
    reasoning: 'A general clue to help identify our team words',
  };
};

// ============================================
// AI GUESSER STUB
// ============================================

interface GuessBuildResult {
  guesses: string[];
  shouldStop: boolean;
}

const tryPickMistakeWord = (
  guessIndex: number,
  neutralWords: string[],
  rivalWords: string[],
  assassinWords: string[],
  existingGuesses: string[]
): string | null => {
  const mistakeRoll = Math.random();
  const neutralChance = calculateMistakeChance(guessIndex);

  // Check for assassin first (rare but dramatic)
  if (mistakeRoll < ASSASSIN_MISTAKE_CHANCE && guessIndex >= 2) {
    const availableAssassins = assassinWords.filter((word) => !existingGuesses.includes(word));
    if (availableAssassins.length > 0) {
      return pickRandom(availableAssassins);
    }
  }

  // Check for neutral word mistake
  if (mistakeRoll < neutralChance) {
    const availableNeutrals = neutralWords.filter((word) => !existingGuesses.includes(word));

    if (availableNeutrals.length > 0) {
      return pickRandom(availableNeutrals);
    }
  }

  // Check for rival word mistake
  if (mistakeRoll < neutralChance + RIVAL_MISTAKE_CHANCE) {
    const availableRivals = rivalWords.filter((word) => !existingGuesses.includes(word));

    if (availableRivals.length > 0) {
      return pickRandom(availableRivals);
    }
  }

  return null;
};

const buildGuessesWithMistakes = (
  numToGuess: number,
  teamWords: string[],
  neutralWords: string[],
  rivalWords: string[],
  assassinWords: string[] = []
): GuessBuildResult => {
  const guesses: string[] = [];
  const shuffledTeamWords = shuffleArray(teamWords);

  for (let i = 0; i < numToGuess && i < shuffledTeamWords.length + 2; i++) {
    const mistakeWord = tryPickMistakeWord(i, neutralWords, rivalWords, assassinWords, guesses);

    if (mistakeWord) {
      guesses.push(mistakeWord);

      return { guesses, shouldStop: true };
    }

    const availableTeamWords = shuffledTeamWords.filter((word) => !guesses.includes(word));

    if (availableTeamWords.length > 0) {
      guesses.push(availableTeamWords[0]);
    } else {
      break;
    }
  }

  return { guesses, shouldStop: false };
};

const buildPerfectGuesses = (numToGuess: number, teamWords: string[]): string[] => {
  const shuffledTeamWords = shuffleArray(teamWords);

  return shuffledTeamWords.slice(0, numToGuess);
};

/**
 * TODO: Replace with real AI integration
 * 
 * API Call Structure:
 * ```
 * const response = await openai.chat.completions.create({
 *   model: "gpt-4",
 *   messages: [
 *     { role: "system", content: buildGuesserPrompt(profile) },
 *     { role: "user", content: buildGuessContext(clue, number, board, history) }
 *   ],
 *   response_format: { type: "json_object" }
 * });
 * return parseGuesserResponse(response);
 * ```
 * 
 * The AI should explain its reasoning for each guess, which can be
 * displayed to the user for transparency and trust-building.
 */
export const aiGuesserStub = (
  clue: string,
  clueNumber: number,
  board: BoardState,
  team: Team,
  _profile?: UserProfile,
  _memory?: TurnEvent[],
  allowMistakes = true
): GuesserResponse => {
  const rivalTeam = getRivalTeam(team);
  const teamWords = getUnrevealedWords(board, team);
  const neutralWords = getUnrevealedWords(board, 'neutral');
  const rivalWords = getUnrevealedWords(board, rivalTeam);
  const assassinWords = getUnrevealedWords(board, 'assassin');
  const numToGuess = Math.max(MIN_GUESSES, clueNumber);

  const guesses = allowMistakes
    ? buildGuessesWithMistakes(numToGuess, teamWords, neutralWords, rivalWords, assassinWords).guesses
    : buildPerfectGuesses(numToGuess, teamWords);

  const confidence = guesses.map((_, index) => calculateConfidence(index));

  return {
    guesses,
    confidence,
    reasoning: `Based on the clue "${clue}", I believe these words are most likely connected.`,
  };
};

// ============================================
// RIVAL TURN STUB
// ============================================

export interface RivalTurnResult {
  clue: string;
  number: number;
  guesses: string[];
}

/**
 * TODO: Replace with real AI integration
 * 
 * The rival AI should have a distinct "personality" from the teammate AI.
 * Consider:
 * - Different difficulty levels (easy/medium/hard)
 * - Different play styles (aggressive, conservative, tricky)
 * - The rival should not have access to user profile (it's an opponent)
 * 
 * For a more realistic experience, the rival's thinking delay
 * should match the complexity of the board state.
 */
export const rivalTurnStub = (board: BoardState, currentTeam: Team): RivalTurnResult => {
  const opponentTeam = getRivalTeam(currentTeam);
  const teamWords = getUnrevealedWords(board, currentTeam);
  const neutralWords = getUnrevealedWords(board, 'neutral');
  const opponentWords = getUnrevealedWords(board, opponentTeam);
  const assassinWords = getUnrevealedWords(board, 'assassin');

  if (teamWords.length === 0) {
    return { clue: 'PASS', number: 0, guesses: [] };
  }

  // Rival attempts 2-4 words for more interesting gameplay
  const minGuesses = Math.min(RIVAL_MIN_WORDS, teamWords.length);
  const maxGuesses = Math.min(RIVAL_MAX_WORDS, teamWords.length);
  const numToGuess = minGuesses + Math.floor(Math.random() * (maxGuesses - minGuesses + 1));
  
  const { guesses } = buildGuessesWithMistakes(numToGuess, teamWords, neutralWords, opponentWords, assassinWords);
  const clue = pickRandom(RIVAL_CLUE_OPTIONS);

  return {
    clue,
    number: numToGuess, // The clue number is the intended guesses, not actual
    guesses,
  };
};

// ============================================
// UTILITY EXPORTS FOR AI INTEGRATION
// ============================================

/**
 * TODO: Utility functions for future AI integration
 * 
 * These will be useful when building the actual AI prompts:
 */

export const boardStateToContext = (board: BoardState, team: Team): string => {
  const teamWords = getUnrevealedWords(board, team);
  const rivalTeam = getRivalTeam(team);
  const rivalWords = getUnrevealedWords(board, rivalTeam);
  const neutralWords = getUnrevealedWords(board, 'neutral');
  const assassinWords = getUnrevealedWords(board, 'assassin');

  return `
Your team's words (MUST GUESS): ${teamWords.join(', ')}
Opponent's words (AVOID): ${rivalWords.join(', ')}
Neutral words (OK but ends turn): ${neutralWords.join(', ')}
Assassin word (NEVER GUESS - instant loss): ${assassinWords.join(', ')}
  `.trim();
};

export const profileToPromptContext = (profile: UserProfile): string => {
  const parts: string[] = [];

  // Demographics
  if (profile.age) {
    parts.push(`Age range: ${profile.age}`);
  }

  if (profile.occupation) {
    parts.push(`Occupation: ${profile.occupation}`);
  }

  // Cognitive style
  if (profile.problemSolvingApproach) {
    parts.push(`Problem solving: ${profile.problemSolvingApproach}`);
  }

  // Interests
  if (profile.interests && profile.interests.length > 0) {
    parts.push(`Interests: ${profile.interests.join(', ')}`);
  }

  // Additional context
  if (profile.additionalNotes) {
    parts.push(`Additional notes: ${profile.additionalNotes}`);
  }

  return parts.join('\n');
};
