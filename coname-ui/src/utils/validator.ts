/**
 * CLUE VALIDATION
 * ================
 * 
 * Validates clues using both local rules and AI-powered semantic checking.
 * 
 * Local validation (fast):
 * - Empty clue
 * - Multiple words
 * - Exact match with board words
 * - Partial matches (warning only)
 * - Minimum length
 * - Numbers only
 * 
 * AI validation (via Gemini):
 * - Semantic similarity check
 * - Compound word detection
 * - Derivative form detection
 */

import { ValidationResult, WordCard } from '../types/game';
import { validateClueWithAI } from './ai-agents';

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

  // Check for partial matches - INVALID if clue contains or is contained in a board word
  const partialMatch = boardWords.find(card => {
    const wordUpper = card.word.toUpperCase();
    // Check if one contains the other (and they're different words)
    if (wordUpper !== clueUpper) {
      if (wordUpper.includes(clueUpper) && clueUpper.length >= 3) {
        return true; // Board word contains the clue (e.g., SCIENCE on board, clue is SCI)
      }
      if (clueUpper.includes(wordUpper) && wordUpper.length >= 3) {
        return true; // Clue contains board word (e.g., SCIENTIST as clue, SCIENCE on board)
      }
    }
    return false;
  });

  if (partialMatch) {
    const wordUpper = partialMatch.word.toUpperCase();
    if (clueUpper.includes(wordUpper)) {
      return {
        valid: false,
        reason: `Your clue "${trimmedClue}" contains the board word "${partialMatch.word}". Try a different word that doesn't include any board word inside it.`,
      };
    } else {
      return {
        valid: false,
        reason: `The board word "${partialMatch.word}" contains your clue "${trimmedClue}". Try a different word.`,
      };
    }
  }
  
  // Check for suffix/root forms (e.g., RUN/RUNNING, SCIENCE/SCIENTIST)
  const suffixes = ['S', 'ES', 'ED', 'ING', 'ER', 'EST', 'LY', 'TION', 'IST', 'ISM', 'MENT', 'NESS', 'ABLE', 'IBLE', 'FUL', 'LESS'];
  const suffixMatch = boardWords.find(card => {
    const wordUpper = card.word.toUpperCase();
    if (wordUpper === clueUpper) return false;
    
    for (const suf of suffixes) {
      // Clue is word + suffix (e.g., clue RUNS, word RUN)
      if (clueUpper === wordUpper + suf) return true;
      // Word is clue + suffix (e.g., clue RUN, word RUNNING)
      if (wordUpper === clueUpper + suf) return true;
      // Remove suffix and compare roots
      if (clueUpper.endsWith(suf) && clueUpper.slice(0, -suf.length) === wordUpper) return true;
      if (wordUpper.endsWith(suf) && wordUpper.slice(0, -suf.length) === clueUpper) return true;
    }
    return false;
  });

  if (suffixMatch) {
    return {
      valid: false,
      reason: `Your clue "${trimmedClue}" is too similar to "${suffixMatch.word}" on the board (they share the same root). Try a completely different word.`,
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
// AI-ENHANCED VALIDATION
// ============================================

/**
 * Validates a clue using AI for semantic checking
 * Falls back to local validation on API error
 */
export async function validateClueAsync(
  clue: string,
  boardWords: WordCard[]
): Promise<ValidationResult> {
  // First run basic local validation
  const basicResult = validateClue(clue, boardWords);
  if (!basicResult.valid) {
    return basicResult;
  }

  // Then run AI validation for semantic checks
  try {
    const wordStrings = boardWords.map(w => w.word);
    const aiResult = await validateClueWithAI(clue, wordStrings);
    return aiResult;
  } catch (error) {
    console.error('AI validation failed, using local result:', error);
    return basicResult;
  }
}
