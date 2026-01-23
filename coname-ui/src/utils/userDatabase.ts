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
 * A single summary update entry
 */
export interface SummaryHistoryEntry {
  timestamp: number;
  summary: string;
  reason: string;  // Why was this update made
  trigger: 'initial' | 'game' | 'profile_change';
}

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
  
  // History of all summary updates with reasons
  summaryHistory?: SummaryHistoryEntry[];
  
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
    const users = data ? JSON.parse(data) : {};
    return users;
  } catch {
    console.error('❌ [USER DB] Error reading user database');
    return {};
  }
}

/**
 * Gets a user by email (primary key)
 */
export function getUser(email: string): UserRecord | null {
  const validation = validateEmail(email);
  if (!validation.valid) {
    console.error('❌ [USER DB] Invalid email:', validation.error);
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const users = getAllUsers();
  const user = users[normalizedEmail] || null;
  
  if (user) {
  } else {
  }
  
  return user;
}

/**
 * Creates or updates a user record from a profile
 * If user exists, updates profile fields but preserves llmSummary and metadata
 */
export function saveUser(profile: UserProfile): UserRecord | null {
  const validation = validateEmail(profile.email);
  if (!validation.valid) {
    console.error('❌ [USER DB] Cannot save user - invalid email:', validation.error);
    return null;
  }

  const normalizedEmail = normalizeEmail(profile.email);
  const users = getAllUsers();
  const existingUser = users[normalizedEmail];
  const now = Date.now();
  const isNewUser = !existingUser;

  // Determine the summary to use
  const newSummary = profile.llmSummary || existingUser?.llmSummary || '';
  
  // Build summary history
  let summaryHistory = existingUser?.summaryHistory || [];
  
  // If this is a NEW summary being set (initial summary), add to history
  if (profile.llmSummary && profile.llmSummary !== existingUser?.llmSummary) {
    const isInitialSummary = !existingUser?.llmSummary;
    summaryHistory = [
      ...summaryHistory,
      {
        timestamp: now,
        summary: profile.llmSummary,
        reason: isInitialSummary 
          ? 'Initial profile created - summary generated from user profile information'
          : 'Profile updated',
        trigger: isInitialSummary ? 'initial' : 'profile_change',
      } as SummaryHistoryEntry,
    ];
  }

  const userRecord: UserRecord = {
    email: normalizedEmail,
    age: profile.age,
    occupation: profile.occupation,
    problemSolvingApproach: profile.problemSolvingApproach,
    interests: profile.interests,
    additionalNotes: profile.additionalNotes,
    
    // Preserve existing summary and metadata, or initialize
    llmSummary: newSummary,
    summaryHistory,
    createdAt: existingUser?.createdAt || now,
    updatedAt: now,
    gamesPlayed: existingUser?.gamesPlayed || 0,
    lastGameAt: existingUser?.lastGameAt,
  };

  users[normalizedEmail] = userRecord;
  
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    if (userRecord.llmSummary) {
    } else {
    }
    return userRecord;
  } catch (error) {
    console.error('❌ [USER DB] Error saving user to database:', error);
    return null;
  }
}

/**
 * Updates the LLM summary for a user
 */
export function updateUserSummary(
  email: string, 
  newSummary: string, 
  reason: string = 'Summary updated',
  trigger: 'initial' | 'game' | 'profile_change' = 'game'
): boolean {
  const validation = validateEmail(email);
  if (!validation.valid) {
    console.error('❌ [USER DB] Cannot update summary - invalid email:', validation.error);
    return false;
  }

  const normalizedEmail = normalizeEmail(email);
  const users = getAllUsers();
  const user = users[normalizedEmail];

  if (!user) {
    console.error('❌ [USER DB] Cannot update summary - user not found:', normalizedEmail);
    return false;
  }

  const oldSummaryLength = user.llmSummary?.length || 0;
  
  // Add to history
  const historyEntry: SummaryHistoryEntry = {
    timestamp: Date.now(),
    summary: newSummary,
    reason,
    trigger,
  };
  
  user.summaryHistory = user.summaryHistory || [];
  user.summaryHistory.push(historyEntry);
  
  // Update current summary
  user.llmSummary = newSummary;
  user.updatedAt = Date.now();

  try {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    return true;
  } catch (error) {
    console.error('❌ [USER DB] Error updating user summary:', error);
    return false;
  }
}

/**
 * Gets the summary history for a user
 */
export function getSummaryHistory(email: string): SummaryHistoryEntry[] {
  const user = getUser(email);
  return user?.summaryHistory || [];
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

  const previousCount = user.gamesPlayed || 0;
  user.gamesPlayed = previousCount + 1;
  user.lastGameAt = Date.now();
  user.updatedAt = Date.now();

  try {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    return true;
  } catch {
    console.error('❌ [USER DB] Error recording game');
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

  const userData = users[normalizedEmail];
  delete users[normalizedEmail];

  try {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    if (userData.llmSummary) {
    }
    return true;
  } catch {
    console.error('❌ [USER DB] Error deleting user');
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

// ============================================
// CSV EXPORT/IMPORT
// ============================================

/**
 * Escapes a value for CSV (handles commas, quotes, newlines)
 */
function escapeCSV(value: string | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Exports all users to CSV format
 * Can be opened in Excel/Google Sheets for tracking
 */
export function exportUsersToCSV(): string {
  const users = getAllUsers();
  const userList = Object.values(users);
  
  if (userList.length === 0) {
    return '';
  }

  // CSV Header
  const headers = [
    'email',
    'age',
    'occupation',
    'problemSolvingApproach',
    'interests',
    'additionalNotes',
    'gamesPlayed',
    'createdAt',
    'updatedAt',
    'lastGameAt',
    'llmSummary'
  ];

  const rows = [headers.join(',')];

  // Data rows
  for (const user of userList) {
    const row = [
      escapeCSV(user.email),
      escapeCSV(user.age),
      escapeCSV(user.occupation),
      escapeCSV(user.problemSolvingApproach),
      escapeCSV(user.interests?.join('; ')), // Use semicolon for array items
      escapeCSV(user.additionalNotes),
      String(user.gamesPlayed || 0),
      user.createdAt ? new Date(user.createdAt).toISOString() : '',
      user.updatedAt ? new Date(user.updatedAt).toISOString() : '',
      user.lastGameAt ? new Date(user.lastGameAt).toISOString() : '',
      escapeCSV(user.llmSummary)
    ];
    rows.push(row.join(','));
  }

  const csv = rows.join('\n');
  return csv;
}

/**
 * Downloads the user database as a CSV file
 */
export function downloadUsersCSV(): void {
  const csv = exportUsersToCSV();
  if (!csv) {
    alert('No users to export');
    return;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `coname-users-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
}

/**
 * Gets all users formatted for display
 * Returns user data that can be viewed in console
 */
export function printAllUsers(): UserRecord[] {
  const users = getAllUsers();
  return Object.values(users);
}

/**
 * Gets database stats
 */
export function getDatabaseStats(): { totalUsers: number; usersWithSummary: number; totalGames: number } {
  const users = getAllUsers();
  const userList = Object.values(users);
  
  return {
    totalUsers: userList.length,
    usersWithSummary: userList.filter(u => u.llmSummary).length,
    totalGames: userList.reduce((sum, u) => sum + (u.gamesPlayed || 0), 0),
  };
}

// ============================================
// EXPOSE TO WINDOW FOR CONSOLE ACCESS
// ============================================

// Make database functions available in browser console
if (typeof window !== 'undefined') {
  (window as any).conameDB = {
    getAllUsers,
    getUser,
    saveUser,
    deleteUser,
    exportUsersToCSV,
    downloadUsersCSV,
    printAllUsers,
    getDatabaseStats,
  };
}

