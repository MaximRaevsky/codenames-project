import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Home, Settings } from 'lucide-react';
import { useAppState } from '../hooks/useGameState';
import { GameBoard } from '../components/GameBoard';
import { SidePanel } from '../components/SidePanel';
import { ClueInput } from '../components/ClueInput';
import { GuessSequence } from '../components/GuessSequence';
import { MicroSurvey } from '../components/MicroSurvey';
import { GameOverModal } from '../components/GameOverModal';
import { CountdownTimer } from '../components/CountdownTimer';
import { RulesTooltip } from '../components/RulesTooltip';
import { Logo } from '../components/Logo';

export function GamePage() {
  const {
    game,
    settings,
    setCurrentPage,
    startNewGame,
    resetGame,
    submitClue,
    requestAIClue,
    makeGuess,
    getAINextGuess,
    endGuessingPhase,
    processRivalTurn,
    showSurvey,
    setShowSurvey,
    addSurveyResponse,
  } = useAppState();

  const [isProcessing, setIsProcessing] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState<string | undefined>();
  const [showGameOverMessage, setShowGameOverMessage] = useState(false);
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const endTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTimerExpired = useRef(false);
  const gameOverMessageShown = useRef(false);

  // Determine if it's user's turn based on team color preference
  // Use game.settings when game exists for consistency
  const isUserTeam = (team: string) => {
    const playerTeam = game?.settings?.playerTeam || settings.playerTeam;
    if (playerTeam === 'red') {
      return team === 'teamA';
    } else {
      return team === 'teamB';
    }
  };

  // Handle timer expiration
  const handleTimerExpired = useCallback(() => {
    if (!game || game.status !== 'playing' || hasTimerExpired.current) return;
    
    hasTimerExpired.current = true;
    
    setTimeout(() => {
      const isGuessPhase = game.currentPhase === 'guess';
      const isCluePhase = game.currentPhase === 'clue';
      
      // If it's guess phase, end the turn
      if (isGuessPhase) {
        endGuessingPhase();
      }
      // If it's clue phase, skip the turn
      else if (isCluePhase) {
        endGuessingPhase();
      }
    }, 100);
  }, [game, endGuessingPhase]);

  // Reset timer expiration flag when turn changes
  useEffect(() => {
    hasTimerExpired.current = false;
  }, [game?.currentTeam, game?.currentPhase]);

  // Handle game over flow: show message -> survey -> final modal
  useEffect(() => {
    if (game?.status === 'gameOver' && !gameOverMessageShown.current) {
      // Show initial game over message only once (no auto-dismiss, user must click)
      gameOverMessageShown.current = true;
      setShowGameOverMessage(true);
      setSurveyDismissed(false);
    }
    
    // Reset when game is no longer over
    if (game?.status !== 'gameOver') {
      setShowGameOverMessage(false);
      setSurveyDismissed(false);
      gameOverMessageShown.current = false;
    }
  }, [game?.status]);

  // Handle clicking the game over message to show survey
  const handleGameOverMessageClick = () => {
    setShowGameOverMessage(false);
    setShowSurvey(true);
  };
  
  // Handle survey close/submit
  const handleSurveyClose = () => {
    setShowSurvey(false);
    setSurveyDismissed(true);
  };
  
  const handleSurveySubmit = (response: any) => {
    addSurveyResponse(response);
    setSurveyDismissed(true);
  };

  // Auto end turn when turnShouldEnd is true - ONLY during guess phase
  useEffect(() => {
    if (game?.turnShouldEnd && game.status === 'playing' && game.currentPhase === 'guess' && game.currentClue && !isProcessing) {
      // Clear any existing timeout
      if (endTurnTimeoutRef.current) {
        clearTimeout(endTurnTimeoutRef.current);
      }
      
      // End turn after a short delay to show the result
      endTurnTimeoutRef.current = setTimeout(() => {
        endGuessingPhase();
      }, 2000);
      
      return () => {
        if (endTurnTimeoutRef.current) {
          clearTimeout(endTurnTimeoutRef.current);
        }
      };
    }
  }, [game?.turnShouldEnd, game?.status, game?.currentPhase, game?.currentClue, isProcessing, endGuessingPhase]);

  // Process AI guessing step by step when it's AI's turn to guess (spymaster mode)
  const processAIGuess = useCallback(async () => {
    if (!game || isProcessing || game.status !== 'playing' || game.turnShouldEnd) return;
    
    const nextGuess = getAINextGuess();
    if (!nextGuess) return;

    setIsProcessing(true);
    
    // Highlight the word AI is about to guess
    setHighlightedWord(nextGuess);
    
    // Wait to show which word AI is considering
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Make the guess
    makeGuess(nextGuess);
    
    // Clear highlight
    await new Promise(resolve => setTimeout(resolve, 500));
    setHighlightedWord(undefined);
    
    setIsProcessing(false);
  }, [game, isProcessing, getAINextGuess, makeGuess]);

  // Trigger AI guessing in spymaster mode (when user is spymaster, AI guesses)
  useEffect(() => {
    if (!game) return;
    
    const isUserTurn = isUserTeam(game.currentTeam);
    const isSpymasterMode = settings.playerRole === 'spymaster';
    const isGuessPhase = game.currentPhase === 'guess';
    const hasAIGuesses = game.aiPlannedGuesses && game.aiPlannedGuesses.length > 0;
    const madeGuesses = game.currentTurnGuesses?.length || 0;
    const hasMoreGuesses = hasAIGuesses && madeGuesses < game.aiPlannedGuesses.length;
    const canContinue = !game.turnShouldEnd;
    
    if (isUserTurn && isSpymasterMode && isGuessPhase && hasMoreGuesses && canContinue && !isProcessing) {
      const timer = setTimeout(processAIGuess, 1500);
      return () => clearTimeout(timer);
    }
    
    // If AI has finished all planned guesses and turn hasn't ended, end it automatically
    if (isUserTurn && isSpymasterMode && isGuessPhase && hasAIGuesses && !hasMoreGuesses && !game.turnShouldEnd && !isProcessing) {
      const timer = setTimeout(() => {
        endGuessingPhase();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [game, settings.playerRole, isProcessing, processAIGuess, endGuessingPhase]);

  // Process rival turn when it's their turn - only in clue phase for rival team
  useEffect(() => {
    if (!game) return;
    if (game.status !== 'playing') return;
    if (game.currentPhase !== 'clue') return;
    // Rival team is always AI-controlled (no manual mode)
    
    // Determine if current team is the user's team - use game.settings for consistency
    const userTeamId = game.settings.playerTeam === 'red' ? 'teamA' : 'teamB';
    const isRivalTurn = game.currentTeam !== userTeamId;
    
    if (isRivalTurn) {
      // Give a longer delay before rival starts their turn
      const timer = setTimeout(() => {
        processRivalTurn();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [game, processRivalTurn]);

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl text-gray-800 mb-4">No active game</h2>
          <button
            onClick={() => setCurrentPage('welcome')}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-display font-semibold rounded-xl"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const isUserTurn = isUserTeam(game.currentTeam);
  const isSpymasterMode = settings.playerRole === 'spymaster';
  const isCluePhase = game.currentPhase === 'clue';
  const isGuessPhase = game.currentPhase === 'guess';
  
  // Team display names based on user's team choice
  const userTeamName = settings.playerTeam === 'red' ? 'Red Team (You)' : 'Blue Team (You)';
  const rivalTeamName = settings.playerTeam === 'red' ? 'Blue Team (Rival)' : 'Red Team (Rival)';
  const userTeamColor = settings.playerTeam;
  const rivalTeamColor = settings.playerTeam === 'red' ? 'blue' : 'red';

  // User (guesser) clicks on board to make guess
  const handleWordClick = async (word: string) => {
    if (!isUserTurn || !isGuessPhase || isProcessing || game.turnShouldEnd) return;
    if (isSpymasterMode) return; // In spymaster mode, AI guesses
    
    setIsProcessing(true);
    
    // User is guesser - make guess
    setHighlightedWord(word);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    makeGuess(word);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    setHighlightedWord(undefined);
    
    setIsProcessing(false);
    // Turn ending is handled by the effect watching turnShouldEnd
  };


  // Determine if guessing can continue
  const canContinueGuessing = !game.turnShouldEnd && (game.guessesRemaining || 0) > 0;

  // Get current team display
  const currentTeamDisplay = isUserTurn ? userTeamName : rivalTeamName;
  const currentTeamColor = isUserTurn ? userTeamColor : rivalTeamColor;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-50 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo size="sm" animate={false} />
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
                <span className="text-xs text-gray-500">You:</span>
                <span className={`text-sm font-medium ${userTeamColor === 'red' ? 'text-red-600' : 'text-blue-600'}`}>
                  {userTeamColor === 'red' ? 'Red' : 'Blue'} {isSpymasterMode ? 'Spymaster' : 'Guesser'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Game Rules Tooltip */}
              <RulesTooltip position="bottom" />

              {/* Edit Profile */}
              <button
                onClick={() => setCurrentPage('profile')}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">Profile</span>
              </button>

              {/* Home */}
              <button
                onClick={() => setCurrentPage('welcome')}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">Home</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Game Board Section */}
          <div className="flex-1 space-y-4">
            {/* Turn Indicator with Timer */}
            <motion.div
              key={`${game.currentTeam}-${game.currentPhase}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between py-3 px-4 rounded-xl shadow-sm ${
                currentTeamColor === 'red'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <span className={`font-display font-semibold ${
                currentTeamColor === 'red' ? 'text-red-600' : 'text-blue-600'
              }`}>
                {currentTeamDisplay} - {isCluePhase ? 'Clue Phase' : 'Guessing Phase'}
              </span>
              
              {/* Countdown Timer */}
              <CountdownTimer
                startTime={game.turnStartTime}
                durationSeconds={game.phaseTimeLimit}
                teamColor={currentTeamColor}
                label={isCluePhase ? 'Clue Time' : 'Guess Time'}
                onTimeUp={handleTimerExpired}
              />
            </motion.div>

            {/* Board - Spymaster sees all colors, Guesser sees none */}
            <GameBoard
              board={game.board}
              showColors={isSpymasterMode}
              isGuessing={isUserTurn && isGuessPhase && !isSpymasterMode && !isProcessing && canContinueGuessing}
              selectedWords={[]}
              highlightedWord={highlightedWord}
              onWordClick={handleWordClick}
            />

            {/* Control Panel */}
            <div className="mt-4">
              {/* User's turn - Clue Phase (Spymaster) */}
              {isUserTurn && isSpymasterMode && isCluePhase && (
                <ClueInput
                  boardWords={game.board.cards}
                  maxNumber={settings.playerTeam === 'red' ? game.board.teamARemaining : game.board.teamBRemaining}
                  onSubmit={submitClue}
                />
              )}

              {/* User's turn - Guess Phase (AI guessing for Spymaster) */}
              {isUserTurn && isSpymasterMode && isGuessPhase && (
                <GuessSequence
                  clue={game.currentClue?.word || ''}
                  clueNumber={game.currentClue?.number || 0}
                  isUserTurn={false}
                  teamName={userTeamName}
                  teamColor={userTeamColor as 'red' | 'blue'}
                  turnStartTime={game.turnStartTime || Date.now()}
                  currentGuesses={game.currentTurnResults || []}
                  guessesRemaining={game.guessesRemaining || 0}
                  isWaitingForGuess={isProcessing || (canContinueGuessing && !game.turnShouldEnd)}
                  onEndTurn={endGuessingPhase}
                  canEndTurn={!isProcessing && canContinueGuessing && (game.currentTurnResults?.length || 0) > 0}
                />
              )}

              {/* User's turn - Clue Phase (Guesser waiting for AI clue) */}
              {isUserTurn && !isSpymasterMode && isCluePhase && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200"
                >
                  <h3 className={`font-display font-bold text-lg ${userTeamColor === 'red' ? 'text-red-600' : 'text-blue-600'} mb-4`}>
                    Waiting for AI Spymaster
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Your AI teammate will provide a clue for you to guess.
                  </p>
                  <button
                    onClick={requestAIClue}
                    className={`w-full py-3 px-6 ${userTeamColor === 'red' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white font-display font-bold rounded-xl`}
                  >
                    Get Clue from AI Spymaster
                  </button>
                </motion.div>
              )}

              {/* User's turn - Guess Phase (User guessing) */}
              {isUserTurn && !isSpymasterMode && isGuessPhase && (
                <GuessSequence
                  clue={game.currentClue?.word || ''}
                  clueNumber={game.currentClue?.number || 0}
                  isUserTurn={true}
                  teamName={userTeamName}
                  teamColor={userTeamColor as 'red' | 'blue'}
                  turnStartTime={game.turnStartTime || Date.now()}
                  currentGuesses={game.currentTurnResults || []}
                  guessesRemaining={game.guessesRemaining || 0}
                  isWaitingForGuess={canContinueGuessing && !game.turnShouldEnd}
                  onEndTurn={endGuessingPhase}
                  canEndTurn={canContinueGuessing && (game.currentTurnResults?.length || 0) > 0}
                />
              )}

              {/* Rival Team Turn */}
              {!isUserTurn && (
                <GuessSequence
                  clue={game.currentClue?.word || ''}
                  clueNumber={game.currentClue?.number || 0}
                  isUserTurn={false}
                  teamName={rivalTeamName}
                  teamColor={rivalTeamColor as 'red' | 'blue'}
                  turnStartTime={game.turnStartTime || Date.now()}
                  currentGuesses={game.currentTurnResults || []}
                  guessesRemaining={game.guessesRemaining || 0}
                  isWaitingForGuess={true}
                  canEndTurn={false}
                />
              )}
            </div>
          </div>

          {/* Side Panel */}
          <SidePanel
            currentTeam={game.currentTeam}
            teamARemaining={game.board.teamARemaining}
            teamBRemaining={game.board.teamBRemaining}
            turnHistory={game.turnHistory}
            onNewGame={startNewGame}
            onReset={resetGame}
          />
        </div>
      </main>

      {/* Initial Game Over Message - shows immediately, requires click */}
      {game.status === 'gameOver' && showGameOverMessage && !showSurvey && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 cursor-pointer"
          onClick={handleGameOverMessageClick}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 shadow-2xl max-w-md text-center pointer-events-none"
          >
            {game.winner === (game.settings.playerTeam === 'red' ? 'teamA' : 'teamB') ? (
              <>
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="font-display text-3xl font-bold text-green-600 mb-2">You Won!</h2>
                <p className="text-gray-600 mb-4">Your team found all their words!</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">😔</div>
                <h2 className="font-display text-3xl font-bold text-red-600 mb-2">You Lost</h2>
                <p className="text-gray-600 mb-4">{game.gameOverReason || 'The rival team won'}</p>
              </>
            )}
            <p className="text-sm text-gray-500 bg-gray-100 py-2 px-4 rounded-lg inline-block">
              Click anywhere to continue
            </p>
          </motion.div>
        </div>
      )}

      {/* Micro Survey - shows after initial message */}
      {game.status === 'gameOver' && showSurvey && (
        <MicroSurvey
          turnId={game.turnHistory[game.turnHistory.length - 1]?.id || ''}
          isOpen={showSurvey}
          playerRole={settings.playerRole}
          onClose={handleSurveyClose}
          onSubmit={handleSurveySubmit}
        />
      )}

      {/* Final Game Over Modal - shows ONLY after survey is dismissed */}
      {game.status === 'gameOver' && !showSurvey && !showGameOverMessage && surveyDismissed && (
        <GameOverModal
          isOpen={true}
          winner={game.winner}
          userTeam={game.settings.playerTeam === 'red' ? 'teamA' : 'teamB'}
          reason={game.gameOverReason}
          onNewGame={startNewGame}
          onGoHome={() => setCurrentPage('welcome')}
        />
      )}
    </div>
  );
}
