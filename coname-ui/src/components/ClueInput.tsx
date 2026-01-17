import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, AlertCircle, Infinity, Loader2, CheckCircle, Target } from 'lucide-react';
import { validateClueAsync } from '../utils/validator';
import { WordCard } from '../types/game';

interface ClueInputProps {
  boardWords: WordCard[];
  teamWords: string[]; // Words that belong to user's team (unrevealed)
  maxNumber: number;
  onSubmit: (clue: string, number: number, intendedTargets: string[]) => void;
}

export function ClueInput({ boardWords, teamWords, maxNumber, onSubmit }: ClueInputProps) {
  const [clue, setClue] = useState('');
  const [number, setNumber] = useState(1);
  const [isInfinity, setIsInfinity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  const toggleTarget = (word: string) => {
    setSelectedTargets(prev => 
      prev.includes(word) 
        ? prev.filter(w => w !== word)
        : [...prev, word]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clue.trim()) return;
    
    // Require target words (except when number is 0)
    const effectiveNumber = isInfinity ? -1 : number;
    if (effectiveNumber !== 0 && selectedTargets.length === 0) {
      setError('Please select at least one word you\'re trying to connect');
      return;
    }
    
    // Warn if selected targets don't match number (but allow it)
    if (!isInfinity && number > 0 && selectedTargets.length !== number) {
      // Just a soft warning, don't block
    }

    // Start validation
    setIsValidating(true);
    setError(null);
    setValidationSuccess(false);

    try {
      // Validate clue using AI-powered validation
      const clueValidation = await validateClueAsync(clue, boardWords);
      
      if (!clueValidation.valid) {
        setError(clueValidation.reason || 'Invalid clue');
        setIsValidating(false);
        return;
      }

      // Show warning if there is one
      if (clueValidation.reason) {
        console.log('Clue validation warning:', clueValidation.reason);
      }

      // Show success briefly
      setIsValidating(false);
      setValidationSuccess(true);
      
      await new Promise(resolve => setTimeout(resolve, 800));

      // Submit with selected targets
      onSubmit(clue.trim().toUpperCase(), isInfinity ? -1 : number, selectedTargets);
      setClue('');
      setNumber(1);
      setIsInfinity(false);
      setValidationSuccess(false);
      setSelectedTargets([]);
    } catch (error) {
      console.error('Validation error:', error);
      setError('Validation failed. Please try again.');
      setIsValidating(false);
    }
  };

  const handleClueChange = (value: string) => {
    setClue(value);
    setError(null);
    setValidationSuccess(false);
    // Don't clear selected targets - user might want to keep them
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
                  const newNumber = parseInt(e.target.value);
                  setNumber(newNumber);
                  // Clear selections if new number is 0
                  if (newNumber === 0) {
                    setSelectedTargets([]);
                  }
                  // Trim selections if exceeding new number
                  else if (selectedTargets.length > newNumber) {
                    setSelectedTargets(prev => prev.slice(0, newNumber));
                  }
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

        {number === 0 && !isInfinity && (
          <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
            Giving 0 means you're not targeting any specific words. This is a special strategy clue.
          </p>
        )}

        {/* Target Word Selection */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 font-medium">
            <Target className="w-4 h-4" />
            {number === 0 && !isInfinity ? (
              <span className="text-gray-400">Word selection disabled for 0 clues</span>
            ) : isInfinity ? (
              <span>Select the words you're targeting (any amount)</span>
            ) : (
              <span>Select <strong className="text-red-600">{number}</strong> word{number > 1 ? 's' : ''} you're targeting</span>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            {teamWords.map(word => {
              const isSelected = selectedTargets.includes(word);
              const isDisabled = isValidating || (number === 0 && !isInfinity);
              // When not infinity and number is set, limit selection
              const atLimit = !isInfinity && number > 0 && selectedTargets.length >= number && !isSelected;
              
              return (
                <button
                  key={word}
                  type="button"
                  onClick={() => toggleTarget(word)}
                  disabled={isDisabled || atLimit}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-red-500 text-white shadow-md scale-105'
                      : isDisabled
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : atLimit
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {word}
                </button>
              );
            })}
          </div>
          {selectedTargets.length > 0 && (
            <p className="text-xs text-gray-500">
              Selected {selectedTargets.length} word{selectedTargets.length > 1 ? 's' : ''}: {selectedTargets.join(', ')}
              {!isInfinity && number > 0 && selectedTargets.length < number && (
                <span className="text-orange-500 ml-2">(select {number - selectedTargets.length} more)</span>
              )}
            </p>
          )}
        </div>

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
          disabled={
            !clue.trim() || 
            isValidating || 
            validationSuccess ||
            // For number > 0, require exactly that many words selected
            (!isInfinity && number > 0 && selectedTargets.length !== number) ||
            // For infinity, require at least 1 word selected
            (isInfinity && selectedTargets.length === 0)
          }
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
