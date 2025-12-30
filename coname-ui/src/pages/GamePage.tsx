import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Home, Settings, Loader2 } from 'lucide-react';
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
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useLanguage } from '../i18n';
import { extractGameSessionData } from '../utils/userDatabase';
import { updateSummaryAfterGame } from '../utils/summaryAgent';

export function GamePage() {
  const {
    game,
    settings,
    profile,
    setCurrentPage,
    startNewGame,
    submitClue,
    requestAIClue,
    makeGuess,
    getAINextGuess,
    endGuessingPhase,
    processRivalTurn,
    showSurvey,
    setShowSurvey,
    addSurveyResponse,
    cancelGame,
  } = useAppState();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isRequestingAIClue, setIsRequestingAIClue] = useState(false);
  const [highlightedWord, setHighlightedWord] = useState<string | undefined>();
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [gameOverModalDismissed, setGameOverModalDismissed] = useState(false);
  const [surveyPending, setSurveyPending] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<'home' | 'newGame' | null>(null);
  const endTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTimerExpired = useRef(false);
  const gameCancelledRef = useRef(false); // Flag to stop AI processes
  
  const { t, isRTL } = useLanguage();

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

  // Handle game over flow: show modal immediately
  useEffect(() => {
    if (game?.status === 'gameOver' && !showGameOverModal && !gameOverModalDismissed && !surveyPending) {
      setShowGameOverModal(true);
    }
    
    // Reset when game is no longer over (new game started)
    if (game?.status !== 'gameOver') {
      setShowGameOverModal(false);
      setGameOverModalDismissed(false);
      setSurveyPending(false);
      setPendingNavigation(null);
      gameCancelledRef.current = false;
    }
  }, [game?.status, showGameOverModal, gameOverModalDismissed, surveyPending]);

  // Handle closing the game over modal (X button) - show survey first
  const handleCloseGameOverModal = () => {
    setShowGameOverModal(false);
    setSurveyPending(true);
    setPendingNavigation(null); // No navigation after survey, just dismiss
    setShowSurvey(true);
  };
  
  // Handle navigation from game over modal - show survey first
  const handleGameOverNavigation = (destination: 'home' | 'newGame') => {
    setShowGameOverModal(false);
    setSurveyPending(true);
    setPendingNavigation(destination);
    setShowSurvey(true);
  };
  
  // Handle survey close/submit - then navigate or just dismiss
  // wasSubmitted flag prevents duplicate summary updates
  const handleSurveyClose = (wasSubmitted = false) => {
    setShowSurvey(false);
    setSurveyPending(false);
    
    // If user SKIPPED the survey (closed without submitting), still update summary
    // This captures the game data even without explicit feedback
    // Note: When submitted, addSurveyResponse in hooks handles the update with feedback
    if (!wasSubmitted && game && profile.email && game.status === 'gameOver') {
      const sessionData = extractGameSessionData(game);
      updateSummaryAfterGame(profile.email, sessionData).catch(err => {
        console.error('Error updating summary after skipping survey:', err);
      });
    }
    
    if (pendingNavigation === 'home') {
      setCurrentPage('welcome');
    } else if (pendingNavigation === 'newGame') {
      startNewGame();
    } else {
      // X button was clicked - just dismiss modal and show winner banner
      setGameOverModalDismissed(true);
    }
    setPendingNavigation(null);
  };
  
  const handleSurveySubmit = (response: any) => {
    addSurveyResponse(response);
    handleSurveyClose(true); // Mark as submitted to prevent duplicate summary update
  };
  
  // Handle going home mid-game - cancel all AI processes
  const handleGoHome = () => {
    gameCancelledRef.current = true;
    cancelGame(); // Also set in store to stop processRivalTurn
    setCurrentPage('welcome');
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
    if (!game || isProcessing || game.status !== 'playing' || game.turnShouldEnd || gameCancelledRef.current) return;
    
    const nextGuess = getAINextGuess();
    if (!nextGuess) return;

    setIsProcessing(true);
    
    // Highlight the word AI is about to guess
    setHighlightedWord(nextGuess);
    
    // Wait to show which word AI is considering
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if game was cancelled during wait
    if (gameCancelledRef.current) {
      setIsProcessing(false);
      return;
    }
    
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
    const aiGuessesReady = game.aiPlannedGuesses !== undefined && game.aiPlannedGuesses !== null; // AI has actually responded
    const hasAIGuesses = aiGuessesReady && game.aiPlannedGuesses!.length > 0;
    const madeGuesses = game.currentTurnGuesses?.length || 0;
    const hasMoreGuesses = hasAIGuesses && madeGuesses < game.aiPlannedGuesses.length;
    const canContinue = !game.turnShouldEnd;
    
    // If AI decided to pass (empty guesses array), end turn immediately
    if (isUserTurn && isSpymasterMode && isGuessPhase && aiGuessesReady && !hasAIGuesses && !game.turnShouldEnd && !isProcessing) {
      console.log('🤖 [AI GUESSER] AI decided to PASS - no confident guesses');
      const timer = setTimeout(() => {
        endGuessingPhase();
      }, 1500);
      return () => clearTimeout(timer);
    }
    
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
    if (gameCancelledRef.current) return;
    // Rival team is always AI-controlled (no manual mode)
    
    // Determine if current team is the user's team - use game.settings for consistency
    const userTeamId = game.settings.playerTeam === 'red' ? 'teamA' : 'teamB';
    const isRivalTurn = game.currentTeam !== userTeamId;
    
    if (isRivalTurn) {
      // Give a longer delay before rival starts their turn
      const timer = setTimeout(() => {
        if (!gameCancelledRef.current) {
          processRivalTurn();
        }
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

  // Handle AI clue request with loading state
  const handleRequestAIClue = async () => {
    if (isRequestingAIClue) return;
    setIsRequestingAIClue(true);
    try {
      await requestAIClue();
    } finally {
      setIsRequestingAIClue(false);
    }
  };

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
              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* Game Rules Tooltip */}
              <RulesTooltip position="bottom" />

              {/* Edit Profile */}
              <button
                onClick={() => setCurrentPage('profile')}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">{t('settings')}</span>
              </button>

              {/* Home */}
              <button
                onClick={handleGoHome}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">{t('backToMenu')}</span>
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
              
              {/* Countdown Timer - hide when waiting for user to click "Get Clue from AI Spymaster" */}
              {!(isUserTurn && !isSpymasterMode && isCluePhase && !game.currentClue) && (
                <CountdownTimer
                  startTime={game.turnStartTime}
                  durationSeconds={game.phaseTimeLimit}
                  teamColor={currentTeamColor}
                  label={isCluePhase ? 'Clue Time' : 'Guess Time'}
                  onTimeUp={handleTimerExpired}
                />
              )}
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
              {isUserTurn && isSpymasterMode && isGuessPhase && game.status !== 'gameOver' && (
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
                    {t('aiTurn')}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {isRTL ? 'שותף ה-AI שלך יספק לך רמז לניחוש.' : 'Your AI teammate will provide a clue for you to guess.'}
                  </p>
                  <button
                    onClick={handleRequestAIClue}
                    disabled={isRequestingAIClue}
                    className={`w-full py-3 px-6 flex items-center justify-center gap-2 ${
                      userTeamColor === 'red' 
                        ? 'bg-red-500 hover:bg-red-600 disabled:bg-red-300' 
                        : 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300'
                    } text-white font-display font-bold rounded-xl transition-colors disabled:cursor-not-allowed`}
                  >
                    {isRequestingAIClue ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('aiThinking')}
                      </>
                    ) : (
                      t('getAIClue')
                    )}
                  </button>
                </motion.div>
              )}

              {/* User's turn - Guess Phase (User guessing) */}
              {isUserTurn && !isSpymasterMode && isGuessPhase && game.status !== 'gameOver' && (
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
              {!isUserTurn && game.status !== 'gameOver' && (
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
                  isCluePhase={isCluePhase}
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
          />
        </div>
      </main>

      {/* Game Over Modal - shows immediately with X button */}
      {game.status === 'gameOver' && showGameOverModal && !showSurvey && (
        <GameOverModal
          isOpen={true}
          winner={game.winner}
          userTeam={game.settings.playerTeam === 'red' ? 'teamA' : 'teamB'}
          reason={game.gameOverReason}
          onNewGame={() => handleGameOverNavigation('newGame')}
          onGoHome={() => handleGameOverNavigation('home')}
          onClose={handleCloseGameOverModal}
        />
      )}

      {/* Micro Survey - shows when navigating away after game over */}
      {showSurvey && (
        <MicroSurvey
          turnId={game.turnHistory[game.turnHistory.length - 1]?.id || ''}
          isOpen={showSurvey}
          playerRole={settings.playerRole}
          onClose={() => handleSurveyClose(false)}
          onSubmit={handleSurveySubmit}
        />
      )}

      {/* Winner banner when modal is dismissed */}
      {game.status === 'gameOver' && gameOverModalDismissed && !showSurvey && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-xl shadow-lg ${
          game.winner === (game.settings.playerTeam === 'red' ? 'teamA' : 'teamB')
            ? 'bg-green-500 text-white'
            : 'bg-gray-700 text-white'
        }`}>
          <span className="font-display font-bold">
            {game.winner === (game.settings.playerTeam === 'red' ? 'teamA' : 'teamB')
              ? '🎉 You Won!'
              : `😔 ${game.winner === 'teamA' ? 'Red' : 'Blue'} Team Won`}
          </span>
          <span className="ml-2 opacity-80">- {game.gameOverReason}</span>
        </div>
      )}
    </div>
  );
}
