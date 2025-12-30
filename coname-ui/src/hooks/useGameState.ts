import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  GameState,
  GameSettings,
  UserProfile,
  SurveyResponse,
  Team,
  CardCategory,
} from '../types/game';
import {
  generateBoard,
  revealCard,
  checkGameOver,
  generateId,
  createTurnEvent,
} from '../utils/gameLogic';
import { aiSpymaster, aiGuesser, rivalTurn } from '../utils/ai-agents';
import { saveUser, extractGameSessionData } from '../utils/userDatabase';
import { updateSummaryAfterGame, updateSummaryOnProfileChange } from '../utils/summaryAgent';

// Default profile - enhanced for AI context
const DEFAULT_PROFILE: UserProfile = {
  email: '',
  age: '',
  occupation: '',
  problemSolvingApproach: '',
  interests: [],
  additionalNotes: '',
};

// Default settings - simplified (no demo mode, rival always AI)
const DEFAULT_SETTINGS: GameSettings = {
  playerRole: 'spymaster',
  playerTeam: 'red',
  timerMinutes: 2, // 2 minutes default
};

// Helper function to get phase time limit based on settings
const getPhaseTimeLimit = (timerMinutes: number): number => {
  if (timerMinutes === 0) return 999999; // No timer (very large number)
  return timerMinutes * 60; // Convert minutes to seconds
};

// App page/view
export type AppPage = 'welcome' | 'profile' | 'game';

interface AppState {
  // Navigation
  currentPage: AppPage;
  setCurrentPage: (page: AppPage) => void;

  // User profile
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  hasCompletedProfile: boolean;
  setHasCompletedProfile: (completed: boolean) => void;

  // Game state
  game: GameState | null;
  settings: GameSettings;
  setSettings: (settings: Partial<GameSettings>) => void;

  // Survey - only at end of game
  surveyResponses: SurveyResponse[];
  addSurveyResponse: (response: SurveyResponse) => void;
  showSurvey: boolean;
  setShowSurvey: (show: boolean) => void;

  // Game actions
  startNewGame: () => void;
  resumeGame: () => boolean;
  hasExistingGame: () => boolean;

  // Spymaster actions (user is spymaster)
  submitClue: (clue: string, number: number) => Promise<void>;

  // Guesser actions (user is guesser)
  requestAIClue: () => Promise<void>;
  
  // Iterative guessing - single word at a time
  makeGuess: (word: string) => { result: 'correct' | 'wrong' | 'neutral' | 'assassin'; category: CardCategory; continueGuessing: boolean };
  endGuessingPhase: () => void;

  // AI Guessing helpers
  getAINextGuess: () => string | null;

  // Turn management
  endTurn: () => void;
  processRivalTurn: () => Promise<void>;
  
  // Game cancellation (when navigating away mid-game)
  gameCancelled: boolean;
  cancelGame: () => void;
}

export const useAppState = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      currentPage: 'welcome',
      setCurrentPage: (page) => set({ currentPage: page }),
      
      // Game cancellation
      gameCancelled: false,
      cancelGame: () => {
        console.log('🛑 [GAME] Game cancelled - stopping all AI processes');
        set({ gameCancelled: true });
      },

      // User profile
      profile: DEFAULT_PROFILE,
      setProfile: (profile) => {
        // Save to database
        saveUser(profile);
        set({ profile });
        
        // If user has played games before, update their summary based on profile changes
        if (profile.email) {
          updateSummaryOnProfileChange(profile.email).catch(err => {
            console.error('Error updating summary on profile change:', err);
          });
        }
      },
      hasCompletedProfile: false,
      setHasCompletedProfile: (completed) => set({ hasCompletedProfile: completed }),

      // Game state
      game: null,
      settings: DEFAULT_SETTINGS,
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Survey - only at end of game
      surveyResponses: [],
      addSurveyResponse: (response) => {
        const { game, profile } = get();
        
        set((state) => ({
          surveyResponses: [...state.surveyResponses, response],
          showSurvey: false,
        }));
        
        // After survey is submitted, update the user's LLM summary
        if (game && profile.email && game.status === 'gameOver') {
          const sessionData = extractGameSessionData(game, response.userFeedback, response);
          updateSummaryAfterGame(profile.email, sessionData).catch(err => {
            console.error('Error updating summary after game:', err);
          });
        }
      },
      showSurvey: false,
      setShowSurvey: (show) => set({ showSurvey: show }),

      // Game actions
      startNewGame: () => {
        const { settings } = get();
        
        // Get language from localStorage
        const language = (localStorage.getItem('coname-language') || 'en') as 'en' | 'he';
        
        // Randomize who starts (50/50 chance)
        const startingTeam: Team = Math.random() < 0.5 ? 'teamA' : 'teamB';
        const board = generateBoard(startingTeam, language);
        
        const newGame: GameState = {
          id: generateId(),
          status: 'playing',
          board,
          currentTeam: startingTeam,
          currentPhase: 'clue',
          settings,
          turnHistory: [],
          surveyResponses: [],
          guessesRemaining: 0,
          currentTurnGuesses: [],
          currentTurnResults: [],
          turnStartTime: Date.now(),
          phaseTimeLimit: getPhaseTimeLimit(settings.timerMinutes),
          aiPlannedGuesses: [],
          turnShouldEnd: false,
          startingTeam,
        };
        set({ game: newGame, currentPage: 'game', showSurvey: false, gameCancelled: false });
      },

      resumeGame: () => {
        const { game } = get();
        if (game && game.status === 'playing') {
          set({ currentPage: 'game' });
          return true;
        }
        return false;
      },

      hasExistingGame: () => {
        const { game } = get();
        return game !== null && game.status === 'playing';
      },

      // Spymaster actions - submit clue and prepare AI guesses
      submitClue: async (clue, number) => {
        const { game, profile, gameCancelled } = get();
        if (!game || gameCancelled) return;

        // Set initial state with loading
        const userTeam = game.settings.playerTeam === 'red' ? 'teamA' : 'teamB';
        const guessesAllowed = number === 0 || number === -1 ? 99 : number + 1;

        set({
          game: {
            ...game,
            currentClue: { word: clue, number },
            currentPhase: 'guess',
            guessesRemaining: guessesAllowed,
            currentTurnGuesses: [],
            currentTurnResults: [],
            turnStartTime: Date.now(),
            phaseTimeLimit: getPhaseTimeLimit(get().settings.timerMinutes),
            aiPlannedGuesses: undefined, // Will be populated after AI call
            turnShouldEnd: false,
          },
        });

        // Get AI's planned guesses asynchronously
        try {
          const aiResponse = await aiGuesser(
            clue,
            number === -1 ? 9 : number,
            game.board,
            userTeam,
            profile,
            game.turnHistory
          );
          
          // Check if cancelled during API call
          if (get().gameCancelled) return;
          
          // Update with AI guesses
          const currentGame = get().game;
          if (currentGame && currentGame.currentClue?.word === clue) {
            set({
              game: {
                ...currentGame,
                aiPlannedGuesses: aiResponse.guesses,
              },
            });
          }
        } catch (error) {
          console.error('Error getting AI guesses:', error);
          // Fallback: pick random team words
          const teamWords = game.board.cards
            .filter(c => c.category === userTeam && !c.revealed)
            .map(c => c.word);
          const shuffled = [...teamWords].sort(() => Math.random() - 0.5);
          const currentGame = get().game;
          if (currentGame) {
            set({
              game: {
                ...currentGame,
                aiPlannedGuesses: shuffled.slice(0, Math.min(number + 1, shuffled.length)),
              },
            });
          }
        }
      },

      // Guesser actions - get AI clue
      requestAIClue: async () => {
        const { game, profile, gameCancelled } = get();
        if (!game || gameCancelled) return;

        // Get AI clue for the user's team (AI is spymaster for user's team)
        const userTeam = game.settings.playerTeam === 'red' ? 'teamA' : 'teamB';

        try {
          const aiResponse = await aiSpymaster(
            game.board,
            userTeam,
            profile,
            game.turnHistory
          );
          
          // Check if cancelled during API call
          if (get().gameCancelled) return;
          
          const guessesAllowed = aiResponse.number === 0 || aiResponse.number === -1 ? 99 : aiResponse.number + 1;

          set({
            game: {
              ...game,
              currentClue: { word: aiResponse.clue, number: aiResponse.number },
              currentPhase: 'guess',
              guessesRemaining: guessesAllowed,
              currentTurnGuesses: [],
              currentTurnResults: [],
              turnStartTime: Date.now(),
              phaseTimeLimit: getPhaseTimeLimit(get().settings.timerMinutes),
              aiPlannedGuesses: [],
              turnShouldEnd: false,
            },
          });
        } catch (error) {
          console.error('Error getting AI clue:', error);
          // Don't set fallback if cancelled
          if (get().gameCancelled) return;
          // Fallback clue
          set({
            game: {
              ...game,
              currentClue: { word: 'HINT', number: 2 },
              currentPhase: 'guess',
              guessesRemaining: 3,
              currentTurnGuesses: [],
              currentTurnResults: [],
              turnStartTime: Date.now(),
              phaseTimeLimit: getPhaseTimeLimit(get().settings.timerMinutes),
              aiPlannedGuesses: [],
              turnShouldEnd: false,
            },
          });
        }
      },

      // Get next AI guess
      getAINextGuess: () => {
        const { game } = get();
        if (!game || !game.aiPlannedGuesses) return null;
        
        const madeGuesses = game.currentTurnGuesses || [];
        const nextGuess = game.aiPlannedGuesses.find(g => !madeGuesses.includes(g));
        return nextGuess || null;
      },

      // Make a single guess - returns result immediately
      makeGuess: (word) => {
        const { game } = get();
        if (!game) {
          return { result: 'wrong' as const, category: 'neutral' as CardCategory, continueGuessing: false };
        }

        const { newBoard, result, category } = revealCard(game.board, word, game.currentTeam);
        
        const guessResult = {
          word,
          correct: result === 'correct',
          category,
        };

        const newGuesses = [...(game.currentTurnGuesses || []), word];
        const newResults = [...(game.currentTurnResults || []), guessResult];
        const newGuessesRemaining = (game.guessesRemaining || 0) - 1;

        // Check for game over
        const gameOverCheck = checkGameOver(newBoard);
        if (gameOverCheck.gameOver) {
          const turnEvent = createTurnEvent(
            game.currentTeam,
            game.settings.playerRole === 'spymaster' ? 'spymaster' : 'guesser',
            game.currentClue?.word || '',
            game.currentClue?.number || 0,
            newGuesses,
            newResults,
            newBoard.teamARemaining,
            newBoard.teamBRemaining
          );

          set({
            game: {
              ...game,
              board: newBoard,
              status: 'gameOver',
              winner: gameOverCheck.winner,
              gameOverReason: gameOverCheck.reason,
              turnHistory: [...game.turnHistory, turnEvent],
              currentClue: undefined,
              guessesRemaining: 0,
              currentTurnGuesses: newGuesses,
              currentTurnResults: newResults,
              turnShouldEnd: false,
            },
            showSurvey: false, // Survey will be shown after user clicks the initial message
          });

          return { result, category, continueGuessing: false };
        }

        // Check if turn should continue
        const continueGuessing = result === 'correct' && newGuessesRemaining > 0;

        set({
          game: {
            ...game,
            board: newBoard,
            guessesRemaining: newGuessesRemaining,
            currentTurnGuesses: newGuesses,
            currentTurnResults: newResults,
            turnShouldEnd: !continueGuessing,
          },
        });

        return { result, category, continueGuessing };
      },

      endGuessingPhase: () => {
        const { game } = get();
        if (!game) return;
        if (game.status === 'gameOver') return;
        // Only end guessing phase if we're actually in guess phase with a clue
        if (game.currentPhase !== 'guess' || !game.currentClue) {
          console.log('Cannot end guessing phase - not in guess phase or no clue');
          return;
        }

        const turnEvent = createTurnEvent(
          game.currentTeam,
          game.settings.playerRole === 'spymaster' ? 'spymaster' : 'guesser',
          game.currentClue?.word || '',
          game.currentClue?.number || 0,
          game.currentTurnGuesses || [],
          game.currentTurnResults || [],
          game.board.teamARemaining,
          game.board.teamBRemaining
        );

        const nextTeam: Team = game.currentTeam === 'teamA' ? 'teamB' : 'teamA';

        set({
          game: {
            ...game,
            currentTeam: nextTeam,
            currentPhase: 'clue',
            turnHistory: [...game.turnHistory, turnEvent],
            currentClue: undefined,
            guessesRemaining: 0,
            currentTurnGuesses: [],
            currentTurnResults: [],
            turnStartTime: Date.now(),
            phaseTimeLimit: getPhaseTimeLimit(get().settings.timerMinutes),
            aiPlannedGuesses: [],
            turnShouldEnd: false,
          },
        });
      },

      endTurn: () => {
        get().endGuessingPhase();
      },

      // Process rival turn iteratively
      processRivalTurn: async () => {
        const { game, gameCancelled } = get();
        if (!game || game.status !== 'playing') return;
        if (gameCancelled) {
          console.log('🛑 [RIVAL TURN] Game cancelled, aborting');
          return;
        }
        
        // Only process if we're in clue phase
        if (game.currentPhase !== 'clue') return;
        
        // Check if it's actually rival's turn - use game.settings for consistency
        const userTeam = game.settings.playerTeam === 'red' ? 'teamA' : 'teamB';
        if (game.currentTeam === userTeam) {
          return; // It's user's turn, don't process
        }

        try {
          // First, generate the clue using AI
          const rivalResult = await rivalTurn(
            game.board,
            game.currentTeam,
            game.turnHistory
          );
          
          // Check if cancelled during API call
          if (get().gameCancelled) {
            console.log('🛑 [RIVAL TURN] Game cancelled after clue generation, aborting');
            return;
          }
          
          // Set the clue and enter guess phase
          set({
            game: {
              ...game,
              currentClue: { word: rivalResult.clue, number: rivalResult.number },
              currentPhase: 'guess',
              guessesRemaining: rivalResult.guesses.length,
              currentTurnGuesses: [],
              currentTurnResults: [],
              turnStartTime: Date.now(),
              phaseTimeLimit: getPhaseTimeLimit(get().settings.timerMinutes),
              aiPlannedGuesses: rivalResult.guesses,
              turnShouldEnd: false,
            },
          });

          // Wait to show the clue
          await new Promise(resolve => setTimeout(resolve, 2500));
          
          // Check if cancelled during wait
          if (get().gameCancelled) {
            console.log('🛑 [RIVAL TURN] Game cancelled, aborting');
            return;
          }

          // If rival AI decided to pass (no guesses), end turn immediately
          if (rivalResult.guesses.length === 0) {
            console.log('🤖 [RIVAL TURN] Rival AI decided to PASS - no guesses');
            const { game: finalGame, gameCancelled: cancelled } = get();
            if (finalGame && finalGame.status === 'playing' && !cancelled) {
              get().endGuessingPhase();
            }
            return;
          }

          // Process each guess one by one with delay
          for (const guess of rivalResult.guesses) {
            await new Promise(resolve => setTimeout(resolve, 2500));

            const { game: updatedGame, gameCancelled: cancelled } = get();
            if (!updatedGame || updatedGame.status === 'gameOver' || cancelled) {
              if (cancelled) console.log('🛑 [RIVAL TURN] Game cancelled during guessing, aborting');
              break;
            }

            const card = updatedGame.board.cards.find(c => c.word === guess && !c.revealed);
            if (!card) continue;

            const { result } = get().makeGuess(guess);

            // Wait to show the result
            await new Promise(resolve => setTimeout(resolve, 1500));

            // If wrong guess, break
            if (result !== 'correct') {
              break;
            }
          }

          // End rival turn after delay
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const { game: finalGame, gameCancelled: cancelled } = get();
          if (finalGame && finalGame.status === 'playing' && !cancelled) {
            get().endGuessingPhase();
          }
        } catch (error) {
          console.error('Error processing rival turn:', error);
          // Fallback: end turn (only if not cancelled)
          if (!get().gameCancelled) {
            get().endGuessingPhase();
          }
        }
      },

    }),
    {
      name: 'coname-storage',
      partialize: (state) => ({
        profile: state.profile,
        hasCompletedProfile: state.hasCompletedProfile,
        game: state.game,
        settings: state.settings,
        surveyResponses: state.surveyResponses,
      }),
    }
  )
);
