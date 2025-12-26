import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Skull, RotateCcw, Home, X } from 'lucide-react';
import { Team } from '../types/game';

interface GameOverModalProps {
  isOpen: boolean;
  winner: Team | undefined;
  userTeam: Team;
  reason?: string;
  onNewGame: () => void;
  onGoHome: () => void;
  onClose?: () => void; // Optional close button handler
}

export function GameOverModal({
  isOpen,
  winner,
  userTeam,
  reason,
  onNewGame,
  onGoHome,
  onClose,
}: GameOverModalProps) {
  // User wins if the winner matches their team
  const isWin = winner === userTeam;
  const isAssassin = reason?.includes('assassin');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 20 }}
            className={`relative overflow-hidden rounded-2xl p-8 max-w-md w-full text-center ${
              isWin
                ? 'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300'
                : 'bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300'
            }`}
          >
            {/* Close button */}
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-2 rounded-full hover:bg-black/10 transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {isWin ? (
                <>
                  <motion.div
                    className="absolute -top-20 -right-20 w-40 h-40 bg-red-200 rounded-full blur-3xl opacity-50"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-200 rounded-full blur-2xl opacity-50"
                    animate={{ scale: [1.2, 1, 1.2] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                </>
              ) : (
                <motion.div
                  className="absolute inset-0 bg-blue-200 opacity-20"
                  animate={{ opacity: [0.1, 0.2, 0.1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>

            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', damping: 10 }}
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
                isWin ? 'bg-green-200' : 'bg-gray-200'
              }`}
            >
              {isAssassin ? (
                <Skull className={`w-10 h-10 ${isWin ? 'text-green-600' : 'text-red-600'}`} />
              ) : (
                <Trophy className={`w-10 h-10 ${isWin ? 'text-green-600' : 'text-gray-600'}`} />
              )}
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`font-display text-3xl font-bold mb-3 ${
                isWin ? 'text-green-600' : 'text-gray-700'
              }`}
            >
              {isWin ? 'Victory!' : 'Game Over'}
            </motion.h2>

            {/* Reason */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-gray-600 mb-6"
            >
              {reason || (isWin ? 'Your team found all words!' : 'The rival team wins!')}
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex gap-3"
            >
              <button
                onClick={onGoHome}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white hover:bg-gray-50 text-gray-700 font-display rounded-xl transition-colors border border-gray-200"
              >
                <Home className="w-5 h-5" />
                Home
              </button>
              <button
                onClick={onNewGame}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-display font-semibold rounded-xl transition-colors shadow-md ${
                  isWin
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <RotateCcw className="w-5 h-5" />
                Play Again
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
