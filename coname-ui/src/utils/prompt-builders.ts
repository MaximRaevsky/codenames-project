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

  let prompt = `# CODENAMES - ${teamName} SPYMASTER

🚨 🚨 🚨 YOU ARE FAILING - YOU MUST CHECK EVERY WORD 🚨 🚨 🚨

**YOU KEEP GIVING CLUES THAT CONNECT TO RIVAL/ASSASSIN WORDS!**

This means you are NOT actually checking all words on the board!

**YOU MUST LITERALLY DO THIS FOR EVERY CLUE:**

1. Think of a clue
2. **STOP - DO NOT PROCEED WITHOUT CHECKING**
3. Read the ASSASSIN word out loud to yourself
4. Ask: "Does my clue connect to ASSASSIN?" If YES → REJECT AND START OVER
5. Read EACH RIVAL WORD one by one
6. For EACH rival word, ask: "Does my clue connect to THIS word?" 
7. If YES for even ONE rival word → REJECT AND START OVER
8. Read EACH NEUTRAL WORD
9. Ask: "Do any neutrals connect as strongly as my targets?" If YES → REJECT
10. ONLY if you pass ALL checks above can you give the clue

**CRITICAL RULE:**
If you give a clue and the guesser chooses a RIVAL or ASSASSIN word, it means YOU FAILED to check that word properly.

**THE GUESSER WILL THINK OF EVERY WORD THAT CONNECTS TO YOUR CLUE!**
Not just the ones you intended!

⚠️ CHECK EVERY SINGLE WORD - NO EXCEPTIONS - NO SHORTCUTS!

## Game Rules
- Give ONE-WORD clues + a number (how many words connect)
- Guesser can guess (number + 1) words
- ASSASSIN = instant loss | Rival words = helps opponent | Neutral = ends turn

## Your Goal
Give CLEAR, UNAMBIGUOUS clues that make your guesser rate your target words at the TOP while keeping dangerous words at the BOTTOM. A perfect clue = YOUR words get top ratings, dangerous words get low ratings.

## Key Strategy Principles
1. **THINK LIKE THE GUESSER**: They don't know your targets - they'll consider ALL words that connect to your clue
2. **CLARITY FOR YOUR WORDS**: Target words should have STRONG, OBVIOUS connections to your clue
3. **CONNECT MULTIPLE CLEAR WORDS**: If 2+ words have CLEAR, STRONG connections (and NO dangerous words involved), include them all
4. **QUALITY > QUANTITY**: A specific, safe clue for 2 words beats a broad, risky clue for 3 words

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
  const rivalTeamName = team === 'teamA' ? 'Blue Team' : 'Red Team';

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

## 🚫 ASSASSIN - INSTANT LOSS IF GUESSED!
>>> ${assassinWord} <<<
❌ If your clue connects to this word in ANY way → REJECT IT IMMEDIATELY!

## ⚠️ RIVAL'S UNREVEALED WORDS (${rivalTeamName}) - CHECK EACH ONE!
>>> ${rivalWords.join(', ')} <<<
❌ You MUST check EVERY word above! If your clue connects to even ONE → REJECT IT!
⚠️ Each rival word guessed = FREE POINT for opponent

## ⚡ NEUTRAL WORDS - AVOID - CHECK THIRD!
${neutralWords.join(', ')}
⚠️ These end your turn immediately - avoid unless your team words are MUCH stronger connections

## ✅ YOUR TEAM'S UNREVEALED WORDS (Target these):
${yourWords.join(', ')}

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

⚠️ MANDATORY WORD-BY-WORD CHECK - DO EVERY STEP!

**YOU MUST GO THROUGH THIS EXACT PROCESS:**

1. **PROPOSE YOUR CLUE**: Write down your clue

2. **CHECK ASSASSIN**:
   - Read the assassin word
   - Ask: "Does my clue connect to this word?"
   - If YES → STOP, REJECT, start over

3. **CHECK EVERY RIVAL WORD**:
   - Take the list of rival words
   - Read the FIRST word
   - Ask: "Does my clue connect to this word?"
   - If YES → STOP, REJECT, start over
   - If NO → move to NEXT word
   - Repeat for EVERY word in the list
   - You MUST check ALL of them!

4. **CHECK NEUTRAL WORDS**:
   - For each neutral, ask: "Does it connect as strongly as my targets?"
   - If YES to any → REJECT

5. **VERIFY**:
   - Are your targets the ONLY strong connections on the board?
   - If NO → REJECT and find a more specific clue

6. **HONESTY CHECK**:
   - Did you actually check EVERY word above?
   - Did you rate connections honestly?
   - If you skipped any word or lied about connections → START OVER

🚫 If ANY dangerous word connects → REJECT THE CLUE!
🚫 You MUST check EVERY word - no shortcuts!

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
- "number": MUST match the length of targetWords. Aim for 2-3 words when all have STRONG, CLEAR connections AND no dangerous words
- "dangerCheck": MANDATORY! You MUST include EVERY word below with honest risk % (0-100):
  - ASSASSIN word
  - EVERY SINGLE RIVAL WORD (do not skip any!)
  - ALL NEUTRAL WORDS
  
  **HOW TO RATE EACH WORD:**
  - Ask: "Would a human think of this word when hearing my clue?"
  - If there's ANY connection, rate it AT LEAST 40%
  - If it's a strong connection, rate it 80%+
  - BE BRUTALLY HONEST - do not underestimate!
  
  **REJECTION RULES:**
  - If ASSASSIN > 25% → REJECT THIS CLUE
  - If ANY RIVAL > 25% → REJECT THIS CLUE
  - If NEUTRAL > 35% and your targets aren't much higher → REJECT
  - If a dangerous word has a rating comparable to your targets → REJECT

- "reasoning": Explain: "I went through EVERY word on the board. My targets are the ONLY words that connect strongly. [List specific dangerous words and why they don't connect]"

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

## 🧠 GUESSING STRATEGY - PURE SEMANTIC MATCHING

**CRITICAL: You do NOT know which words belong to which team!**
- You ONLY know the clue word and the available words
- Guess based PURELY on how well each word connects semantically to the clue
- DO NOT try to "figure out" or "infer" which words are yours vs opponent's vs neutral
- Your spymaster gave you a clue - trust it and find the words that BEST MATCH the clue

**How to decide what to guess:**
1. Rate each word by how semantically related it is to the clue
2. Guess the words with the HIGHEST semantic connection to the clue
3. Guess up to (clue number) words, stopping if confidence drops too low

**Confidence = Semantic Relatedness:**
- 50%+ → Strong connection to the clue, definitely guess it
- 30-50% → Moderate connection, probably guess it
- 10-30% → Weak connection, risky but consider it
- <10% → Very weak connection, skip it

**DO NOT:**
- Try to guess which words are "team words" vs "neutral" vs "rival"
- Filter words based on anything OTHER than their semantic connection to the clue
- You have NO INFORMATION about word categories - only the clue!

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

## Response Format (ALL FIELDS REQUIRED!)
{
  "allWordConfidences": [
    {"word": "BUG", "confidence": 95, "explanation": "Butterflies are a type of bug"},
    {"word": "LUCK", "confidence": 70, "explanation": "Butterflies are symbols of good luck"},
    {"word": "CAR", "confidence": 15, "explanation": "Highest remaining option after BUG and LUCK"},
    {"word": "PIANO", "confidence": 5, "explanation": "Weak connection through wings/keys metaphor"},
    ...MUST include ALL available words on the board with explanations!
  ],
  "guesses": [
    {"word": "BUG", "confidence": 95, "source": "current"},
    {"word": "LUCK", "confidence": 70, "source": "current"},
    {"word": "CAR", "confidence": 15, "source": "current"}
  ],
  "reasoning": "Overall summary of your guessing strategy"
}

⚠️ CRITICAL - "allWordConfidences" IS MANDATORY!
You MUST rate EVERY SINGLE available word from 0-100. This is required for the game to function.
Do NOT skip any words. Include ALL words even if confidence is 0%.

IMPORTANT:
1. "allWordConfidences" - Rate EVERY available word (0-100) AND include "explanation" field:
   - For NORMAL clues: How likely this word is YOUR team's word based on the clue
   - For AVOIDANCE clues (number=0): How RELATED this word is to the avoidance clue word!
     ⚠️ Example: If clue is "LOCK 0", rate KEY at 90%+ because key and lock are HIGHLY related!
     The higher the relatedness, the more DANGEROUS - these words should be avoided!
   - **CRITICAL**: Each word object MUST include "explanation" field with a meaningful reason
   - Format: {"word": "CANADA", "confidence": 95, "explanation": "Ottawa is Canada's capital"}
   - Use proper capitalization (proper nouns, clue words, etc.)
   
   **FOR WORDS YOU ACTUALLY GUESS (even with low confidence):**
   - You MUST explain WHY you chose this word despite low confidence
   - Examples: "CAR was the next highest after BUG and LUCK", "Trying CAR as it relates to transportation", "CAR has the highest remaining confidence at 15%"
   - NEVER say "weak connection, no clear relation" - if you chose it, explain your reasoning!
   - If using +1 rule, mention the previous clue it connects to
   
   **FOR WORDS YOU DON'T GUESS:**
   - Can say "Weak connection through X", "Could relate via Y but risky"
   - Keep explanations brief (5-15 words), conversational
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
⚠️ **THIS IS A WARNING/AVOIDANCE CLUE (0)!**
Your Spymaster is telling you which words to AVOID!
Words related to "${clue}" are DANGEROUS (likely assassin or rival words).

**CRITICAL FOR allWordConfidences:**
For this avoidance clue, rate each word by how RELATED it is to "${clue}":
- High relatedness (60%+) = DANGEROUS word to avoid
- Medium relatedness (30-60%) = Somewhat risky
- Low relatedness (<30%) = Probably safe

**EXAMPLE:** If clue is "LOCK 0":
- KEY → 95% (keys and locks go together - VERY related!)
- DOOR → 70% (doors have locks - related)
- PIANO → 5% (not related to locks at all)

**WHAT TO DO:**
1. IDENTIFY words that connect to "${clue}" - rate them HIGH in allWordConfidences (they are DANGEROUS!)
2. GUESS other words that seem safe - words UNRELATED to "${clue}"
3. You have UNLIMITED guesses - use them wisely on safe-looking words
4. Consider leftover words from previous clues that are UNRELATED to "${clue}"
` : ''}
## Guessing Rules:
- You CAN guess up to ${maxGuesses} words, but you DON'T HAVE TO
- Only guess words you're confident about - STOP when uncertain
- Guess in order of confidence - most confident first
- A wrong guess can lose the game or help the opponent!
${currentGuesses.length > 0 ? `- Already guessed this turn: ${currentGuesses.join(', ')}` : ''}

## AVAILABLE WORDS ON BOARD (ONLY GUESS FROM THIS LIST!):
${unrevealedWords.filter(w => !currentGuesses.includes(w)).join(', ')}

⚠️ CRITICAL REQUIREMENTS:
1. You can ONLY guess words from the list above!
2. In "allWordConfidences", you MUST rate EVERY SINGLE word from the list above (${unrevealedWords.filter(w => !currentGuesses.includes(w)).length} words total)
3. Words in "ALREADY REVEALED" below are OFF LIMITS - they're already guessed!

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

### Rival Team's Previous Turns (for DEDUCTION ONLY - NOT for +1 rule!):
${rivalTeamHistory.length > 0 ? rivalTeamHistory.map(t => 
  `- Clue "${t.clue}" (${t.clueNumber}) → Guesses: ${t.guesses.join(', ')} → ${t.guessResults.map(r => r.word + (r.correct ? '✓' : '✗')).join(', ')}`
).join('\n') : 'Rival has not played yet'}

⚠️ **CRITICAL: Rival clues are DANGEROUS!**
- Words that connect to RIVAL clues are likely THEIR TEAM'S words - DO NOT GUESS THEM!
- The +1 rule ONLY applies to YOUR OWN TEAM'S previous clues, NEVER to rival clues!
- Use rival history only to AVOID words, never to guess them!

### What you can learn from history:
- LEFTOVER words from YOUR TEAM's previous clues can be guessed with your +1
- Words connecting to RIVAL clues should be AVOIDED (they're opponent's words!)
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
3. Consider: Do any of these unrelated words connect to YOUR TEAM's PREVIOUS clues?
4. Rate each potential guess with a confidence score (0-100) based on YOUR TEAM's previous clues
5. Only pass if you truly have no confident guesses from YOUR OWN previous turns

⚠️ **CRITICAL RULES:**
- ONLY use YOUR OWN TEAM's previous clues for guessing!
- NEVER use RIVAL team's clues - words connecting to rival clues are THEIR words!
- The "0" clue is a WARNING - it does NOT mean "don't guess anything"!
- It means "avoid words related to ${clue}, but guess other safe words from YOUR previous clues"

Respond with JSON: {"guesses": [{"word": "WORD1", "confidence": 80, "source": "previous", "fromClue": "YOUR_TEAM_CLUE"}], "reasoning": "avoiding X because of warning clue, guessing Y because it connects to MY TEAM's previous clue Z"}
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
  return `You are a strict Codenames clue validator. You must check EVERY rule against EVERY board word.

## RULES TO CHECK (in order):

☐ **RULE 1: SPACES** - Clue must be a SINGLE word (no spaces, no hyphens)
☐ **RULE 2: EXACT MATCH** - Clue cannot be identical to any board word
☐ **RULE 3: CLUE CONTAINS BOARD WORD** - Clue cannot contain any board word as a substring
   Example: "SUNLIGHT" is INVALID if "SUN" is on the board
☐ **RULE 4: BOARD WORD CONTAINS CLUE** - Clue cannot be contained within any board word
   Example: "SUN" is INVALID if "SUNFLOWER" is on the board
☐ **RULE 5: SHARED ROOT/STEM** - Clue cannot share a root word with any board word
   Example: "HEROES" is INVALID if "SUPERHERO" is on board (both share "HERO")
   Example: "RUNNING" is INVALID if "RUN" is on board (same root)
   Example: "PLAYS" is INVALID if "PLAYER" is on board (both share "PLAY")
☐ **RULE 6: PLURAL/CONJUGATION** - Clue cannot be plural/conjugation of board word
   Example: "CATS" is INVALID if "CAT" is on board
   Example: "PLAYED" is INVALID if "PLAY" is on board

## PROCESS:
For each board word, mentally check ALL 6 rules. If ANY rule fails for ANY word → INVALID.

## IMPORTANT:
- Semantic similarity is VALID (related meanings are OK - that's the game!)
- Only STRING/MORPHOLOGICAL patterns matter
- When in doubt about root words, strip common suffixes: -s, -es, -ed, -ing, -er, -ly, -tion, -ness

Return JSON: {"valid": true/false, "reason": "Rule X violated: [clue] and [board_word] - [explanation]"}
If valid: {"valid": true, "reason": "All 6 rules pass for all board words"}`;
}

export function buildValidatorUserPrompt(
  clue: string,
  boardWords: string[]
): string {
  const clueUpper = clue.toUpperCase();
  const clueRoot = clueUpper.replace(/(S|ES|ED|ING|ER|LY|TION|NESS)$/i, '');
  
  return `## VALIDATE THIS CLUE

**Clue to validate:** "${clue}" (uppercase: ${clueUpper})
**Clue root (without common suffixes):** "${clueRoot}"

**Board words to check against:**
${boardWords.map((w, i) => `${i + 1}. ${w}`).join('\n')}

## CHECK EACH RULE FOR EACH WORD:

Go through EVERY board word and check:

☐ Rule 1 (Spaces): Does "${clue}" contain spaces or hyphens? 
☐ Rule 2 (Exact): Is "${clueUpper}" identical to any board word?
☐ Rule 3 (Clue contains word): Does "${clueUpper}" contain any board word as substring?
☐ Rule 4 (Word contains clue): Is "${clueUpper}" a substring of any board word?
☐ Rule 5 (Shared root): Does "${clueRoot}" appear in any board word, or does any board word's root appear in "${clueUpper}"?
   - Check: Does any word contain "${clueRoot}"? 
   - Check: Does "${clueUpper}" contain the root of any board word?
☐ Rule 6 (Plural/conjugation): Is "${clue}" just a board word with -s/-es/-ed/-ing/-er added or removed?

## EXAMPLES OF VIOLATIONS:
- "HEROES" + "SUPERHERO" → INVALID (both contain "HERO")
- "CATS" + "CAT" → INVALID (plural)
- "SUNLIGHT" + "SUN" → INVALID (contains)
- "PLAY" + "PLAYING" → INVALID (conjugation)

## YOUR RESPONSE:
If ANY rule fails for ANY word: {"valid": false, "reason": "Rule X: [clue] and [board_word] share [pattern]"}
If ALL rules pass: {"valid": true, "reason": "All rules pass"}`;
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
