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
import { saveUser, extractGameSessionData, getUser } from '../utils/userDatabase';
import { updateSummaryAfterGame, updateSummaryOnProfileChange, generateInitialSummary } from '../utils/summaryAgent';

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
export type AppPage = 'welcome' | 'profile' | 'game' | 'metrics';

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
  submitClue: (clue: string, number: number, intendedTargets?: string[]) => Promise<void>;

  // Guesser actions (user is guesser)
  requestAIClue: () => Promise<void>;
  
  // Iterative guessing - single word at a time
  makeGuess: (word: string) => { result: 'correct' | 'wrong' | 'neutral' | 'assassin'; category: CardCategory; continueGuessing: boolean };
  endGuessingPhase: () => void;
  skipCluePhase: () => void; // When timer expires during clue phase

  // AI Guessing helpers
  getAINextGuess: () => string | null;

  // Turn management
  endTurn: () => void;
  processRivalTurn: () => Promise<void>;
  
  // Game cancellation (when navigating away mid-game)
  gameCancelled: boolean;
  cancelGame: () => void;
  
  // Logout - clear profile and go to profile page
  logout: () => void;
}

export const useAppState = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      currentPage: 'welcome',
      setCurrentPage: (page) => set({ currentPage: page }),
      
      // Game cancellation - clear game so no stale state can reappear or get persisted
      gameCancelled: false,
      cancelGame: () => {
        set({ gameCancelled: true, game: null });
      },
      
      // Logout - clear profile and reset state
      logout: () => {
        set({
          profile: DEFAULT_PROFILE,
          hasCompletedProfile: false,
          game: null,
          currentPage: 'profile',
          gameCancelled: false,
        });
      },

      // User profile
      profile: DEFAULT_PROFILE,
      setProfile: (profile) => {
        // Check if user exists in DB and has a summary
        const existingUser = profile.email ? getUser(profile.email) : null;
        const hasExistingSummary = !!(existingUser?.llmSummary);
        
        // Merge existing summary into profile if not provided
        const profileWithSummary = {
          ...profile,
          llmSummary: profile.llmSummary || existingUser?.llmSummary || '',
        };
        
        // Save to database
        saveUser(profileWithSummary);
        set({ profile: profileWithSummary });
        
        // If user is NEW or has NO summary, generate initial summary from profile
        if (profile.email && !hasExistingSummary) {
          generateInitialSummary(profile).then(newSummary => {
            if (newSummary) {
              // Update profile and database with the new summary
              const updatedProfile = { ...profile, llmSummary: newSummary };
              saveUser(updatedProfile);
              set({ profile: updatedProfile });
            }
          }).catch(err => {
            console.error('Error generating initial summary:', err);
          });
        }
        // If user HAS a summary, update it based on profile changes
        else if (profile.email && hasExistingSummary) {
          updateSummaryOnProfileChange(profile.email).then(newSummary => {
            if (newSummary) {
              // Sync updated summary back to profile state
              set(state => ({
                profile: { ...state.profile, llmSummary: newSummary }
              }));
            }
          }).catch(err => {
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
          updateSummaryAfterGame(profile.email, sessionData).then(newSummary => {
            if (newSummary) {
              // Sync updated summary back to profile state
              set(state => ({
                profile: { ...state.profile, llmSummary: newSummary }
              }));
            }
          }).catch(err => {
            console.error('Error updating summary after game:', err);
          });
        }
      },
      showSurvey: false,
      setShowSurvey: (show) => set({ showSurvey: show }),

      // Game actions
      startNewGame: () => {
        const { settings } = get();
        
        // Randomize who starts (50/50 chance)
        const startingTeam: Team = Math.random() < 0.5 ? 'teamA' : 'teamB';
        const board = generateBoard(startingTeam);
        
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
      submitClue: async (clue, number, intendedTargets) => {
        const { game, profile, gameCancelled } = get();
        if (!game || gameCancelled) return;
        const gameId = game.id; // Guard: only apply async result if still same game

        // Set initial state with loading
        const userTeam = game.settings.playerTeam === 'red' ? 'teamA' : 'teamB';
        const guessesAllowed = number === 0 || number === -1 ? 99 : number + 1;

        set({
          game: {
            ...game,
            currentClue: { word: clue, number, intendedTargets },
            currentPhase: 'guess',
            guessesRemaining: guessesAllowed,
            currentTurnGuesses: [],
            currentTurnResults: [],
            turnStartTime: Date.now(),
            phaseTimeLimit: getPhaseTimeLimit(get().settings.timerMinutes),
            aiPlannedGuesses: undefined as unknown as string[], // undefined = AI thinking, [] = AI passed, [...] = AI has guesses
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
          
          // Only apply if still same game (user didn't cancel and start a new game)
          const current = get();
          if (current.gameCancelled || current.game?.id !== gameId) return;
          const currentGame = current.game;
          if (currentGame && currentGame.currentClue?.word === clue) {
            set({
              game: {
                ...currentGame,
                aiPlannedGuesses: aiResponse.guesses,
                aiGuesserReasoning: aiResponse.reasoning,
                aiGuesserWordConfidences: aiResponse.allWordConfidences,
                aiGuesserWordExplanations: aiResponse.wordExplanations,
              },
            });
          }
        } catch (error) {
          console.error('Error getting AI guesses:', error);
          const current = get();
          if (current.gameCancelled || current.game?.id !== gameId) return;
          const teamWords = game.board.cards
            .filter(c => c.category === userTeam && !c.revealed)
            .map(c => c.word);
          const shuffled = [...teamWords].sort(() => Math.random() - 0.5);
          const currentGame = current.game;
          if (currentGame) {
            set({
              game: {
                ...currentGame,
                aiPlannedGuesses: shuffled.slice(0, Math.min(number + 1, shuffled.length)),
                aiGuesserReasoning: 'Fallback - random selection',
              },
            });
          }
        }
      },

      // Guesser actions - get AI clue
      requestAIClue: async () => {
        const { game, profile, gameCancelled } = get();
        if (!game || gameCancelled) return;
        const gameId = game.id;

        // Get AI clue for the user's team (AI is spymaster for user's team)
        const userTeam = game.settings.playerTeam === 'red' ? 'teamA' : 'teamB';

        try {
          const aiResponse = await aiSpymaster(
            game.board,
            userTeam,
            profile,
            game.turnHistory
          );
          
          const current = get();
          if (current.gameCancelled || current.game?.id !== gameId) return;
          const currentGame = current.game;
          if (!currentGame) return;
          
          const guessesAllowed = aiResponse.number === 0 || aiResponse.number === -1 ? 99 : aiResponse.number + 1;

          set({
            game: {
              ...currentGame,
              currentClue: { 
                word: aiResponse.clue, 
                number: aiResponse.number,
                intendedTargets: aiResponse.targetWords,
                reasoning: aiResponse.reasoning,
              },
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
          const current = get();
          if (current.gameCancelled || current.game?.id !== gameId) return;
          const currentGame = current.game;
          if (!currentGame) return;
          set({
            game: {
              ...currentGame,
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
          // Rebuild guesser reasoning based on ACTUAL guesses (not planned)
          let actualGuesserReasoning = game.aiGuesserReasoning;
          if (game.settings.playerRole === 'spymaster' && game.aiGuesserWordExplanations && newGuesses.length > 0) {
            // Extract +1 rule info from original reasoning
            const plusOneMatch = game.aiGuesserReasoning?.match(/I also guessed '(\w+)' using the \+1 rule from '([^']+)' - ([^.]+)\./i);
            const plusOneWord = plusOneMatch?.[1]?.toUpperCase();
            const plusOneClue = plusOneMatch?.[2];
            const plusOneExplanation = plusOneMatch?.[3];
            
            // Build explanations for current clue words only
            const currentClueWords = newGuesses.filter(w => w.toUpperCase() !== plusOneWord);
            const explanations = currentClueWords.map(word => {
              const wordUpper = word.toUpperCase();
              const explanation = game.aiGuesserWordExplanations?.[wordUpper];
              if (explanation) {
                const cleanExplanation = explanation.replace(/^because\s*/i, '').replace(/\.+$/, '').trim();
                return `'${word}' - ${cleanExplanation}`;
              }
              return `'${word}'`;
            });
            
            // Build base reasoning for current clue
            if (explanations.length === 0) {
              actualGuesserReasoning = '';
            } else if (explanations.length === 1) {
              actualGuesserReasoning = `For the clue '${game.currentClue?.word}', I guessed ${explanations[0]}.`;
            } else {
              actualGuesserReasoning = `For the clue '${game.currentClue?.word}', I guessed ${explanations.join('; ')}.`;
            }
            
            // Add +1 rule info if that word was actually guessed
            if (plusOneWord && plusOneClue && newGuesses.some(w => w.toUpperCase() === plusOneWord)) {
              const plusOneWordProper = newGuesses.find(w => w.toUpperCase() === plusOneWord);
              if (plusOneExplanation) {
                actualGuesserReasoning += ` I also guessed '${plusOneWordProper}' using the +1 rule from '${plusOneClue}' - ${plusOneExplanation}.`;
              } else {
                actualGuesserReasoning += ` I also guessed '${plusOneWordProper}' using the +1 rule from '${plusOneClue}'.`;
              }
            }
          }

          const turnEvent = createTurnEvent(
            game.currentTeam,
            game.settings.playerRole === 'spymaster' ? 'spymaster' : 'guesser',
            game.currentClue?.word || '',
            game.currentClue?.number || 0,
            newGuesses,
            newResults,
            newBoard.teamARemaining,
            newBoard.teamBRemaining,
            game.currentClue?.intendedTargets,
            game.currentClue?.reasoning,
            actualGuesserReasoning,
            game.aiGuesserWordConfidences,
            game.aiGuesserWordExplanations
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
          return;
        }

        // Rebuild guesser reasoning based on ACTUAL guesses (not planned)
        // This ensures we only explain words that were ACTUALLY guessed in the game
        let actualGuesserReasoning = game.aiGuesserReasoning;
        if (game.settings.playerRole === 'spymaster' && game.aiGuesserWordExplanations && game.currentTurnGuesses && game.currentTurnGuesses.length > 0) {
          const actuallyGuessedWords = game.currentTurnGuesses;
          
          // Extract +1 rule info from original reasoning
          const plusOneMatch = game.aiGuesserReasoning?.match(/I also guessed '(\w+)' using the \+1 rule from '([^']+)' - ([^.]+)\./i);
          const plusOneWord = plusOneMatch?.[1]?.toUpperCase();
          const plusOneClue = plusOneMatch?.[2];
          const plusOneExplanation = plusOneMatch?.[3];
          
          // Build explanations for current clue words only
          const currentClueWords = actuallyGuessedWords.filter(w => w.toUpperCase() !== plusOneWord);
          const explanations = currentClueWords.map(word => {
            const wordUpper = word.toUpperCase();
            const explanation = game.aiGuesserWordExplanations?.[wordUpper];
            if (explanation) {
              const cleanExplanation = explanation.replace(/^because\s*/i, '').replace(/\.+$/, '').trim();
              return `'${word}' - ${cleanExplanation}`;
            }
            return `'${word}'`;
          });
          
          // Build base reasoning for current clue
          if (explanations.length === 0) {
            actualGuesserReasoning = '';
          } else if (explanations.length === 1) {
            actualGuesserReasoning = `For the clue '${game.currentClue?.word}', I guessed ${explanations[0]}.`;
          } else {
            actualGuesserReasoning = `For the clue '${game.currentClue?.word}', I guessed ${explanations.join('; ')}.`;
          }
          
          // Add +1 rule info if that word was actually guessed
          if (plusOneWord && plusOneClue && actuallyGuessedWords.some(w => w.toUpperCase() === plusOneWord)) {
            const plusOneWordProper = actuallyGuessedWords.find(w => w.toUpperCase() === plusOneWord);
            if (plusOneExplanation) {
              actualGuesserReasoning += ` I also guessed '${plusOneWordProper}' using the +1 rule from '${plusOneClue}' - ${plusOneExplanation}.`;
            } else {
              actualGuesserReasoning += ` I also guessed '${plusOneWordProper}' using the +1 rule from '${plusOneClue}'.`;
            }
          }
        }

        const turnEvent = createTurnEvent(
          game.currentTeam,
          game.settings.playerRole === 'spymaster' ? 'spymaster' : 'guesser',
          game.currentClue?.word || '',
          game.currentClue?.number || 0,
          game.currentTurnGuesses || [],
          game.currentTurnResults || [],
          game.board.teamARemaining,
          game.board.teamBRemaining,
          game.currentClue?.intendedTargets,  // Store what the spymaster intended
          game.currentClue?.reasoning,        // Store spymaster's reasoning
          actualGuesserReasoning,             // Store AI guesser's reasoning (rebuilt for actual guesses)
          game.aiGuesserWordConfidences,      // Store AI guesser's word confidences for persistence
          game.aiGuesserWordExplanations      // Store AI guesser's word explanations
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
            aiGuesserReasoning: undefined,
            aiGuesserWordConfidences: undefined, // Clear stale confidence data from previous turn
            aiGuesserWordExplanations: undefined, // Clear stale explanations from previous turn
          },
        });
      },

      // Skip clue phase when timer expires (no clue given = forfeit turn)
      skipCluePhase: () => {
        const { game } = get();
        if (!game) return;
        if (game.status === 'gameOver') return;
        if (game.currentPhase !== 'clue') {
          return;
        }


        // Create a turn event with no clue (skipped turn)
        const turnEvent = createTurnEvent(
          game.currentTeam,
          game.settings.playerRole === 'spymaster' ? 'spymaster' : 'guesser',
          '[SKIPPED]', // No clue given
          0,
          [],
          [],
          game.board.teamARemaining,
          game.board.teamBRemaining,
          undefined, // intendedTargets
          undefined, // spymasterReasoning
          undefined, // guesserReasoning
          undefined, // guesserWordConfidences
          undefined  // guesserWordExplanations
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
            aiGuesserWordConfidences: undefined, // Clear stale confidence data
            aiGuesserWordExplanations: undefined, // Clear stale explanations
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
        if (gameCancelled) return;
        const gameId = game.id;

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
          
          const current = get();
          if (current.gameCancelled || current.game?.id !== gameId) return;
          const currentGame = current.game;
          if (!currentGame) return;
          
          // Set the clue and enter guess phase
          set({
            game: {
              ...currentGame,
              currentClue: { 
                word: rivalResult.clue, 
                number: rivalResult.number,
                intendedTargets: rivalResult.intendedTargets,
                reasoning: rivalResult.reasoning,
              },
              currentPhase: 'guess',
              guessesRemaining: rivalResult.guesses.length,
              currentTurnGuesses: [],
              currentTurnResults: [],
              turnStartTime: Date.now(),
              phaseTimeLimit: getPhaseTimeLimit(get().settings.timerMinutes),
              aiPlannedGuesses: rivalResult.guesses,
              turnShouldEnd: false,
              aiGuesserWordConfidences: rivalResult.guesserWordConfidences, // Store rival's confidences
              aiGuesserWordExplanations: rivalResult.guesserWordExplanations, // Store rival's explanations
            },
          });

          // Wait to show the clue
          await new Promise(resolve => setTimeout(resolve, 2500));
          
          // Check if cancelled during wait
          if (get().gameCancelled) {
            return;
          }

          // If rival AI decided to pass (no guesses), end turn immediately
          if (rivalResult.guesses.length === 0) {
            const { game: finalGame, gameCancelled: cancelled } = get();
            if (finalGame && finalGame.id === gameId && finalGame.status === 'playing' && !cancelled) {
              get().endGuessingPhase();
            }
            return;
          }

          // Process each guess one by one with delay
          for (const guess of rivalResult.guesses) {
            await new Promise(resolve => setTimeout(resolve, 2500));

            const { game: updatedGame, gameCancelled: cancelled } = get();
            if (!updatedGame || updatedGame.id !== gameId || updatedGame.status === 'gameOver' || cancelled) {
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
          if (finalGame && finalGame.id === gameId && finalGame.status === 'playing' && !cancelled) {
            get().endGuessingPhase();
          }
        } catch (error) {
          console.error('Error processing rival turn:', error);
          const current = get();
          if (current.game && current.game.id === gameId && !current.gameCancelled) {
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
