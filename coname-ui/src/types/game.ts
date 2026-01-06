// ============================================
// CORE TYPES
// ============================================

export type CardCategory = 'teamA' | 'teamB' | 'neutral' | 'assassin';
export type PlayerRole = 'spymaster' | 'guesser';
export type Team = 'teamA' | 'teamB';
export type TeamColor = 'red' | 'blue';
export type GamePhase = 'clue' | 'guess';
export type GameStatus = 'setup' | 'playing' | 'paused' | 'gameOver';

// ============================================
// CARD & BOARD
// ============================================

export interface WordCard {
  word: string;
  category: CardCategory;
  revealed: boolean;
  selectedBy?: Team;
}

export interface BoardState {
  cards: WordCard[];
  teamARemaining: number;
  teamBRemaining: number;
}

// ============================================
// TURN & EVENTS
// ============================================

export interface TurnEvent {
  id: string;
  timestamp: number;
  team: Team;
  role: PlayerRole;
  clue: string;
  clueNumber: number;
  guesses: string[];
  guessResults: { word: string; correct: boolean; category: CardCategory }[];
  teamARemaining: number;
  teamBRemaining: number;
  
  // Spymaster's intended targets and reasoning (for both AI and user)
  intendedTargets?: string[];
  spymasterReasoning?: string;
  
  // Guesser's reasoning for their guesses (AI guesser only)
  guesserReasoning?: string;
}

export interface GuessResult {
  word: string;
  correct: boolean;
  category: CardCategory;
}

// ============================================
// SURVEY & FEEDBACK
// ============================================

export interface SurveyResponse {
  turnId: string;
  timestamp: number;
  playerRole: PlayerRole;
  clueClarity: number;
  trustInAI: number;
  
  // Spymaster-specific (when user is spymaster, rating AI guesser)
  aiGuessAccuracy?: number;
  aiRiskLevel?: number;
  aiUnderstandsClues?: number;
  
  // Guesser-specific (when user is guesser, rating AI spymaster)
  clueRelevance?: number;
  aiPlayStyle?: number;
  
  // Text feedback - user's written comments about the game/AI
  userFeedback?: string;
}

// ============================================
// USER PROFILE
// Enhanced for better AI context in future integration
// ============================================

export interface UserProfile {
  // User identification - mandatory
  email: string;
  
  // Demographics - optional, helps AI understand user context
  age?: string;
  occupation?: string;
  
  // Cognitive/Mental Model - optional
  problemSolvingApproach?: 'systematic' | 'creative' | 'both' | '';
  
  // Interests - helps AI generate relevant clues (optional)
  interests?: string[];
  
  // Additional context - optional
  additionalNotes?: string;
  
  // LLM-generated summary - updated after each game
  // Contains learned patterns about what works/doesn't work with this user
  llmSummary?: string;
}

// ============================================
// GAME SETTINGS
// ============================================

export interface GameSettings {
  playerRole: PlayerRole;
  playerTeam: TeamColor;
  timerMinutes: number; // Timer duration in minutes (0 = no timer)
  // Note: Rival team is always AI-controlled (autoplay)
  // Note: Visibility is role-based - Spymaster sees all colors, Guesser sees none
}

// ============================================
// TIMER CONFIGURATION
// ============================================

export interface TimerConfig {
  clueTimeSeconds: number;      // Time to give a clue
  guessTimeSeconds: number;     // Time per guess
  aiThinkingDelayMs: number;    // Simulated AI thinking time
}

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  clueTimeSeconds: 120,         // 2 minutes for clue
  guessTimeSeconds: 60,         // 1 minute per guess decision
  aiThinkingDelayMs: 2000,      // 2 seconds AI "thinking"
};

// ============================================
// GAME STATE
// ============================================

export interface GameState {
  id: string;
  status: GameStatus;
  winner?: Team;
  board: BoardState;
  currentTeam: Team;
  currentPhase: GamePhase;
  settings: GameSettings;
  turnHistory: TurnEvent[];
  surveyResponses: SurveyResponse[];
  currentClue?: { 
    word: string; 
    number: number; 
    intendedTargets?: string[];  // Words the spymaster intended to connect
    reasoning?: string;          // AI spymaster's reasoning
  };
  
  // Iterative guessing state
  guessesRemaining: number;
  currentTurnGuesses: string[];
  currentTurnResults: GuessResult[];
  
  // Timer state
  turnStartTime: number;
  phaseTimeLimit: number;       // Seconds remaining for current phase
  
  // AI planned guesses
  // TODO: Replace with real AI integration - currently uses stub
  aiPlannedGuesses: string[];
  
  // Turn control
  turnShouldEnd: boolean;
  
  // AI reasoning (stored temporarily during turn, saved to turn history at end)
  aiGuesserReasoning?: string;
  
  // Game metadata
  startingTeam?: Team;
  gameOverReason?: string;
}

// ============================================
// VALIDATION
// ============================================

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// ============================================
// AI RESPONSES
// TODO: These interfaces will be used for real AI integration
// ============================================

export interface SpymasterResponse {
  clue: string;
  number: number;
  reasoning?: string;
  targetWords?: string[];  // Words the AI intended to connect
}

export interface GuesserResponse {
  guesses: string[];
  confidence?: number[];
  reasoning?: string;
  // TODO: Add word-by-word explanation from AI
}

// ============================================
// AI INTEGRATION POINTS (TODO)
// ============================================

/**
 * TODO: AI Integration Checklist
 * 
 * 1. Spymaster AI (when user is Guesser):
 *    - Replace aiSpymasterStub with real LLM call
 *    - Send: board state, user profile, turn history
 *    - Receive: clue word, number, reasoning
 * 
 * 2. Guesser AI (when user is Spymaster):
 *    - Replace aiGuesserStub with real LLM call
 *    - Send: clue, board state, user profile, turn history
 *    - Receive: ordered guesses with confidence
 * 
 * 3. Rival Team AI:
 *    - Replace rivalTurnStub with real LLM call
 *    - Should have its own "personality" different from teammate
 * 
 * 4. Clue Validation:
 *    - Replace validator_stub with real validation
 *    - Could use LLM to check semantic similarity to board words
 * 
 * 5. Profile-Aware Personalization:
 *    - Use UserProfile to customize AI behavior
 *    - Adjust clue style, risk level, cultural references
 */
