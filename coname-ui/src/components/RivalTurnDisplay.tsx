import { motion } from 'framer-motion';
import { Bot, Loader2 } from 'lucide-react';
import { CardCategory } from '../types/game';

interface GuessResult {
  word: string;
  correct: boolean;
  category: CardCategory;
}

interface RivalTurnDisplayProps {
  clue: string | null;
  clueNumber: number;
  currentGuesses: GuessResult[];
  isProcessing: boolean;
}

export function RivalTurnDisplay({
  clue,
  clueNumber,
  currentGuesses,
  isProcessing,
}: RivalTurnDisplayProps) {
  const getCategoryColor = (category: CardCategory) => {
    switch (category) {
      case 'teamA': return 'text-red-600 bg-red-50';
      case 'teamB': return 'text-blue-600 bg-blue-50';
      case 'neutral': return 'text-amber-700 bg-amber-50';
      case 'assassin': return 'text-gray-900 bg-gray-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue-50 rounded-2xl p-6 border border-blue-200"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Bot className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg text-blue-600">
            Rival Team's Turn
          </h3>
          <p className="text-sm text-blue-500">
            Blue team is playing...
          </p>
        </div>
      </div>

      {/* Clue Display */}
      {clue && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-white rounded-xl mb-4 text-center"
        >
          <div className="text-sm text-gray-500 mb-1">Rival Spymaster's Clue:</div>
          <div className="font-mono text-2xl font-bold text-blue-600">
            "{clue}" : {clueNumber === -1 ? '∞' : clueNumber}
          </div>
        </motion.div>
      )}

      {/* Guesses */}
      {currentGuesses.length > 0 && (
        <div className="space-y-2 mb-4">
          {currentGuesses.map((guess, i) => (
            <motion.div
              key={guess.word}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center justify-between p-3 rounded-xl ${getCategoryColor(guess.category)}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <span className="font-mono font-semibold">{guess.word}</span>
              </div>
              <span className={`text-sm font-medium ${
                guess.correct 
                  ? (guess.category === 'teamA' ? 'text-red-600' : 'text-blue-600')
                  : 'text-gray-500'
              }`}>
                {guess.correct ? '✓ Correct' : '✗ Wrong'}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 py-4 text-blue-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium">Rival team is thinking...</span>
        </div>
      )}
    </motion.div>
  );
}

