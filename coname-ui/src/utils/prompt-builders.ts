/**
 * PROMPT BUILDERS
 * ===============
 * 
 * Builds the two-part prompts for each agent role:
 * - Static component: Game rules, role, board words
 * - Dynamic component: Game history, user profile (for partner agent)
 * 
 * Based on the CoName design specification.
 */

import { BoardState, UserProfile, TurnEvent, Team, CardCategory } from '../types/game';
import { getUser } from './userDatabase';

// ============================================
// SPYMASTER PROMPTS
// ============================================

export function buildSpymasterSystemPrompt(
  team: Team,
  isPartnerAgent: boolean,
  profile?: UserProfile
): string {
  const teamName = team === 'teamA' ? 'Red Team' : 'Blue Team';
  const rivalTeamName = team === 'teamA' ? 'Blue Team' : 'Red Team';

  let prompt = `# CODENAMES - ${teamName} SPYMASTER

## Game Rules
- Give ONE-WORD clues + a number (how many words connect)
- Guesser can guess (number + 1) words
- ASSASSIN = instant loss | Rival words = helps opponent | Neutral = ends turn

## Your Goal
Give CLEAR clues that your guesser will easily understand, while AVOIDING all dangerous words.

## Key Principles
1. **CLARITY > QUANTITY**: A clear clue for 2 words beats a vague clue for 3
2. **SCAN ALL WORDS**: Before any clue, check it doesn't connect to assassin/rival words
3. **NEVER REPEAT FAILED CLUES**: If a clue led to wrong guesses before, don't use it again
4. **NEW CLUE EACH TURN**: Always give a fresh clue - don't repeat the same clue from earlier turns unless you're absolutely certain it will work this time

## Danger Priority
1. 🚫 ASSASSIN - Never give clues that could lead here
2. ⚠️ RIVAL WORDS (${rivalTeamName}) - Avoid! Each rival guess = free point for opponent
3. ⚡ NEUTRAL - Ends turn

## Clue Rules (Violations = Invalid)
- Must be ONE word (hyphens OK, spaces NOT)
- Cannot be any board word or share root/substring with board words
- Cannot be plural of board word or vice versa
- **NO ABBREVIATIONS**: Cannot be an abbreviation OF any board word (e.g., NYC for NEW YORK, USA for UNITED STATES)
- **NO EXPANSIONS**: Cannot be a full form of an abbreviation on the board
`;


  // Add personalization for partner agent
  if (isPartnerAgent && profile) {
    prompt += `
## Your Teammate's Profile (MUST USE!)
${buildProfileContext(profile)}

⭐ APPLY THE SUMMARY ABOVE - THIS IS CRITICAL:
- The summary shows what clue types WORK and FAIL with this user
- If "tech references work" → use tech clues
- If "abstract clues fail" → be more literal
- If they "miss 3rd word often" → give clues for 2 words max
- ADAPT your clues to their documented patterns from past games
`;
  }

  return prompt;
}

export function buildSpymasterUserPrompt(
  board: BoardState,
  team: Team,
  turnHistory: TurnEvent[]
): string {
  const teamCategory: CardCategory = team;
  const rivalCategory: CardCategory = team === 'teamA' ? 'teamB' : 'teamA';

  // Separate revealed and unrevealed cards
  const yourWords = board.cards
    .filter(c => c.category === teamCategory && !c.revealed)
    .map(c => c.word);
  
  const rivalWords = board.cards
    .filter(c => c.category === rivalCategory && !c.revealed)
    .map(c => c.word);
  
  const neutralWords = board.cards
    .filter(c => c.category === 'neutral' && !c.revealed)
    .map(c => c.word);
  
  const assassinWord = board.cards
    .find(c => c.category === 'assassin' && !c.revealed)?.word || 'NONE';

  const revealedWords = board.cards
    .filter(c => c.revealed)
    .map(c => `${c.word} (${c.category === 'teamA' ? 'Red' : c.category === 'teamB' ? 'Blue' : c.category})`);

  let prompt = `
# CURRENT GAME STATE

## SCORE
- Your team: ${team === 'teamA' ? board.teamARemaining : board.teamBRemaining} words left to find
- Rival team: ${team === 'teamA' ? board.teamBRemaining : board.teamARemaining} words left to find
${board.teamARemaining < board.teamBRemaining ? (team === 'teamA' ? '→ You are WINNING!' : '→ You are BEHIND - consider bolder clues') : (team === 'teamB' ? '→ You are WINNING!' : '→ You are BEHIND - consider bolder clues')}

## ✅ YOUR TEAM'S UNREVEALED WORDS (Target these!):
${yourWords.join(', ')}

## 🚫 ASSASSIN - INSTANT LOSS IF GUESSED:
>>> ${assassinWord} <<<
(NEVER give a clue that could lead to this word!)

## ⚠️ RIVAL'S UNREVEALED WORDS - MUST AVOID! Guessing these HELPS OPPONENT!
>>> ${rivalWords.join(', ')} <<<
⚠️ CHECK: Does your clue connect to ANY of these? If yes → FIND A DIFFERENT CLUE!
⚠️ Each rival word guessed = FREE POINT for opponent + your turn ends

## ⚡ NEUTRAL WORDS (Avoid - ends turn):
${neutralWords.join(', ')}

## ALREADY REVEALED THIS GAME:
${revealedWords.length > 0 ? revealedWords.join(', ') : 'None yet - this is the first turn'}
`;

  // Add comprehensive turn history
  if (turnHistory.length > 0) {
    const yourTeamHistory = turnHistory.filter(t => t.team === team);
    const rivalTeamHistory = turnHistory.filter(t => t.team !== team);
    
    prompt += `
## GAME HISTORY

### Your Team's Previous Turns:
${yourTeamHistory.length > 0 ? yourTeamHistory.map(t => 
  `- Clue "${t.clue}" (${t.clueNumber}) → Guessed: ${t.guesses.join(', ')} → ${t.guessResults.map(r => r.word + (r.correct ? '✓' : '✗')).join(', ')}`
).join('\n') : 'None yet'}

### Rival Team's Previous Turns:
${rivalTeamHistory.length > 0 ? rivalTeamHistory.map(t => 
  `- Clue "${t.clue}" (${t.clueNumber}) → ${t.guessResults.map(r => r.word + (r.correct ? '✓' : '✗')).join(', ')}`
).join('\n') : 'None yet'}

⚠️ DO NOT repeat any clue from above! Give a NEW, DIFFERENT clue each turn.
`;
  }

  prompt += `
## YOUR TASK
Give a ONE-WORD clue and number.

Before choosing a clue:
1. Scan ALL words on the board (team, rival, assassin, neutral)
2. Make sure your clue doesn't connect to any dangerous words
3. Make sure you're NOT repeating a clue from previous turns
4. Verify your clue follows the rules (no board words, roots, substrings, plurals)

## Response Format (ALL FIELDS REQUIRED)
{
  "clue": "YOUR_CLUE",
  "number": N,
  "targetWords": ["WORD1", "WORD2"],
  "dangerCheck": [
    {"word": "ASSASSIN", "risk": 5},
    {"word": "RIVAL1", "risk": 10}
  ],
  "reasoning": "brief explanation"
}

⚠️ REQUIRED FIELDS:
- "targetWords": MUST list the EXACT board words you're targeting (copy them exactly from the board)
- "number": MUST match the length of targetWords
- "dangerCheck": Include assassin + ALL rival words with risk % (0-100). If any > 25%, find different clue
- "reasoning": Why this clue is clear and safe

CRITICAL: If targetWords is empty or missing, your response is INVALID!
`;

  return prompt;
}

// ============================================
// GUESSER PROMPTS
// ============================================

export function buildGuesserSystemPrompt(
  team: Team,
  isPartnerAgent: boolean,
  profile?: UserProfile
): string {
  const teamName = team === 'teamA' ? 'Red Team' : 'Blue Team';

  let prompt = `# CODENAMES - ${teamName} GUESSER

## Game Rules Summary
- Your Spymaster gave you a ONE-WORD clue and a number
- The number indicates how many of YOUR words connect to the clue
- You CAN guess up to (number + 1) words - but you DON'T HAVE TO guess all of them!
- ASSASSIN = INSTANT LOSS for your team
- Rival team's word = helps opponent + ends your turn
- Neutral = ends your turn without helping either team
- First team to find ALL their words wins

## ⚠️ CRITICAL: Special Number Meanings

### NUMBER = 0 (WARNING CLUE)
When the Spymaster gives "0", they are WARNING you about DANGEROUS words!
- The clue describes words you should AVOID (likely assassin or rival words)
- DO NOT guess words related to this clue - they are TRAPS!
- **BUT you SHOULD still guess OTHER words** that are UNRELATED to the warning clue!
- Look at previous clues from your team - can you guess words from those?
- Think: "Avoid words related to this clue, but guess other safe words"

### UNLIMITED (∞ or -1)
- No limit on guesses - guess as many as you're confident about
- Still STOP when you become uncertain - don't guess randomly!

## 🧠 RISK MANAGEMENT - KEY STRATEGY

**You are NOT obligated to guess all the words!** This is critical:
- The number tells you how many words COULD connect to the clue
- But YOU decide how many to actually guess based on confidence
- If you're 30% sure about 2 words but only 10% sure about a 3rd, STOP at 2
- A wrong guess can lose the game (assassin) or help the opponent

**Risk Assessment for Each Guess:**
- High confidence (>30%) → Guess it
- Medium confidence (10-30%) → Consider score: if behind, maybe risk it; if ahead, skip it
- Low confidence (<10%) → SKIP IT, not worth the risk

**When to PASS (return empty guesses):**
- If you're uncertain about ALL options and don't want to risk the assassin
- This ends your turn and gives the opponent a chance to play
- Only pass if truly uncertain - passing is still better than hitting the assassin!

## DANGER PRIORITY (Most to Least Dangerous):
1. 🚫 **ASSASSIN** - If there's ANY chance a word is the assassin, DO NOT GUESS IT
2. ⚠️ **RIVAL WORDS** - Guessing these gives your opponent free progress
3. ⚡ **NEUTRAL** - Ends turn but doesn't directly hurt you

## THE +1 RULE (IMPORTANT!)
You CAN guess up to (clue number + 1) words total. The extra +1 is for catching up on ONE leftover!

⚠️ KEY RULES FOR +1:
1. The +1 allows exactly ONE extra word from PREVIOUS clues (not more!)
2. Only consider words that were NEVER GUESSED by either team
3. Apply CONFIDENCE DECAY: multiply previous clue confidence by 0.9 per turn passed
   - 1 turn ago: confidence × 0.9
   - 2 turns ago: confidence × 0.81 (0.9²)
   - 3 turns ago: confidence × 0.729 (0.9³)

HOW TO DECIDE:
1. FIRST: List all words that match the CURRENT clue with their confidence
2. THEN: Check if there's ONE leftover word from previous clues with high decayed confidence
3. Compare: If a word matches BOTH current AND previous clue, use the HIGHER confidence
4. The +1 slot goes to the SINGLE best leftover word (after decay) if confident enough

EXAMPLE: Clue "OCEAN 2" (your 3rd turn):
- You can guess up to 3 words total (2 for current clue + 1 leftover)
- Words for OCEAN: SHIP (90%), WAVE (75%)
- Leftover from "FIRE" (2 turns ago): MATCH was 80% → now 80% × 0.81 = 65%
- Decision: Guess SHIP, WAVE for current clue. MATCH at 65% is below threshold, skip +1.

PRIORITY ORDER:
1. Current clue words (high confidence) - ALWAYS FIRST
2. Current clue words (medium confidence)  
3. ONE previous clue leftover (only if decayed confidence >50%, and only ONE word!)

## BUILD YOUR STRATEGY
- Order guesses from most confident to least confident
- Stop guessing when uncertainty outweighs potential gain
- Consider the score: behind = slightly more risk acceptable, ahead = play safe
- Look at YOUR TEAM's previous clues - are there words you should have guessed?

## Response Format
{
  "allWordConfidences": [
    {"word": "WORD1", "confidence": 95},
    {"word": "WORD2", "confidence": 70},
    {"word": "WORD3", "confidence": 15},
    ...for ALL available words
  ],
  "guesses": [
    {"word": "WORD1", "confidence": 95, "source": "current"},
    {"word": "WORD2", "confidence": 70, "source": "current"},
    {"word": "LEFTOVER", "confidence": 65, "source": "previous", "fromClue": "OLD_CLUE", "turnsAgo": 2}
  ],
  "reasoning": "Why these words connect to the clue"
}

IMPORTANT:
1. "allWordConfidences" - Rate EVERY available word (0-100) for how likely it's YOUR team's word based on the current clue. This helps us track your thinking.
2. "guesses" - Only the words you actually want to guess (in order)

FIELDS for guesses:
- "source": "current" (matches current clue) or "previous" (leftover from +1 rule)
- "confidence": Your CURRENT assessment of how well this word matches the clue (0-100)
- "fromClue": Which previous clue this leftover was from
- "turnsAgo": How many turns ago was that previous clue

⚠️ FOR PREVIOUS CLUE WORDS:
- Give your CURRENT confidence that this word matches the old clue
- The system will automatically apply decay: confidence × 0.9^turnsAgo
- Example: If you're 80% confident DICE matches "MEDICINE" from 3 turns ago,
  report confidence: 80, and system calculates: 80 × 0.9³ = 58%

⚠️ REMEMBER: Only include AT MOST ONE "previous" source word in guesses (the +1 allows only 1 leftover!)

Confidence thresholds:
- 50-100: Worth guessing
- 30-49: Risky but consider if behind
- Below 30: Skip it
`;

  // Add personalization for partner agent
  if (isPartnerAgent && profile) {
    prompt += `
## Your Spymaster's Profile (USE THIS!)
${buildProfileContext(profile)}

⭐ APPLY THE SUMMARY ABOVE:
- The summary tells you what clue styles THIS spymaster uses
- If it says they use "tech references", look for tech connections
- If it says they "struggle with abstract clues", expect literal connections
- ADAPT your guessing to their documented patterns
`;
  }

  return prompt;
}

export function buildGuesserUserPrompt(
  clue: string,
  clueNumber: number,
  board: BoardState,
  team: Team,
  turnHistory: TurnEvent[],
  currentGuesses: string[] = []
): string {
  // Get all unrevealed words (guesser doesn't know categories!)
  const unrevealedWords = board.cards
    .filter(c => !c.revealed)
    .map(c => c.word);

  const revealedWords = board.cards
    .filter(c => c.revealed)
    .map(c => `${c.word} (${c.category === 'teamA' ? 'Red' : c.category === 'teamB' ? 'Blue' : c.category})`);

  const maxGuesses = clueNumber === -1 || clueNumber === 0 ? 'unlimited' : clueNumber + 1;
  const yourTeamRemaining = team === 'teamA' ? board.teamARemaining : board.teamBRemaining;
  const rivalTeamRemaining = team === 'teamA' ? board.teamBRemaining : board.teamARemaining;

  // Special handling for "0" clue
  const isWarningClue = clueNumber === 0;
  
  let prompt = `
# CURRENT CLUE TO INTERPRET

## The Clue:
>>> "${clue}" for ${clueNumber === -1 ? 'UNLIMITED' : clueNumber} word(s) <<<
${isWarningClue ? `
⚠️ **THIS IS A WARNING CLUE (0)!**
Your Spymaster is telling you which words to AVOID!
Words related to "${clue}" are DANGEROUS (likely assassin or rival words).
DO NOT guess words that connect to this clue!
You may guess OTHER words from previous clues if confident.
` : ''}
## Guessing Rules:
- You CAN guess up to ${maxGuesses} words, but you DON'T HAVE TO
- Only guess words you're confident about - STOP when uncertain
- Guess in order of confidence - most confident first
- A wrong guess can lose the game or help the opponent!
${currentGuesses.length > 0 ? `- Already guessed this turn: ${currentGuesses.join(', ')}` : ''}

## AVAILABLE WORDS ON BOARD (ONLY GUESS FROM THIS LIST!):
${unrevealedWords.filter(w => !currentGuesses.includes(w)).join(', ')}

⚠️ CRITICAL: You can ONLY guess words from the list above!
Words in "ALREADY REVEALED" below are OFF LIMITS - they're already guessed!

## SCORE:
- Your team: ${yourTeamRemaining} words left
- Rival team: ${rivalTeamRemaining} words left
${yourTeamRemaining <= rivalTeamRemaining ? '→ You need to catch up or keep the lead!' : '→ You are behind - consider being thorough with guesses'}

## ALREADY REVEALED (Use for deduction!):
${revealedWords.length > 0 ? revealedWords.join(', ') : 'None yet - first turn of the game'}
`;

  // Add comprehensive turn history with leftover analysis
  if (turnHistory.length > 0) {
    const yourTeamHistory = turnHistory.filter(t => t.team === team);
    const rivalTeamHistory = turnHistory.filter(t => t.team !== team);
    
    // Current turn number (for decay calculation)
    const currentTurnNumber = yourTeamHistory.length + 1;
    
    // Calculate leftover words from previous clues WITH turn numbers for decay
    const leftoverClues: { clue: string; missed: number; turnsAgo: number; decayMultiplier: number }[] = [];
    yourTeamHistory.forEach((turn, index) => {
      const correctCount = turn.guessResults.filter(r => r.correct).length;
      const expectedCount = turn.clueNumber;
      if (correctCount < expectedCount && expectedCount > 0) {
        const missed = expectedCount - correctCount;
        const turnsAgo = currentTurnNumber - (index + 1);
        const decayMultiplier = Math.pow(0.9, turnsAgo);
        leftoverClues.push({ clue: turn.clue, missed, turnsAgo, decayMultiplier });
      }
    });
    
    prompt += `
## GAME HISTORY - Use this for deduction!

### Your Team's Previous Turns (with turn numbers):
${yourTeamHistory.length > 0 ? yourTeamHistory.map((t, i) => 
  `- Turn ${i + 1}: Clue "${t.clue}" (${t.clueNumber}) → ${t.guessResults.map(r => r.word + (r.correct ? '✓' : '✗')).join(', ')}`
).join('\n') : 'This is your first turn'}

**Current turn: ${currentTurnNumber}**

${leftoverClues.length > 0 ? `
### ⚠️ LEFTOVER WORDS FROM PREVIOUS CLUES (for +1 rule):
${leftoverClues.map(l => 
  `• "${l.clue}" - ${l.missed} word(s) unguessed, ${l.turnsAgo} turn(s) ago → multiply confidence by ${(l.decayMultiplier * 100).toFixed(0)}%`
).join('\n')}

Remember: You can use +1 for AT MOST ONE leftover word! Pick the best one after applying decay.
` : ''}

### Rival Team's Previous Turns:
${rivalTeamHistory.length > 0 ? rivalTeamHistory.map(t => 
  `- Clue "${t.clue}" (${t.clueNumber}) → Guesses: ${t.guesses.join(', ')} → ${t.guessResults.map(r => r.word + (r.correct ? '✓' : '✗')).join(', ')}`
).join('\n') : 'Rival has not played yet'}

### What you can learn from history:
- Previous clues that WORKED tell you about your Spymaster's thinking style
- LEFTOVER words from previous clues can be guessed with your +1
- Revealed words tell you what categories other words are NOT
`;
  }

  if (isWarningClue) {
    prompt += `
## YOUR TASK (WARNING CLUE - 0)
The clue "${clue}" tells you which words to AVOID (they are dangerous - likely assassin or rival).

**IMPORTANT: You should still TRY TO GUESS other words!**
1. First, identify words related to "${clue}" - mark these as DANGEROUS, do NOT guess them
2. Then, look at ALL OTHER words on the board that are UNRELATED to "${clue}"
3. Consider: Do any of these unrelated words connect to PREVIOUS clues from your team?
4. Rate each potential guess with a confidence score (0-100) based on previous clues
5. Only pass if you truly have no confident guesses from previous turns

The "0" clue is a WARNING - it does NOT mean "don't guess anything"!
It means "avoid these specific words, but feel free to guess others".

Respond with JSON: {"guesses": [{"word": "WORD1", "confidence": 80}], "reasoning": "avoiding X because of warning, guessing Y because it connects to previous clue Z"}
`;
  } else {
    prompt += `
## YOUR TASK - ANALYZE CAREFULLY!
Current clue: "${clue}" for ${clueNumber === -1 ? 'unlimited' : clueNumber} words
You can guess up to ${clueNumber === -1 ? 'unlimited' : clueNumber + 1} words total (+1 rule!)

STEP 1: Find words for CURRENT clue "${clue}"
- Which words connect to "${clue}"?
- Rate each with confidence (0-100)

STEP 2: Consider PREVIOUS CLUES (for your +1 extra guess)
- Look at your team's previous clues above
- Are there obvious leftover words you should have guessed?
- If confidence >50% for a previous clue word, include it!

STEP 3: Order your guesses
1. Current clue words (highest confidence first)
2. Previous clue leftovers (only if >50% confident)

RESPOND WITH:
{
  "guesses": [
    {"word": "CURRENT_CLUE_WORD", "confidence": 90, "reason": "connects to ${clue}"},
    {"word": "PREVIOUS_CLUE_WORD", "confidence": 85, "reason": "leftover from clue X"}
  ],
  "reasoning": "Full explanation including any +1 usage"
}
`;
  }

  return prompt;
}

// ============================================
// RIVAL TEAM PROMPTS
// ============================================

export function buildRivalSpymasterSystemPrompt(team: Team): string {
  return buildSpymasterSystemPrompt(team, false);
}

export function buildRivalGuesserSystemPrompt(team: Team): string {
  return buildGuesserSystemPrompt(team, false);
}

// ============================================
// VALIDATION PROMPTS
// ============================================

export function buildValidatorSystemPrompt(): string {
  return `Codenames clue validator. DEFAULT IS VALID.

ONLY mark INVALID if ONE of these STRING rules is violated:
1. Clue contains SPACES (must be single word)
2. Clue EXACTLY equals a board word (letter-by-letter identical)
3. Clue contains a board word as LETTERS (BEARTRAP contains BEAR)
4. Board word contains clue as LETTERS (SUNFLOWER contains SUN)
5. Clue is board word + s/es/ing/ed/er suffix (RUNS = RUN + s)

**EVERYTHING ELSE IS VALID!**
- Related words = VALID (BREATHE and MOUTH are different strings!)
- Synonyms = VALID (PLAY and GAME are different strings!)
- Semantic connections = VALID (that's the whole point of Codenames!)

Only check STRING/LETTER patterns, NOT meanings!
BREATHE does not contain MOUTH as letters → VALID
BREATH does not contain MOUTH as letters → VALID

Return JSON: {"valid": true/false, "reason": "..."}`;
}

export function buildValidatorUserPrompt(
  clue: string,
  boardWords: string[]
): string {
  return `Clue: "${clue}"
Board words: ${boardWords.join(', ')}

Check ONLY these STRING rules:
1. Is "${clue}" EXACTLY equal to any board word? (same letters)
2. Does "${clue}" CONTAIN any board word as letters?
3. Is "${clue}" CONTAINED in any board word as letters?
4. Is "${clue}" a board word + s/es/ing/ed suffix?

If ANY rule is YES → {"valid": false, "reason": "which word and which rule"}
If ALL rules are NO → {"valid": true, "reason": "ok"}

Do NOT check meanings or associations - only letter patterns!`;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildProfileContext(profile: UserProfile): string {
  const parts: string[] = [];

  if (profile.age) {
    parts.push(`- Age range: ${profile.age}`);
  }
  if (profile.occupation) {
    parts.push(`- Occupation: ${profile.occupation}`);
  }
  if (profile.problemSolvingApproach) {
    const approaches: Record<string, string> = {
      systematic: 'Systematic/logical thinker',
      creative: 'Creative/out-of-the-box thinker',
      both: 'Flexible, combines systematic and creative approaches',
    };
    parts.push(`- Thinking style: ${approaches[profile.problemSolvingApproach] || profile.problemSolvingApproach}`);
  }
  if (profile.interests && profile.interests.length > 0) {
    parts.push(`- Interests: ${profile.interests.join(', ')}`);
  }
  if (profile.additionalNotes) {
    parts.push(`- Additional context: ${profile.additionalNotes}`);
  }

  // Add LLM-generated summary if available (from profile or database)
  const summary = profile.llmSummary || (profile.email ? getUser(profile.email)?.llmSummary : '');
  if (summary) {
    // Get games played count from database
    const gamesPlayed = profile.email ? getUser(profile.email)?.gamesPlayed || 0 : 0;
    parts.push('');
    parts.push(`--- PLAYER LEARNING SUMMARY (${gamesPlayed} games played) ---`);
    parts.push(summary);
    parts.push('--- END SUMMARY ---');
  }

  return parts.length > 0 ? parts.join('\n') : 'No profile information available.';
}
