/**
 * SUMMARY GENERATION AGENT
 * =========================
 * 
 * LLM-powered agent that generates and updates user learning summaries.
 * Analyzes game sessions to identify patterns that work/don't work with each user.
 * 
 * The summary helps AI agents personalize their behavior for each user:
 * - What types of clues resonate with this user
 * - Their risk tolerance and play style
 * - Common misunderstandings or patterns
 * - Interests that can be leveraged for better clues
 */

import { callAgent, parseAgentJson } from './openai-client';
import { 
  UserRecord, 
  GameSessionData, 
  updateUserSummary, 
  getUser,
  recordGamePlayed 
} from './userDatabase';
import { UserProfile } from '../types/game';

// ============================================
// TYPES
// ============================================

interface SummaryUpdateResponse {
  summary: string;
  keyInsights?: string[];
}

// ============================================
// PROMPT BUILDERS
// ============================================

function buildSummarySystemPrompt(): string {
  return `You are an AI analyst that creates concise player profiles for a Codenames game AI.

Your job is to analyze a player's game performance and create/update a summary that helps AI agents play better with this specific user.

IMPORTANT GUIDELINES:
1. Keep the summary CONCISE - maximum 3-4 short paragraphs
2. Focus ONLY on actionable insights that help AI agents:
   - What type of clues work well with this user
   - Their risk tolerance (conservative vs aggressive)
   - Common patterns in their successful/failed guesses
   - Interests or knowledge domains to leverage
   - Communication style preferences
3. Be SPECIFIC - avoid generic statements
4. If user feedback is provided, weigh it heavily
5. Look for PATTERNS across multiple games (if previous summary exists)
6. Don't include game-specific details - focus on generalizable patterns

OUTPUT FORMAT:
Return JSON with:
{
  "summary": "The updated summary (3-4 paragraphs max)",
  "keyInsights": ["Bullet point insight 1", "Bullet point insight 2", ...]
}`;
}

function buildSummaryUserPrompt(
  user: UserRecord,
  gameSession: GameSessionData,
  previousSummary?: string
): string {
  // Build turn analysis
  const turnAnalysis = gameSession.turnHistory.map((turn, idx) => {
    const isUserTurn = (gameSession.playerTeam === 'red' && turn.team === 'teamA') ||
                       (gameSession.playerTeam === 'blue' && turn.team === 'teamB');
    
    if (!isUserTurn) return null;

    const correctGuesses = turn.guessResults.filter(r => r.correct).length;
    const totalGuesses = turn.guessResults.length;
    const hitAssassin = turn.guessResults.some(r => r.category === 'assassin');
    const hitRival = turn.guessResults.some(r => 
      r.category === (gameSession.playerTeam === 'red' ? 'teamB' : 'teamA')
    );

    return `Turn ${idx + 1}:
  - Clue: "${turn.clue}" for ${turn.clueNumber}
  - Guesses: ${turn.guessResults.map(r => `${r.word} (${r.correct ? '✓' : '✗ ' + r.category})`).join(', ')}
  - Result: ${correctGuesses}/${totalGuesses} correct${hitAssassin ? ' [HIT ASSASSIN!]' : ''}${hitRival ? ' [hit rival word]' : ''}`;
  }).filter(Boolean).join('\n');

  // Build feedback section
  let feedbackSection = '';
  if (gameSession.surveyResponse || gameSession.userFeedback) {
    feedbackSection = '\n\n--- USER FEEDBACK ---\n';
    
    if (gameSession.surveyResponse) {
      feedbackSection += `Trust in AI: ${gameSession.surveyResponse.trustInAI}/7\n`;
      feedbackSection += `Clue Clarity: ${gameSession.surveyResponse.clueClarity}/7\n`;
      if (gameSession.surveyResponse.aiGuessAccuracy) {
        feedbackSection += `AI Guess Accuracy Rating: ${gameSession.surveyResponse.aiGuessAccuracy}/7\n`;
      }
    }
    
    if (gameSession.userFeedback) {
      feedbackSection += `\nUser's Written Feedback:\n"${gameSession.userFeedback}"`;
    }
  }

  // Build previous summary section
  const previousSection = previousSummary 
    ? `\n\n--- PREVIOUS SUMMARY (update this based on new game) ---\n${previousSummary}`
    : '\n\n--- NO PREVIOUS SUMMARY (this is their first game) ---';

  return `Analyze this player's game session and ${previousSummary ? 'UPDATE' : 'CREATE'} their summary.

--- PLAYER PROFILE ---
Email: ${user.email}
Age: ${user.age || 'Not specified'}
Occupation: ${user.occupation || 'Not specified'}
Problem Solving: ${user.problemSolvingApproach || 'Not specified'}
Interests: ${user.interests?.join(', ') || 'None specified'}
Additional Notes: ${user.additionalNotes || 'None'}
Games Played: ${user.gamesPlayed + 1}

--- GAME SESSION ---
Role: ${gameSession.playerRole.toUpperCase()}
Team: ${gameSession.playerTeam.toUpperCase()}
Outcome: ${gameSession.won ? 'WON' : 'LOST'}
Final Score: User ${gameSession.finalScore.userTeam} - Rival ${gameSession.finalScore.rivalTeam}

--- TURN-BY-TURN ANALYSIS (User's team only) ---
${turnAnalysis || 'No turns recorded'}
${feedbackSection}
${previousSection}

Based on this game session, ${previousSummary ? 'update the summary to incorporate new patterns and insights' : 'create an initial summary'}. 
Focus on what helps AI agents play better with this user.`;
}

function buildProfileUpdatePrompt(
  user: UserRecord,
  previousSummary: string
): string {
  return `The user has updated their profile. Review if any summary updates are needed.

--- UPDATED PROFILE ---
Email: ${user.email}
Age: ${user.age || 'Not specified'}
Occupation: ${user.occupation || 'Not specified'}
Problem Solving: ${user.problemSolvingApproach || 'Not specified'}
Interests: ${user.interests?.join(', ') || 'None specified'}
Additional Notes: ${user.additionalNotes || 'None'}
Games Played: ${user.gamesPlayed}

--- CURRENT SUMMARY ---
${previousSummary || 'No summary yet'}

Update the summary ONLY if the profile changes suggest relevant adjustments for how AI should interact with this user. If interests changed, note how this might affect clue strategies. If problem-solving approach changed, note implications for clue complexity.

Keep the summary concise (3-4 paragraphs max). If no meaningful updates needed, return the existing summary unchanged.`;
}

// ============================================
// SUMMARY GENERATION
// ============================================

/**
 * Generates or updates user summary after a game ends
 * This is the main function called at end of each game
 */
export async function updateSummaryAfterGame(
  email: string,
  gameSession: GameSessionData
): Promise<string | null> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 [SUMMARY AGENT] Generating summary update for:', email);
  console.log('📊 [SUMMARY AGENT] Game outcome:', gameSession.won ? 'WIN' : 'LOSS');
  console.log('📊 [SUMMARY AGENT] Player role:', gameSession.playerRole);

  const user = getUser(email);
  if (!user) {
    console.error('❌ [SUMMARY AGENT] User not found:', email);
    return null;
  }

  // Record that a game was played
  recordGamePlayed(email);

  try {
    const systemPrompt = buildSummarySystemPrompt();
    const userPrompt = buildSummaryUserPrompt(user, gameSession, user.llmSummary);

    console.log('📊 [SUMMARY AGENT] Sending to AI for analysis...');
    
    const response = await callAgent(systemPrompt, userPrompt, {
      temperature: 0.4, // Lower temperature for consistent analysis
      maxTokens: 2048,
      jsonMode: true,
    });

    console.log('📊 [SUMMARY AGENT] Raw response:', response);
    const parsed = parseAgentJson<SummaryUpdateResponse>(response);

    if (!parsed.summary) {
      console.error('❌ [SUMMARY AGENT] Invalid response - no summary field');
      return null;
    }

    // Enforce length limit (max ~500 words)
    let summary = parsed.summary;
    const wordCount = summary.split(/\s+/).length;
    if (wordCount > 500) {
      console.warn('⚠️ [SUMMARY AGENT] Summary too long, truncating...');
      // Take first 500 words approximately
      summary = summary.split(/\s+/).slice(0, 500).join(' ') + '...';
    }

    // Update the database
    const success = updateUserSummary(email, summary);
    
    if (success) {
      console.log('✅ [SUMMARY AGENT] Summary updated successfully');
      console.log('📋 Key insights:', parsed.keyInsights?.join(', ') || 'None extracted');
      console.log('═══════════════════════════════════════════════════════════');
      return summary;
    } else {
      console.error('❌ [SUMMARY AGENT] Failed to save summary to database');
      return null;
    }
  } catch (error) {
    console.error('❌ [SUMMARY AGENT] Error generating summary:', error);
    return null;
  }
}

/**
 * Updates summary when user modifies their profile
 * Less intensive than game update - only adjusts if profile changes are significant
 */
export async function updateSummaryOnProfileChange(
  email: string
): Promise<string | null> {
  console.log('📊 [SUMMARY AGENT] Profile changed, checking if summary update needed:', email);

  const user = getUser(email);
  if (!user || !user.llmSummary) {
    // No existing summary to update
    console.log('📊 [SUMMARY AGENT] No existing summary to update');
    return null;
  }

  try {
    const systemPrompt = buildSummarySystemPrompt();
    const userPrompt = buildProfileUpdatePrompt(user, user.llmSummary);

    const response = await callAgent(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: 1024,
      jsonMode: true,
    });

    const parsed = parseAgentJson<SummaryUpdateResponse>(response);

    if (!parsed.summary) {
      return null;
    }

    // Only update if summary actually changed
    if (parsed.summary !== user.llmSummary) {
      const success = updateUserSummary(email, parsed.summary);
      if (success) {
        console.log('✅ [SUMMARY AGENT] Summary updated after profile change');
        return parsed.summary;
      }
    } else {
      console.log('📊 [SUMMARY AGENT] No summary changes needed');
    }

    return user.llmSummary;
  } catch (error) {
    console.error('❌ [SUMMARY AGENT] Error updating summary on profile change:', error);
    return null;
  }
}

/**
 * Gets formatted summary for AI agents to use in their prompts
 */
export function getSummaryForAI(email: string): string {
  const user = getUser(email);
  if (!user || !user.llmSummary) {
    return '';
  }

  return `
--- PLAYER LEARNING SUMMARY (${user.gamesPlayed} games played) ---
${user.llmSummary}
--- END SUMMARY ---
`;
}

/**
 * Quick check if a user has a summary (for conditional logic)
 */
export function hasSummary(email: string): boolean {
  const user = getUser(email);
  return !!(user && user.llmSummary && user.llmSummary.length > 0);
}

