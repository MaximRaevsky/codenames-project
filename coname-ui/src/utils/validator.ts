/**
 * CLUE VALIDATION
 * ================
 * 
 * TODO: AI-Enhanced Validation
 * ----------------------------
 * 
 * Current implementation does basic checks:
 * - Empty clue
 * - Multiple words
 * - Exact match with board words
 * - Partial matches (warning only)
 * - Minimum length
 * - Numbers only
 * 
 * Future AI integration should add:
 * 
 * 1. SEMANTIC SIMILARITY CHECK
 *    - Use embeddings to check if clue is too similar to board words
 *    - Example: "AUTOMOBILE" should be flagged for "CAR" on board
 *    - Threshold can be tuned based on difficulty setting
 * 
 * 2. COMPOUND WORD DETECTION
 *    - Detect if clue is a compound of board words
 *    - Example: "SUNFLOWER" when "SUN" and "FLOWER" are on board
 * 
 * 3. PROPER NOUN VALIDATION
 *    - Check if clue is a proper noun (allowed but flagged)
 *    - Consider profile.culturalContext for regional names
 * 
 * 4. FOREIGN WORD DETECTION
 *    - If profile.language is set, check for foreign words
 *    - May want to warn or disallow based on game rules
 * 
 * 5. OFFENSIVE CONTENT CHECK
 *    - Use moderation API to flag inappropriate clues
 */

import { ValidationResult, WordCard } from '../types/game';

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Validates a spymaster's clue
 * 
 * TODO: Add optional async version for AI-enhanced validation
 * 
 * @param clue - The clue word to validate
 * @param boardWords - All words currently on the board
 * @returns ValidationResult with valid flag and optional reason
 */
export function validateClue(
  clue: string,
  boardWords: WordCard[]
): ValidationResult {
  const trimmedClue = clue.trim();
  
  // Check if empty
  if (!trimmedClue) {
    return {
      valid: false,
      reason: 'Clue cannot be empty. Please enter a word.',
    };
  }

  // Check for multiple words (allow hyphenated words)
  const words = trimmedClue.split(/\s+/);
  if (words.length > 1) {
    return {
      valid: false,
      reason: 'Clue must be a single word. No spaces allowed (hyphenated words like "ice-cream" are okay).',
    };
  }

  // Check if clue matches any board word (case-insensitive)
  const clueUpper = trimmedClue.toUpperCase();
  const matchingWord = boardWords.find(
    card => card.word.toUpperCase() === clueUpper
  );
  
  if (matchingWord) {
    return {
      valid: false,
      reason: `"${trimmedClue}" is on the board! Your clue cannot match any board word.`,
    };
  }

  // Check for partial matches (warning only - not invalid)
  // TODO: Replace with semantic similarity check using embeddings
  const partialMatch = boardWords.find(card => {
    const wordUpper = card.word.toUpperCase();
    return (
      wordUpper.includes(clueUpper) || 
      clueUpper.includes(wordUpper)
    );
  });

  if (partialMatch && partialMatch.word.toUpperCase() !== clueUpper) {
    return {
      valid: true,
      reason: `Warning: "${trimmedClue}" contains or is contained in "${partialMatch.word}". This is allowed but may be too obvious.`,
    };
  }

  // Check minimum length
  if (trimmedClue.length < 2) {
    return {
      valid: false,
      reason: 'Clue must be at least 2 characters long.',
    };
  }

  // Check for numbers only
  if (/^\d+$/.test(trimmedClue)) {
    return {
      valid: false,
      reason: 'Clue cannot be just a number.',
    };
  }

  return { valid: true };
}

// ============================================
// NUMBER VALIDATION
// ============================================

/**
 * Validates the number portion of a clue
 * 
 * @param number - The number of words the clue relates to (-1 for infinity)
 * @param maxPossible - Maximum valid number (remaining team words)
 * @returns ValidationResult
 */
export function validateClueNumber(
  number: number,
  maxPossible: number
): ValidationResult {
  // -1 represents infinity, which is always valid
  if (number === -1) {
    return { valid: true };
  }

  if (!Number.isInteger(number)) {
    return {
      valid: false,
      reason: 'Number must be a whole number.',
    };
  }

  if (number < 0) {
    return {
      valid: false,
      reason: 'Number cannot be negative.',
    };
  }

  if (number === 0) {
    return {
      valid: true,
      reason: 'Giving 0 means unlimited guesses (risky strategy).',
    };
  }

  if (number > maxPossible) {
    return {
      valid: false,
      reason: `You only have ${maxPossible} words remaining. Choose a smaller number.`,
    };
  }

  return { valid: true };
}

// ============================================
// FUTURE: AI-ENHANCED VALIDATION
// ============================================

/**
 * TODO: Implement AI-enhanced validation
 * 
 * export async function validateClueWithAI(
 *   clue: string,
 *   boardWords: WordCard[],
 *   profile: UserProfile
 * ): Promise<ValidationResult> {
 *   // First run basic validation
 *   const basicResult = validateClue(clue, boardWords);
 *   if (!basicResult.valid) return basicResult;
 *   
 *   // Then check semantic similarity using embeddings
 *   const embeddings = await getEmbeddings([clue, ...boardWords.map(w => w.word)]);
 *   const clueEmbedding = embeddings[0];
 *   const wordEmbeddings = embeddings.slice(1);
 *   
 *   for (let i = 0; i < wordEmbeddings.length; i++) {
 *     const similarity = cosineSimilarity(clueEmbedding, wordEmbeddings[i]);
 *     if (similarity > SIMILARITY_THRESHOLD) {
 *       return {
 *         valid: false,
 *         reason: `"${clue}" is too similar to "${boardWords[i].word}" on the board.`,
 *       };
 *     }
 *   }
 *   
 *   return { valid: true };
 * }
 */
