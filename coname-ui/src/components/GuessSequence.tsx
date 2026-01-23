import { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, CheckCircle, XCircle, Skull, Users, Target, Loader2 } from 'lucide-react';

import { CardCategory } from '../types/game';
import { useAppState } from '../hooks/useGameState';

// ============================================
// TYPES
// ============================================

interface GuessResult {
  word: string;
  correct: boolean;
  category: CardCategory;
}

export interface GuessSequenceProps {
  clue: string;
  clueNumber: number;
  isUserTurn: boolean;
  teamName: string;
  teamColor: 'red' | 'blue';
  turnStartTime: number;
  currentGuesses: GuessResult[];
  guessesRemaining: number;
  isWaitingForGuess: boolean;
  onEndTurn?: () => void;
  canEndTurn: boolean;
  isCluePhase?: boolean; // true if AI is generating clue, false if guessing
}

interface ResultMessageConfig {
  icon: React.ReactNode;
  title: string;
  message: string;
  bgColor: string;
  textColor: string;
  iconColor: string;
}

interface ColorClasses {
  bg: string;
  border: string;
  text: string;
  accent: string;
}

// ============================================
// CONSTANTS
// ============================================

const UNLIMITED_GUESSES_DISPLAY = 99;
const ANIMATION_DURATION = 0.4;
const PROGRESS_ANIMATION_DURATION = 0.5;

const RED_COLOR_CLASSES: ColorClasses = {
  bg: 'bg-red-50',
  border: 'border-red-200',
  text: 'text-red-600',
  accent: 'bg-red-500',
};

const BLUE_COLOR_CLASSES: ColorClasses = {
  bg: 'bg-blue-50',
  border: 'border-blue-200',
  text: 'text-blue-600',
  accent: 'bg-blue-500',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getColorClasses = (teamColor: 'red' | 'blue'): ColorClasses =>
  teamColor === 'red' ? RED_COLOR_CLASSES : BLUE_COLOR_CLASSES;

const calculateProgress = (guessCount: number, clueNumber: number): number => {
  const targetNumber = clueNumber === -1 ? 10 : Math.max(1, clueNumber);

  return Math.min(100, (guessCount / targetNumber) * 100);
};

// ============================================
// RESULT MESSAGE HELPERS
// ============================================

const getAssassinResult = (word: string): ResultMessageConfig => ({
  icon: <Skull className="w-6 h-6" />,
  title: 'ASSASSIN!',
  message: `"${word}" is the assassin! Game Over!`,
  bgColor: 'bg-gray-900 border-gray-700',
  textColor: 'text-white',
  iconColor: 'text-red-500',
});

const getNeutralResult = (word: string): ResultMessageConfig => ({
  icon: <XCircle className="w-6 h-6" />,
  title: 'Neutral Word',
  message: `"${word}" is neutral. Turn ends.`,
  bgColor: 'bg-amber-50 border-amber-200',
  textColor: 'text-amber-700',
  iconColor: 'text-amber-500',
});

const getCorrectResult = (word: string, teamColor: 'red' | 'blue'): ResultMessageConfig => ({
  icon: <CheckCircle className="w-6 h-6" />,
  title: 'Correct!',
  message: `"${word}" is your team's word!`,
  bgColor: teamColor === 'red' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200',
  textColor: teamColor === 'red' ? 'text-red-700' : 'text-blue-700',
  iconColor: teamColor === 'red' ? 'text-red-500' : 'text-blue-500',
});

const getRivalResult = (word: string, userIsRed: boolean): ResultMessageConfig => ({
  icon: <Users className="w-6 h-6" />,
  title: 'Rival Team Word!',
  message: `"${word}" belongs to the rival team. They get a point!`,
  bgColor: userIsRed ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200',
  textColor: userIsRed ? 'text-blue-700' : 'text-red-700',
  iconColor: userIsRed ? 'text-blue-500' : 'text-red-500',
});

const getFallbackResult = (word: string): ResultMessageConfig => ({
  icon: <XCircle className="w-6 h-6" />,
  title: 'Missed',
  message: `"${word}" was not the right choice.`,
  bgColor: 'bg-gray-100 border-gray-200',
  textColor: 'text-gray-700',
  iconColor: 'text-gray-500',
});

// ============================================
// COMPONENT
// ============================================

export const GuessSequence: FC<GuessSequenceProps> = ({
  clue,
  clueNumber,
  isUserTurn,
  teamName,
  teamColor,
  currentGuesses,
  guessesRemaining,
  isWaitingForGuess,
  onEndTurn,
  canEndTurn,
  isCluePhase = false,
}) => {
  const { settings } = useAppState();

  const userIsRed = settings.playerTeam === 'red';
  const colorClasses = getColorClasses(teamColor);
  const lastGuess = currentGuesses[currentGuesses.length - 1];
  const lastWasWrong = lastGuess && !lastGuess.correct;
  const lastWasAssassin = lastGuess && lastGuess.category === 'assassin';

  const getResultMessage = (result: GuessResult): ResultMessageConfig => {
    const isUserTeamWord = userIsRed
      ? result.category === 'teamA'
      : result.category === 'teamB';
    const isRivalTeamWord = userIsRed
      ? result.category === 'teamB'
      : result.category === 'teamA';

    if (result.category === 'assassin') {
      return getAssassinResult(result.word);
    }

    if (result.category === 'neutral') {
      return getNeutralResult(result.word);
    }

    if (isUserTeamWord) {
      return getCorrectResult(result.word, teamColor);
    }

    if (isRivalTeamWord) {
      return getRivalResult(result.word, userIsRed);
    }

    return getFallbackResult(result.word);
  };

  const progress = calculateProgress(currentGuesses.length, clueNumber);
  const displayRemaining = guessesRemaining === UNLIMITED_GUESSES_DISPLAY ? '∞' : guessesRemaining;
  const clueNumberDisplay = clueNumber === -1 ? 'unlimited' : clueNumber;
  const wordLabel = clueNumber !== 1 ? 'words' : 'word';

  const guessHistoryElements = currentGuesses.map((guess, index) => {
    const resultConfig = getResultMessage(guess);

    return (
      <motion.div
        key={`${guess.word}-${index}`}
        initial={{ opacity: 0, x: -20, height: 0 }}
        animate={{ opacity: 1, x: 0, height: 'auto' }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: ANIMATION_DURATION }}
        className={`p-4 rounded-xl border ${resultConfig.bgColor}`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 ${resultConfig.iconColor}`}>
            {resultConfig.icon}
          </div>
          <div className="flex-1">
            <div className={`font-bold ${resultConfig.textColor}`}>
              Guess #{index + 1}: {resultConfig.title}
            </div>
            <div className={`text-sm ${resultConfig.textColor} opacity-80`}>
              {resultConfig.message}
            </div>
          </div>
          <div className={`font-mono font-bold text-lg ${resultConfig.textColor}`}>
            {guess.word}
          </div>
        </div>
      </motion.div>
    );
  });

  const shouldShowContinueIndicator = isWaitingForGuess && !lastWasWrong && currentGuesses.length > 0;
  const shouldShowFirstGuessIndicator = !isUserTurn && isWaitingForGuess && currentGuesses.length === 0 && clue;
  const shouldShowEndTurnButton = canEndTurn && isUserTurn && !lastWasWrong;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200"
    >
      {/* Header with Timer */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${colorClasses.bg}`}>
            <Bot className={`w-6 h-6 ${colorClasses.text}`} />
          </div>
          <div>
            <h3 className={`font-display font-bold text-lg ${colorClasses.text}`}>
              {teamName} - {isCluePhase ? 'Thinking' : 'Guessing'}
            </h3>
            <p className="text-sm text-gray-500">
              {isUserTurn 
                ? 'Click on the board to guess' 
                : isCluePhase 
                  ? 'AI is thinking of a clue...' 
                  : 'AI is guessing...'}
            </p>
          </div>
        </div>
      </div>

      {/* Clue Display */}
      {clue && (
        <div className={`p-4 rounded-xl ${colorClasses.bg} ${colorClasses.border} border mb-4`}>
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Current Clue:</div>
            <div className={`font-mono text-3xl font-bold ${colorClasses.text}`}>
              "{clue}"
            </div>
            <div className="text-gray-600 mt-1">
              connects to <span className="font-bold">{clueNumberDisplay}</span> {wordLabel}
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Guesses made: <strong>{currentGuesses.length}</strong></span>
          <span>Remaining: <strong>{displayRemaining}</strong></span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className={colorClasses.accent}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: PROGRESS_ANIMATION_DURATION }}
            style={{ height: '100%' }}
          />
        </div>
      </div>

      {/* Guess History */}
      <div className="space-y-3 mb-4">
        <AnimatePresence mode="popLayout">
          {guessHistoryElements}
        </AnimatePresence>
      </div>

      {/* Continue Guessing Indicator */}
      {shouldShowContinueIndicator && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-4 ${colorClasses.bg} ${colorClasses.border} border rounded-xl mb-4`}
        >
          <div className="flex items-center gap-3">
            {isUserTurn ? (
              <>
                <Target className={`w-5 h-5 ${colorClasses.text}`} />
                <div>
                  <div className={`font-semibold ${colorClasses.text}`}>Great! You can continue guessing</div>
                  <div className={`text-sm ${colorClasses.text} opacity-75`}>Click another word on the board, or end your turn</div>
                </div>
              </>
            ) : (
              <>
                <Loader2 className={`w-5 h-5 ${colorClasses.text} animate-spin`} />
                <div>
                  <div className={`font-semibold ${colorClasses.text}`}>Correct! AI is thinking...</div>
                  <div className={`text-sm ${colorClasses.text} opacity-75`}>Preparing next guess</div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* AI First Guess Indicator */}
      {shouldShowFirstGuessIndicator && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-4 ${colorClasses.bg} ${colorClasses.border} border rounded-xl mb-4`}
        >
          <div className="flex items-center gap-3">
            <Loader2 className={`w-5 h-5 ${colorClasses.text} animate-spin`} />
            <div>
              <div className={`font-semibold ${colorClasses.text}`}>AI is analyzing the clue...</div>
              <div className={`text-sm ${colorClasses.text} opacity-75`}>Preparing first guess</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Turn Ending Message - don't show if assassin (game over) */}
      {lastWasWrong && !lastWasAssassin && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-orange-50 border border-orange-200 rounded-xl mb-4"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
            <div>
              <div className="font-semibold text-orange-700">Turn ending...</div>
              <div className="text-sm text-orange-600">Switching to rival team</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* End Turn Button */}
      {shouldShowEndTurnButton && (
        <button
          onClick={onEndTurn}
          className="w-full py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-display font-semibold rounded-xl transition-colors"
        >
          End Turn (Pass to Rival Team)
        </button>
      )}
    </motion.div>
  );
};
