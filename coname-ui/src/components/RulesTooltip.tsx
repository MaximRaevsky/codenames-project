import { FC, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Users, Eye, Target, Skull, Trophy, AlertTriangle, CheckCircle } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface RulesTooltipProps {
  position?: 'left' | 'right' | 'bottom';
}

// ============================================
// MAIN COMPONENT
// ============================================

export const RulesTooltip: FC<RulesTooltipProps> = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl transition-colors"
        aria-label="Game Rules"
      >
        <HelpCircle className="w-4 h-4" />
        <span className="hidden sm:inline text-sm font-medium">Rules</span>
      </button>

      {/* Rules Modal - Rendered via Portal */}
      {isOpen && createPortal(
        <AnimatePresence>
          <div 
            className="fixed inset-0 flex items-center justify-center p-4" 
            style={{ zIndex: 2147483647 }}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-blue-500 px-6 py-4 flex items-center justify-between">
                <h2 className="font-display font-bold text-white text-2xl">
                  How to Play Codenames
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                
                {/* Game Setup */}
                <section className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-gray-800">Game Setup</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed mb-2">
                    Two teams compete: <span className="font-semibold text-red-600">Red Team</span> and <span className="font-semibold text-blue-600">Blue Team</span>.
                  </p>
                  <p className="text-gray-600 leading-relaxed mb-2">
                    <span className="font-semibold">You + AI Teammate:</span> Choose your team color (Red or Blue) and your role - either <span className="font-semibold">Spymaster</span> or <span className="font-semibold">Guesser</span>. Your AI teammate handles the other role.
                  </p>
                  <p className="text-gray-600 leading-relaxed mb-2">
                    <span className="font-semibold">AI Rival Team:</span> The opposing team is controlled by AI.
                  </p>
                  <p className="text-gray-600 leading-relaxed">
                    25 codename words are displayed in a 5×5 grid.
                  </p>
                </section>

                {/* Starting Team */}
                <section className="mb-6 bg-amber-50 p-4 rounded-xl border-2 border-amber-200">
                  <p className="text-gray-700 mb-2">
                    <span className="font-semibold">Starting Team:</span> The starting team has <span className="font-bold">9 words</span> to guess, while the other team has <span className="font-bold">8 words</span>.
                  </p>
                  <p className="text-sm text-gray-600">
                    The starting team gives the first clue of the game.
                  </p>
                </section>

                {/* Spymaster Role */}
                <section className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Eye className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-gray-800">Spymaster Role</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed mb-3">
                    The Spymaster <span className="font-semibold">sees all card colors</span> and knows the secret identity of all 25 words.
                  </p>
                  <div className="bg-purple-50 p-4 rounded-lg mb-3">
                    <p className="font-semibold text-purple-800 mb-2">Giving Clues</p>
                    <p className="text-sm text-gray-700 mb-2">
                      The Spymaster gives a clue consisting of <span className="font-semibold">ONE WORD + ONE NUMBER</span>.
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                      <li>The word relates to meanings of codenames on the board</li>
                      <li>The number tells how many codenames relate to the clue</li>
                      <li>Example: "Tree: 2" might connect NUT and BARK</li>
                      <li>Cannot be any word currently visible on the board</li>
                      <li>Can give 0 (avoid these words) or unlimited (guess as many as you want)</li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">If you're the Spymaster:</span> Give clues to your AI teammate. If your AI teammate is the Spymaster, you'll receive clues from them.
                  </p>
                </section>

                {/* Agent Role */}
                <section className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Target className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-gray-800">Guesser Role</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed mb-3">
                    Guessers <span className="font-semibold">do not see card colors</span>. They only see the codenames.
                  </p>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="font-semibold text-green-800 mb-2">How Guessing Works</p>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                      <li><span className="font-semibold">Must guess at least 1 word</span> (mandatory first guess)</li>
                      <li>Can guess up to <span className="font-semibold">clue number + 1</span> words total</li>
                      <li>Can stop guessing at any time after the first guess (click "End Turn")</li>
                      <li>Can use extra guess to try words from previous clues</li>
                      <li>Example: Clue "River: 3" allows up to 4 guesses</li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-semibold">If you're the Guesser:</span> Click words to guess based on your AI Spymaster's clue. If your AI teammate is the Guesser, watch them make guesses based on your clues.
                  </p>
                </section>

                {/* What Happens When You Guess */}
                <section className="mb-6">
                  <h3 className="font-display font-bold text-lg text-gray-800 mb-3">What Happens When You Touch a Card?</h3>
                  
                  <div className="space-y-3">
                    <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-800">Your Team's Word (Agent)</p>
                        <p className="text-sm text-gray-600">Card covered with your color. You get another guess! Keep guessing until wrong, out of guesses, or decide to stop.</p>
                      </div>
                    </div>

                    <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border-l-4 border-amber-500">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-800">Neutral Word (Innocent Bystander)</p>
                        <p className="text-sm text-gray-600">Card covered with bystander marker. <span className="font-semibold">Turn ends immediately.</span> Other team gets their turn.</p>
                      </div>
                    </div>

                    <div className="flex gap-3 p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-800">Opponent's Word</p>
                        <p className="text-sm text-gray-600">Covered with their color. <span className="font-semibold">Turn ends immediately</span> AND you just helped the other team!</p>
                      </div>
                    </div>

                    <div className="flex gap-3 p-3 bg-gray-900 rounded-lg border-l-4 border-black">
                      <Skull className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white">The Assassin</p>
                        <p className="text-sm text-gray-300"><span className="font-semibold">INSTANT LOSS!</span> Your team loses the game immediately. Never contact the assassin!</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Game Flow */}
                <section className="mb-6 bg-gray-50 p-4 rounded-xl">
                  <h3 className="font-display font-bold text-gray-800 mb-2">Game Flow</h3>
                  <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                    <li>Your team's turn: Spymaster gives a clue (one word + number)</li>
                    <li>Guesser makes guesses by clicking words</li>
                    <li>Turn ends when: wrong guess, click "End Turn", or max guesses reached</li>
                    <li>Rival AI team takes their turn (you watch their clue and guesses)</li>
                    <li>Repeat until one team finds all their words or hits the assassin</li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-3">
                    <span className="font-semibold">Note:</span> The starting team is randomly chosen each game. Each turn has a timer counting down.
                  </p>
                </section>

                {/* Winning */}
                <section className="mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Trophy className="w-5 h-5 text-yellow-600" />
                    </div>
                    <h3 className="font-display font-bold text-lg text-gray-800">How to Win</h3>
                  </div>
                  <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
                    <li><span className="font-semibold">Your team</span> wins by finding ALL your team's words first</li>
                    <li>You can win on the rival team's turn if they find your last word</li>
                    <li>If the <span className="font-semibold">rival team touches the Assassin</span>, you win instantly</li>
                    <li>If <span className="font-semibold">your team touches the Assassin</span>, you lose immediately</li>
                  </ul>
                </section>

                {/* Important Rules */}
                <section className="mb-4 bg-red-50 border-2 border-red-200 p-4 rounded-xl">
                  <h3 className="font-display font-bold text-red-800 mb-2">Important Clue Rules</h3>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-2">
                    <li>Clue must relate to the <span className="font-semibold">meaning</span> of words, not spelling or position</li>
                    <li>Cannot use any form of a visible word (if BREAK is visible, can't say broken, breakage, etc.)</li>
                    <li>Cannot use part of compound words visible on table</li>
                    <li>Invalid clue = turn ends + opponent may cover one of their words for free</li>
                  </ul>
                </section>

              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-500">Based on Codenames by Vlaada Chvátil</p>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default RulesTooltip;

