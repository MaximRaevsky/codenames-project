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

// Re-export types for convenience
export type { GameSessionData } from './userDatabase';

// ============================================
// TYPES
// ============================================

interface SummaryUpdateResponse {
  summary: string;
  keyInsights?: string[];
  updateReason?: string;  // Brief explanation of what changed and why
}

// ============================================
// PROMPT BUILDERS
// ============================================

function buildSummarySystemPrompt(): string {
  return `You are an AI analyst creating actionable player profiles for Codenames.

YOUR GOAL: Create a CONCISE, ACTIONABLE summary that helps AI agents play better with this user.

WRITE 3-5 SHORT BULLET POINTS (max 80 words total):
• Works: [Category of clues that succeed - e.g., "literal/concrete associations", "pop culture references", "technical terms"]
• Avoid: [Category of clues that fail - e.g., "abstract metaphors", "historical references", "wordplay/puns"]
• Style: [How they think - e.g., "methodical, guesses safest first", "takes risks on 3rd guess", "overthinks simple clues"]

LEVEL OF DETAIL:
❌ TOO SPECIFIC: "MUSIC→PIANO worked, BIRDS→SATELLITE worked" (don't list examples)
❌ TOO VAGUE: "confusion over connections" or "needs clearer clues" (meaningless)
✅ JUST RIGHT: "Succeeds with concrete/tangible associations, struggles with abstract or metaphorical connections"

Each bullet should be a PATTERN, not a list of examples.
Focus on what the AI should DO DIFFERENTLY with this user.

OUTPUT FORMAT:
{
  "summary": "3-5 bullet points, max 80 words",
  "keyInsights": ["one key insight"],
  "updateReason": "What pattern was learned from this game"
}`;
}

function buildSummaryUserPrompt(
  user: UserRecord,
  gameSession: GameSessionData,
  previousSummary?: string
): string {
  // Build DETAILED turn analysis
  const turnAnalysis = gameSession.turnHistory.map((turn, idx) => {
    const isUserTurn = (gameSession.playerTeam === 'red' && turn.team === 'teamA') ||
                       (gameSession.playerTeam === 'blue' && turn.team === 'teamB');
    
    if (!isUserTurn) return null;

    const correctGuesses = turn.guessResults.filter(r => r.correct);
    const wrongGuesses = turn.guessResults.filter(r => !r.correct);
    const hitAssassin = turn.guessResults.some(r => r.category === 'assassin');

    let analysis = `\nTurn ${idx + 1}: Clue "${turn.clue}" for ${turn.clueNumber}`;
    
    if (correctGuesses.length > 0) {
      analysis += `\n  ✓ CORRECT: ${correctGuesses.map(r => r.word).join(', ')}`;
      analysis += `\n    → What worked: Clue "${turn.clue}" successfully connected to these words`;
    }
    
    if (wrongGuesses.length > 0) {
      for (const wrong of wrongGuesses) {
        analysis += `\n  ✗ WRONG: "${wrong.word}" (was ${wrong.category === 'neutral' ? 'NEUTRAL' : wrong.category === 'assassin' ? 'ASSASSIN!' : 'RIVAL'})`;
        analysis += `\n    → Why failed: User thought "${turn.clue}" connected to "${wrong.word}" but it didn't`;
      }
    }
    
    if (hitAssassin) {
      analysis += `\n  🚫 CRITICAL: Hit ASSASSIN - clue "${turn.clue}" led to fatal mistake`;
    }

    return analysis;
  }).filter(Boolean).join('\n');

  // Build feedback section - THIS IS MOST IMPORTANT
  let feedbackSection = '';
  if (gameSession.surveyResponse || gameSession.userFeedback) {
    feedbackSection = '\n\n=== USER FEEDBACK (PRIORITIZE THIS) ===\n';
    
    if (gameSession.surveyResponse) {
      feedbackSection += `Trust in AI: ${gameSession.surveyResponse.trustInAI}/7\n`;
      feedbackSection += `Clue Clarity: ${gameSession.surveyResponse.clueClarity}/7\n`;
      if (gameSession.surveyResponse.aiGuessAccuracy) {
        feedbackSection += `AI Guess Accuracy Rating: ${gameSession.surveyResponse.aiGuessAccuracy}/7\n`;
      }
    }
    
    if (gameSession.userFeedback) {
      feedbackSection += `\n⭐ USER'S OWN WORDS (most important):\n"${gameSession.userFeedback}"`;
    }
  }

  // Build previous summary section
  const previousSection = previousSummary 
    ? `\n\n=== PREVIOUS SUMMARY (update with new patterns) ===\n${previousSummary}`
    : '';

  return `ANALYZE this game and ${previousSummary ? 'UPDATE' : 'CREATE'} a SPECIFIC player summary.

=== PLAYER INFO ===
Occupation: ${user.occupation || 'Unknown'}
Interests: ${user.interests?.join(', ') || 'Unknown'}
Problem Solving: ${user.problemSolvingApproach || 'Unknown'}
Notes: ${user.additionalNotes || 'None'}
Total Games: ${user.gamesPlayed + 1}

=== THIS GAME ===
Role: ${gameSession.playerRole.toUpperCase()} | Result: ${gameSession.won ? 'WON' : 'LOST'}
Score: User ${gameSession.finalScore.userTeam} - Rival ${gameSession.finalScore.rivalTeam}

=== DETAILED GUESS ANALYSIS ===
${turnAnalysis || 'No guesses recorded'}
${feedbackSection}
${previousSection}

TASK: Create a SPECIFIC summary about THIS user's patterns.
- What SPECIFIC clue→word connections worked?
- What SPECIFIC clue→word connections FAILED and why?
- What does their feedback tell us?
- What should AI do differently next time?

DO NOT write generic advice. Write patterns SPECIFIC to this user's actual guesses.`;
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

    // Ensure summary is a string (AI might return an object like {Works, Fails, Domains, Pattern, Feedback})
    let summary: string;
    if (typeof parsed.summary === 'string') {
      summary = parsed.summary;
    } else if (typeof parsed.summary === 'object' && parsed.summary !== null) {
      // Convert structured object to bullet point format
      const obj = parsed.summary as Record<string, unknown>;
      summary = Object.entries(obj)
        .map(([key, value]) => `• ${key}: ${value}`)
        .join('\n');
    } else {
      summary = String(parsed.summary);
    }
    
    // Enforce length limit (max ~120 words for concise summaries)
    const wordCount = summary.split(/\s+/).length;
    if (wordCount > 120) {
      console.warn('⚠️ [SUMMARY AGENT] Summary too long (' + wordCount + ' words), truncating to 120...');
      summary = summary.split(/\s+/).slice(0, 120).join(' ') + '...';
    }

    // Build the update reason
    const gameOutcome = gameSession.won ? 'Won' : 'Lost';
    const defaultReason = `Game ${gameOutcome} as ${gameSession.playerRole}. ${parsed.keyInsights?.[0] || 'Patterns updated.'}`;
    const updateReason = parsed.updateReason || defaultReason;

    // Update the database with reason and trigger
    const success = updateUserSummary(email, summary, updateReason, 'game');
    
    if (success) {
      console.log('✅ [SUMMARY AGENT] Summary updated successfully');
      console.log('📋 Key insights:', parsed.keyInsights?.join(', ') || 'None extracted');
      console.log('📝 Update reason:', updateReason);
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
      const updateReason = parsed.updateReason || 'Profile information updated by user';
      const success = updateUserSummary(email, parsed.summary, updateReason, 'profile_change');
      if (success) {
        console.log('✅ [SUMMARY AGENT] Summary updated after profile change');
        console.log('📝 Update reason:', updateReason);
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

/**
 * Updates summary from a UserProfile object
 * Syncs the profile's llmSummary with the database
 */
export function syncProfileSummary(profile: UserProfile): void {
  if (!profile.email) return;
  
  const user = getUser(profile.email);
  if (user && profile.llmSummary && profile.llmSummary !== user.llmSummary) {
    updateUserSummary(profile.email, profile.llmSummary, 'Manual profile sync', 'profile_change');
  }
}

/**
 * Generates an initial summary when user first creates their profile
 * This creates a starting point for the AI to understand the user before any games
 */
export async function generateInitialSummary(profile: UserProfile): Promise<string | null> {
  if (!profile.email) return null;
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 [SUMMARY AGENT] Generating INITIAL summary from profile...');
  console.log('📊 [SUMMARY AGENT] User:', profile.email);

  try {
    const systemPrompt = `Create an initial player profile for Codenames AI (MAX 60 words, 3-4 bullet points).

Based on their profile, suggest clue strategies:

FORMAT (short bullets, no examples):
• Domains: [Categories they likely know well based on interests/job]
• Style: [How they might think - systematic vs creative]
• Notes: [Any special considerations from their profile]

Keep it GENERAL - we'll learn specifics from actual games.

OUTPUT: {"summary": "3-4 short bullet points", "keyInsights": ["one insight"]}`;

    // Build interests with labels
    const interestLabels: Record<string, string> = {
      'technology': 'Technology 💻',
      'science': 'Science 🔬',
      'arts': 'Arts & Culture 🎨',
      'sports': 'Sports ⚽',
      'music': 'Music 🎵',
      'movies': 'Movies & TV 🎬',
      'gaming': 'Gaming 🎮',
      'travel': 'Travel ✈️',
      'food': 'Food & Cooking 🍳',
      'history': 'History 📜',
      'nature': 'Nature 🌿',
      'business': 'Business 💼',
    };

    const interestsFormatted = profile.interests?.map(i => interestLabels[i] || i).join(', ') || 'None specified';

    const approachLabels: Record<string, string> = {
      'systematic': 'Systematic (step by step, logical)',
      'creative': 'Creative (out of the box, unconventional)',
      'both': 'Flexible (mix of both systematic and creative)',
    };

    const userPrompt = `Create an initial summary for this new player:

--- PLAYER PROFILE ---
Email: ${profile.email}
Age Range: ${profile.age || 'Not specified'}
Occupation: ${profile.occupation || 'Not specified'}
Problem Solving Approach: ${profile.problemSolvingApproach ? approachLabels[profile.problemSolvingApproach] || profile.problemSolvingApproach : 'Not specified'}
Interests: ${interestsFormatted}
Additional Notes from User: ${profile.additionalNotes || 'None'}

Based on this profile, create an initial summary that helps AI agents:
1. Give clues this person might understand (based on interests, occupation)
2. Adjust communication style (based on problem-solving approach)
3. Note any special considerations from their notes

This is their FIRST profile - no game history yet. Make reasonable predictions.`;

    const response = await callAgent(systemPrompt, userPrompt, {
      temperature: 0.5,
      maxTokens: 1024,
      jsonMode: true,
    });

    console.log('📊 [SUMMARY AGENT] Raw response:', response);
    const parsed = parseAgentJson<{ summary: string; keyInsights?: string[] }>(response);

    if (!parsed.summary) {
      console.error('❌ [SUMMARY AGENT] Invalid response - no summary field');
      return null;
    }

    console.log('✅ [SUMMARY AGENT] Initial summary generated successfully');
    console.log('📋 Key insights:', parsed.keyInsights?.join(', ') || 'None extracted');
    console.log('═══════════════════════════════════════════════════════════');
    
    return parsed.summary;
  } catch (error) {
    console.error('❌ [SUMMARY AGENT] Error generating initial summary:', error);
    return null;
  }
}

