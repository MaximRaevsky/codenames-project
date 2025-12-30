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
import { getSummaryForAI } from './summaryAgent';

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

## Game Rules Summary
- You give ONE-WORD clues + a number (how many of your words connect to it)
- Your guesser can guess up to (your number + 1) words - the extra guess allows catching up from previous turns
- ASSASSIN = INSTANT LOSS if guessed
- Rival team words = helps opponent + ends your turn
- Neutral words = ends your turn without progress
- First team to find ALL their words wins

## Special Number Options

### NUMBER = 0 (WARNING CLUE)
Use "0" when you want to WARN your guesser about DANGEROUS words!
- Give a clue that describes words to AVOID (assassin or rival words)
- Example: If assassin is "SNAKE" and rival has "COBRA", give "REPTILE 0" to warn them
- Your guesser will understand: "Don't guess words related to this clue!"
- They can still guess OTHER words from previous clues

### UNLIMITED (∞ or -1)
Use when you want guesser to guess many words without a specific limit:
- Useful for broad connections
- Guesser will keep guessing until they're uncertain

## Your Goal
Win the game in as FEW TURNS as possible by giving clues that connect MULTIPLE words - but NEVER at the cost of risking the assassin or giving easy guesses to your opponent.

## DANGER PRIORITY (Most to Least Dangerous):
1. 🚫 **ASSASSIN** - Guessing this = INSTANT LOSS. Never give clues that could lead here!
2. ⚠️ **RIVAL WORDS (${rivalTeamName})** - Guessing these HELPS your opponent win faster
3. ⚡ **NEUTRAL** - Ends turn but doesn't help anyone

## CLUE RULES (STRICTLY ENFORCED - VIOLATION = INVALID CLUE):

### 1. Single Word
- Must be exactly ONE word (hyphens allowed, spaces NOT)

### 2. NOT a Board Word
- Cannot be identical to ANY word on the board

### 3. NO Substrings (CRITICAL!)
- Your clue CANNOT CONTAIN any board word as part of it
  * If "BEAR" is on board → "BEARTRAP", "BEARISH", "TEDDY-BEAR" are ALL INVALID
  * If "FIRE" is on board → "FIREMAN", "FIREPLACE", "CAMPFIRE" are ALL INVALID
- Your clue CANNOT BE CONTAINED within a board word
  * If "SUNFLOWER" is on board → "SUN", "FLOWER" are INVALID
  * If "BASKETBALL" is on board → "BASKET", "BALL" are INVALID

### 4. NO Same-Root Words
- Cannot share the same root/stem as any board word
  * If "TEACH" is on board → "TEACHER", "TEACHING" are INVALID
  * If "RUN" is on board → "RUNNING", "RUNNER", "RUNS" are INVALID
  * If "BEAUTY" is on board → "BEAUTIFUL", "BEAUTIFY" are INVALID

### 5. NO Plurals
- Cannot be plural of board word or vice versa
  * If "CAR" is on board → "CARS" is INVALID
  * If "BOXES" is on board → "BOX" is INVALID

⚠️ BEFORE GIVING ANY CLUE: Check EVERY board word and verify your clue doesn't violate rules 2-5!

## BUILD YOUR STRATEGY
Consider all factors and develop your optimal approach:
- How many words can you safely connect without risking dangerous words?
- What associations will your guesser likely make?
- Is it worth connecting more words with slightly more risk, or fewer words with certainty?
- Look at the turn history - what clues/connections have already been tried?
- If behind in score, you may need bolder clues; if ahead, play it safe

## Response Format
{
  "clue": "YOURWORD",
  "number": <how_many_words_this_connects>,
  "reasoning": "Which words you're targeting and why this is safe"
}
`;

  // Add personalization for partner agent
  if (isPartnerAgent && profile) {
    prompt += `
## Your Teammate's Profile
${buildProfileContext(profile)}

Use this information to:
- Give clues using references they would understand based on their interests
- Match their thinking style (systematic vs creative)
- Build on successful patterns from previous games together
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

## ⚠️ RIVAL'S UNREVEALED WORDS (Avoid!):
${rivalWords.join(', ')}

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
## GAME HISTORY - Learn from past turns!

### Your Team's Previous Turns:
${yourTeamHistory.length > 0 ? yourTeamHistory.map(t => 
  `- Clue "${t.clue}" (${t.clueNumber}) → Guessed: ${t.guesses.join(', ')} → Results: ${t.guessResults.map(r => r.word + (r.correct ? '✓' : '✗')).join(', ')}`
).join('\n') : 'No previous turns yet'}

### Rival Team's Previous Turns:
${rivalTeamHistory.length > 0 ? rivalTeamHistory.map(t => 
  `- Clue "${t.clue}" (${t.clueNumber}) → Guessed: ${t.guesses.join(', ')} → Results: ${t.guessResults.map(r => r.word + (r.correct ? '✓' : '✗')).join(', ')}`
).join('\n') : 'No previous turns yet'}

Use this history to:
- Avoid clue patterns that led to wrong guesses
- Build on successful associations
- Notice what connections your guesser tends to make
`;
  }

  prompt += `
## YOUR TASK
Give a ONE-WORD clue and number.

⚠️ BEFORE RESPONDING, VERIFY YOUR CLUE:
1. Does your clue CONTAIN any of these board words? → INVALID
2. Is your clue CONTAINED IN any board word? → INVALID  
3. Does your clue share the same ROOT as any board word? → INVALID
4. Is your clue a PLURAL of any board word (or vice versa)? → INVALID

If ANY of the above is true, pick a DIFFERENT clue!

Strategy reminders:
- Guesser can guess (number + 1) words - the extra allows catching up
- Connect as many words as you safely can to win faster
- But NEVER risk the assassin or easy rival guesses

Respond with JSON: {"clue": "WORD", "number": N, "reasoning": "brief explanation"}
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

## THE +1 RULE
You CAN guess (clue number + 1) words, but only if confident:
- Use the extra guess to catch up on words from previous clues
- But NEVER use it just because you can - only if you have a strong candidate

## BUILD YOUR STRATEGY
- Order guesses from most confident to least confident
- Stop guessing when uncertainty outweighs potential gain
- Consider the score: behind = slightly more risk acceptable, ahead = play safe
- Learn from game history - what patterns has your Spymaster used?

## Response Format
{
  "guesses": [
    {"word": "MOST_CONFIDENT", "confidence": 95},
    {"word": "SECOND_CONFIDENT", "confidence": 75},
    ...
  ],
  "reasoning": "Why these words connect to the clue"
}

Confidence is 0-100 where:
- 30-100: Likely our word
- 10-29: Possible but risky
- Below 10: Too uncertain, don't include
`;

  // Add personalization for partner agent
  if (isPartnerAgent && profile) {
    prompt += `
## Your Spymaster's Profile
${buildProfileContext(profile)}

Use this to understand their clue style:
- What references would they use based on their interests?
- Are they systematic or creative in their thinking?
- What patterns have worked in previous games?
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

## AVAILABLE WORDS ON BOARD:
${unrevealedWords.filter(w => !currentGuesses.includes(w)).join(', ')}

(Note: You don't know which are yours, rival's, neutral, or the assassin - deduce from the clue!)

## SCORE:
- Your team: ${yourTeamRemaining} words left
- Rival team: ${rivalTeamRemaining} words left
${yourTeamRemaining <= rivalTeamRemaining ? '→ You need to catch up or keep the lead!' : '→ You are behind - consider being thorough with guesses'}

## ALREADY REVEALED (Use for deduction!):
${revealedWords.length > 0 ? revealedWords.join(', ') : 'None yet - first turn of the game'}
`;

  // Add comprehensive turn history
  if (turnHistory.length > 0) {
    const yourTeamHistory = turnHistory.filter(t => t.team === team);
    const rivalTeamHistory = turnHistory.filter(t => t.team !== team);
    
    prompt += `
## GAME HISTORY - Use this for deduction!

### Your Team's Previous Turns:
${yourTeamHistory.length > 0 ? yourTeamHistory.map(t => 
  `- Clue "${t.clue}" (${t.clueNumber}) → Guesses: ${t.guesses.join(', ')} → ${t.guessResults.map(r => r.word + (r.correct ? '✓' : '✗')).join(', ')}`
).join('\n') : 'This is your first turn'}

### Rival Team's Previous Turns:
${rivalTeamHistory.length > 0 ? rivalTeamHistory.map(t => 
  `- Clue "${t.clue}" (${t.clueNumber}) → Guesses: ${t.guesses.join(', ')} → ${t.guessResults.map(r => r.word + (r.correct ? '✓' : '✗')).join(', ')}`
).join('\n') : 'Rival has not played yet'}

### What you can learn from history:
- Previous clues that WORKED tell you about your Spymaster's thinking style
- Words your Spymaster already targeted might still have unused connections
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
## YOUR TASK
For the clue "${clue}" (${clueNumber === -1 ? 'unlimited' : clueNumber}):
1. Which words MOST LIKELY connect to this clue?
2. Rate each with a confidence score (0-100)
3. Only include words with confidence >= 10
4. If uncertain about ALL words, return empty guesses array [] to pass

Respond with JSON: {"guesses": [{"word": "WORD1", "confidence": 90}, {"word": "WORD2", "confidence": 70}], "reasoning": "why"}
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

  // Add LLM-generated summary if available
  const aiSummary = profile.email ? getSummaryForAI(profile.email) : '';
  if (aiSummary) {
    parts.push('');
    parts.push(aiSummary);
  }

  return parts.length > 0 ? parts.join('\n') : 'No profile information available.';
}
