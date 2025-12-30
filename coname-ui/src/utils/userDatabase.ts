/**
 * USER DATABASE SERVICE
 * =====================
 * 
 * Manages user profiles with persistent storage and LLM-powered learning summaries.
 * Uses email as the primary key (validated).
 * 
 * Features:
 * - Email validation (RFC 5322 compliant)
 * - CRUD operations for user records
 * - LLM summary generation after games
 * - Summary updates on profile changes
 */

import { UserProfile, TurnEvent, SurveyResponse, GameState } from '../types/game';

// ============================================
// TYPES
// ============================================

/**
 * Complete user record stored in the database
 */
export interface UserRecord {
  // Primary key - validated email
  email: string;
  
  // Profile fields from registration
  age?: string;
  occupation?: string;
  problemSolvingApproach?: 'systematic' | 'creative' | 'both' | '';
  interests?: string[];
  additionalNotes?: string;
  
  // LLM-generated summary - updated after each game and profile change
  // Contains insights about what works/doesn't work with this user
  llmSummary: string;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  gamesPlayed: number;
  lastGameAt?: number;
}

/**
 * Game session data for summary generation
 */
export interface GameSessionData {
  gameId: string;
  playerRole: 'spymaster' | 'guesser';
  playerTeam: 'red' | 'blue';
  won: boolean;
  turnHistory: TurnEvent[];
  surveyResponse?: SurveyResponse;
  userFeedback?: string; // Text feedback from user
  finalScore: {
    userTeam: number;
    rivalTeam: number;
  };
  startingTeam: 'teamA' | 'teamB';
}

// ============================================
// EMAIL VALIDATION
// ============================================

/**
 * Validates email address format (RFC 5322 compliant)
 * More strict than basic regex - checks for common edge cases
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }

  // Trim and lowercase
  const normalizedEmail = email.trim().toLowerCase();

  // Length checks
  if (normalizedEmail.length > 254) {
    return { valid: false, error: 'Email address is too long' };
  }

  // RFC 5322 compliant regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(normalizedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Check for valid domain structure
  const [, domain] = normalizedEmail.split('@');
  if (!domain || !domain.includes('.')) {
    return { valid: false, error: 'Invalid domain in email address' };
  }

  // Check TLD length
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return { valid: false, error: 'Invalid top-level domain' };
  }

  return { valid: true };
}

/**
 * Normalizes email for consistent storage (lowercase, trimmed)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ============================================
// DATABASE OPERATIONS
// ============================================

const DB_KEY = 'coname-user-database';

/**
 * Gets all users from the database
 */
export function getAllUsers(): Record<string, UserRecord> {
  try {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    console.error('Error reading user database');
    return {};
  }
}

/**
 * Gets a user by email (primary key)
 */
export function getUser(email: string): UserRecord | null {
  const validation = validateEmail(email);
  if (!validation.valid) {
    console.error('Invalid email:', validation.error);
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const users = getAllUsers();
  return users[normalizedEmail] || null;
}

/**
 * Creates or updates a user record from a profile
 * If user exists, updates profile fields but preserves llmSummary and metadata
 */
export function saveUser(profile: UserProfile): UserRecord | null {
  const validation = validateEmail(profile.email);
  if (!validation.valid) {
    console.error('Cannot save user - invalid email:', validation.error);
    return null;
  }

  const normalizedEmail = normalizeEmail(profile.email);
  const users = getAllUsers();
  const existingUser = users[normalizedEmail];
  const now = Date.now();

  const userRecord: UserRecord = {
    email: normalizedEmail,
    age: profile.age,
    occupation: profile.occupation,
    problemSolvingApproach: profile.problemSolvingApproach,
    interests: profile.interests,
    additionalNotes: profile.additionalNotes,
    
    // Preserve existing summary and metadata, or initialize
    llmSummary: existingUser?.llmSummary || '',
    createdAt: existingUser?.createdAt || now,
    updatedAt: now,
    gamesPlayed: existingUser?.gamesPlayed || 0,
    lastGameAt: existingUser?.lastGameAt,
  };

  users[normalizedEmail] = userRecord;
  
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    console.log(`✅ [USER DB] Saved user: ${normalizedEmail}`);
    return userRecord;
  } catch (error) {
    console.error('Error saving user to database:', error);
    return null;
  }
}

/**
 * Updates the LLM summary for a user
 */
export function updateUserSummary(email: string, newSummary: string): boolean {
  const validation = validateEmail(email);
  if (!validation.valid) {
    console.error('Cannot update summary - invalid email:', validation.error);
    return false;
  }

  const normalizedEmail = normalizeEmail(email);
  const users = getAllUsers();
  const user = users[normalizedEmail];

  if (!user) {
    console.error('Cannot update summary - user not found:', normalizedEmail);
    return false;
  }

  user.llmSummary = newSummary;
  user.updatedAt = Date.now();

  try {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    console.log(`✅ [USER DB] Updated summary for: ${normalizedEmail}`);
    return true;
  } catch (error) {
    console.error('Error updating user summary:', error);
    return false;
  }
}

/**
 * Records that a game was played by a user
 */
export function recordGamePlayed(email: string): boolean {
  const validation = validateEmail(email);
  if (!validation.valid) return false;

  const normalizedEmail = normalizeEmail(email);
  const users = getAllUsers();
  const user = users[normalizedEmail];

  if (!user) return false;

  user.gamesPlayed = (user.gamesPlayed || 0) + 1;
  user.lastGameAt = Date.now();
  user.updatedAt = Date.now();

  try {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes a user from the database
 */
export function deleteUser(email: string): boolean {
  const validation = validateEmail(email);
  if (!validation.valid) return false;

  const normalizedEmail = normalizeEmail(email);
  const users = getAllUsers();

  if (!users[normalizedEmail]) {
    return false;
  }

  delete users[normalizedEmail];

  try {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    console.log(`🗑️ [USER DB] Deleted user: ${normalizedEmail}`);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Checks if a user exists in the database
 */
export function userExists(email: string): boolean {
  return getUser(email) !== null;
}

/**
 * Gets user's LLM summary (for AI agents to use)
 */
export function getUserSummary(email: string): string {
  const user = getUser(email);
  return user?.llmSummary || '';
}

/**
 * Extracts game session data from a completed game state
 */
export function extractGameSessionData(
  game: GameState,
  userFeedback?: string,
  surveyResponse?: SurveyResponse
): GameSessionData {
  const userTeam = game.settings.playerTeam === 'red' ? 'teamA' : 'teamB';
  const won = game.winner === userTeam;

  return {
    gameId: game.id,
    playerRole: game.settings.playerRole,
    playerTeam: game.settings.playerTeam,
    won,
    turnHistory: game.turnHistory,
    surveyResponse,
    userFeedback,
    finalScore: {
      userTeam: userTeam === 'teamA' 
        ? (9 - game.board.teamARemaining) 
        : (8 - game.board.teamBRemaining),
      rivalTeam: userTeam === 'teamA' 
        ? (8 - game.board.teamBRemaining) 
        : (9 - game.board.teamARemaining),
    },
    startingTeam: game.startingTeam || 'teamA',
  };
}

/**
 * Gets the full context for AI agents (profile + summary)
 */
export function getUserContext(email: string): { profile: UserProfile; summary: string } | null {
  const user = getUser(email);
  if (!user) return null;

  return {
    profile: {
      email: user.email,
      age: user.age,
      occupation: user.occupation,
      problemSolvingApproach: user.problemSolvingApproach,
      interests: user.interests,
      additionalNotes: user.additionalNotes,
    },
    summary: user.llmSummary,
  };
}

