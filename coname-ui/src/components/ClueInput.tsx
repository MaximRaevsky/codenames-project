import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, AlertCircle, Infinity, Loader2, CheckCircle } from 'lucide-react';
import { validateClue } from '../utils/validator';
import { WordCard } from '../types/game';

interface ClueInputProps {
  boardWords: WordCard[];
  maxNumber: number;
  onSubmit: (clue: string, number: number) => void;
}

export function ClueInput({ boardWords, maxNumber, onSubmit }: ClueInputProps) {
  const [clue, setClue] = useState('');
  const [number, setNumber] = useState(1);
  const [isInfinity, setIsInfinity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clue.trim()) return;

    // Start validation
    setIsValidating(true);
    setError(null);
    setValidationSuccess(false);

    // Simulate validation delay for UX
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Validate clue
    const clueValidation = validateClue(clue, boardWords);
    
    if (!clueValidation.valid) {
      setError(clueValidation.reason || 'Invalid clue');
      setIsValidating(false);
      return;
    }

    // Show success briefly
    setIsValidating(false);
    setValidationSuccess(true);
    
    await new Promise(resolve => setTimeout(resolve, 800));

    // Submit
    onSubmit(clue.trim().toUpperCase(), isInfinity ? -1 : number);
    setClue('');
    setNumber(1);
    setIsInfinity(false);
    setValidationSuccess(false);
  };

  const handleClueChange = (value: string) => {
    setClue(value);
    setError(null);
    setValidationSuccess(false);
  };

  // Generate number options from 0 to maxNumber
  const numberOptions = Array.from({ length: maxNumber + 1 }, (_, i) => i);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200"
    >
      <h3 className="font-display font-bold text-xl text-red-600 mb-2">
        Give a Clue
      </h3>
      <p className="text-gray-500 text-sm mb-4">
        Enter a single word clue and the number of words it connects to. Your AI teammate will then guess.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1 font-medium">Clue Word</label>
            <input
              type="text"
              value={clue}
              onChange={(e) => handleClueChange(e.target.value)}
              placeholder="Enter clue..."
              disabled={isValidating}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50"
            />
          </div>
          <div className="w-36">
            <label className="block text-sm text-gray-600 mb-1 font-medium">Number</label>
            <div className="flex gap-2">
              <select
                value={isInfinity ? '' : number}
                onChange={(e) => {
                  setIsInfinity(false);
                  setNumber(parseInt(e.target.value));
                }}
                disabled={isInfinity || isValidating}
                className={`w-16 px-2 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 font-mono text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent ${
                  isInfinity ? 'opacity-50' : ''
                }`}
              >
                {numberOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsInfinity(!isInfinity)}
                disabled={isValidating}
                className={`px-3 py-3 rounded-xl border transition-colors ${
                  isInfinity
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
                title="Unlimited guesses"
              >
                <Infinity className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {isInfinity && (
          <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded-lg">
            Unlimited guesses - your teammate can keep guessing until they miss!
          </p>
        )}

        {/* Validation States */}
        <AnimatePresence mode="wait">
          {isValidating && (
            <motion.div
              key="validating"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              <div>
                <div className="font-semibold">Validating your clue...</div>
                <div className="text-sm opacity-75">Checking if "{clue}" follows the rules</div>
              </div>
            </motion.div>
          )}

          {validationSuccess && (
            <motion.div
              key="success"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700"
            >
              <CheckCircle className="w-5 h-5" />
              <div>
                <div className="font-semibold">Clue accepted!</div>
                <div className="text-sm opacity-75">Starting AI teammate's guessing phase...</div>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Invalid clue</div>
                <div className="text-sm">{error}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={!clue.trim() || isValidating || validationSuccess}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-display font-bold rounded-xl transition-colors shadow-md"
        >
          {isValidating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit Clue
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
