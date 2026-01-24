import { motion } from 'framer-motion';
import { Target, MessageSquare, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { TurnEvent, PlayerRole, CardCategory } from '../types/game';

// Convert category to human-readable name based on user's team
function getCategoryDisplayName(category: CardCategory, userTeam: 'teamA' | 'teamB'): string {
  if (category === 'neutral') return 'neutral';
  if (category === 'assassin') return 'assassin';
  // Check if it's rival or own team
  const isRival = (userTeam === 'teamA' && category === 'teamB') || 
                  (userTeam === 'teamB' && category === 'teamA');
  return isRival ? 'rival' : 'your team';
}

// Build reasoning based on words that were ACTUALLY guessed (not planned)
function buildGuesserReasoningFromActualGuesses(
  clue: string,
  actualGuesses: string[],
  wordExplanations?: Record<string, string>
): string {
  if (actualGuesses.length === 0) {
    return 'No guesses were made this turn.';
  }

  const explanations = actualGuesses.map(word => {
    // Look up explanation using uppercase key (since ai-agents.ts stores with uppercase)
    const explanation = wordExplanations?.[word.toUpperCase()];
    if (explanation) {
      // Clean up the explanation - remove redundant phrases and trailing punctuation
      let cleanExplanation = explanation
        .replace(/^because\s*/i, '')
        .replace(/^relates to \w+\s*(because\s*)?/i, '')
        .replace(/\.+$/, '') // Remove trailing periods
        .trim();
      return `'${word}' - ${cleanExplanation}`;
    }
    return `'${word}' - no explanation available`;
  });

  if (explanations.length === 1) {
    return `For the clue '${clue}', I guessed ${explanations[0]}.`;
  }
  return `For the clue '${clue}', I guessed: ${explanations.join('; ')}.`;
}

interface GameSummaryProps {
  turnHistory: TurnEvent[];
  userRole: PlayerRole;
  userTeam: 'teamA' | 'teamB';
}

export function GameSummary({ turnHistory, userRole, userTeam }: GameSummaryProps) {
  // Filter turns for the user's team only
  const userTeamTurns = turnHistory.filter(t => t.team === userTeam);
  
  if (userTeamTurns.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 mt-6"
    >
      <h3 className="font-display font-bold text-xl text-gray-800 mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-purple-500" />
        Game Summary - Your Team's Turns
      </h3>
      
      <div className="space-y-4">
        {userTeamTurns.map((turn, index) => (
          <TurnSummaryCard 
            key={turn.id} 
            turn={turn} 
            turnNumber={index + 1}
            userRole={userRole}
            userTeam={userTeam}
          />
        ))}
      </div>
      
      {userRole === 'guesser' && (
        <p className="text-xs text-gray-500 mt-4">
          💡 The "Intended" column shows which words your AI Spymaster was trying to connect with each clue.
        </p>
      )}
      {userRole === 'spymaster' && (
        <p className="text-xs text-gray-500 mt-4">
          💡 The "Intended" column shows which words you selected when giving each clue. The AI Guesser's reasoning explains why it chose what it chose.
        </p>
      )}
    </motion.div>
  );
}

interface TurnSummaryCardProps {
  turn: TurnEvent;
  turnNumber: number;
  userRole: PlayerRole;
  userTeam: 'teamA' | 'teamB';
}

function TurnSummaryCard({ turn, turnNumber, userRole, userTeam }: TurnSummaryCardProps) {
  const intendedWords = turn.intendedTargets || [];
  const guessedWords = turn.guesses || [];
  const guessResults = turn.guessResults || [];
  
  // Calculate match stats
  const correctGuesses = guessResults.filter(r => r.correct).map(r => r.word);
  const incorrectGuesses = guessResults.filter(r => !r.correct).map(r => r.word);
  const missedIntended = intendedWords.filter(w => !correctGuesses.includes(w));
  
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded">
              Turn {turnNumber}
            </span>
            <span className="font-display font-bold text-lg text-purple-700">
              "{turn.clue}" • {turn.clueNumber}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" />
              {correctGuesses.length}
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="w-4 h-4" />
              {incorrectGuesses.length}
            </span>
          </div>
        </div>
      </div>
      
      {/* Content Table */}
      <div className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">
                <span className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  Intended ({userRole === 'guesser' ? 'AI Spymaster' : 'You'})
                </span>
              </th>
              <th className="text-left pb-2 font-medium">
                Guessed ({userRole === 'guesser' ? 'You' : 'AI Guesser'})
              </th>
              <th className="text-left pb-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {/* Show intended words with their guess status */}
            {intendedWords.map((word, i) => {
              const wasGuessed = guessedWords.includes(word);
              const result = guessResults.find(r => r.word === word);
              return (
                <tr key={`intended-${i}`} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-purple-700">{word}</td>
                  <td className="py-2">
                    {wasGuessed ? (
                      <span className="text-gray-700">{word}</span>
                    ) : (
                      <span className="text-gray-400 italic">Not guessed</span>
                    )}
                  </td>
                  <td className="py-2">
                    {wasGuessed && result ? (
                      result.correct ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" /> Correct
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500">
                          <XCircle className="w-4 h-4" /> Wrong ({getCategoryDisplayName(result.category, userTeam)})
                        </span>
                      )
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <HelpCircle className="w-4 h-4" /> Missed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {/* Show guessed words that weren't intended */}
            {guessedWords
              .filter(w => !intendedWords.includes(w))
              .map((word, i) => {
                const result = guessResults.find(r => r.word === word);
                return (
                  <tr key={`extra-${i}`} className="border-b border-gray-50 bg-gray-50">
                    <td className="py-2 text-gray-400 italic">Not intended</td>
                    <td className="py-2 font-medium text-gray-700">{word}</td>
                    <td className="py-2">
                      {result ? (
                        result.correct ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" /> Correct (bonus!)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle className="w-4 h-4" /> Wrong ({getCategoryDisplayName(result.category, userTeam)})
                          </span>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        
        {/* Reasoning sections */}
        {turn.spymasterReasoning && userRole === 'guesser' && (
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <p className="text-xs font-medium text-purple-700 mb-1">AI Spymaster's Reasoning:</p>
            <p className="text-sm text-purple-900">{turn.spymasterReasoning}</p>
          </div>
        )}
        
        {userRole === 'spymaster' && guessedWords.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs font-medium text-blue-700 mb-1">AI Guesser's Reasoning:</p>
            <p className="text-sm text-blue-900">
              {turn.guesserReasoning || buildGuesserReasoningFromActualGuesses(turn.clue, guessedWords, turn.guesserWordExplanations)}
            </p>
          </div>
        )}
        
        {/* Show missed intended words */}
        {missedIntended.length > 0 && (
          <div className="mt-3 p-2 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-xs text-orange-700">
              ⚠️ Missed connections: {missedIntended.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

