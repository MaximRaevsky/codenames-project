import { useState, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, Target, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { SurveyResponse, PlayerRole, TurnEvent, Team } from '../types/game';
import { GameSummary } from './GameSummary';

// ============================================
// TYPES
// ============================================

interface MicroSurveyProps {
  turnId: string;
  isOpen: boolean;
  playerRole: PlayerRole;
  turnHistory?: TurnEvent[];
  userTeam?: Team;
  onClose: () => void;
  onSubmit: (response: SurveyResponse) => void;
}

interface SliderQuestionProps {
  label: string;
  value: number;
  min: string;
  max: string;
  onChange: (value: number) => void;
}

// ============================================
// HELPER COMPONENTS
// ============================================

const SliderQuestion: FC<SliderQuestionProps> = ({ label, value, min, max, onChange }) => (
  <div>
    <div className="flex justify-between mb-2">
      <label className="text-sm text-gray-700 font-medium">{label}</label>
      <span className="text-sm font-mono text-blue-600 font-bold">{value}/7</span>
    </div>
    <input
      type="range"
      min="1"
      max="7"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full accent-blue-500"
    />
    <div className="flex justify-between text-xs text-gray-400 mt-1">
      <span>{min}</span>
      <span>{max}</span>
    </div>
  </div>
);

// ============================================
// TEXT FEEDBACK COMPONENT
// ============================================

interface TextFeedbackProps {
  value: string;
  onChange: (value: string) => void;
}

const TextFeedback: FC<TextFeedbackProps> = ({ value, onChange }) => (
  <div className="pt-4 border-t border-gray-100">
    <div className="flex items-center gap-2 mb-2">
      <MessageSquare className="w-4 h-4 text-gray-500" />
      <label className="text-sm text-gray-700 font-medium">
        Any additional feedback? (optional)
      </label>
    </div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Tell us about your experience with the AI... What worked well? What could be improved?"
      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20"
      maxLength={500}
    />
    <div className="text-xs text-gray-400 text-right mt-1">
      {value.length}/500
    </div>
  </div>
);

// ============================================
// SPYMASTER SURVEY
// ============================================

interface SpymasterSurveyProps {
  values: {
    aiGuessAccuracy: number;
    overallTrust: number;
  };
  onChange: (key: string, value: number) => void;
}

const SpymasterSurvey: FC<SpymasterSurveyProps> = ({ values, onChange }) => (
  <div className="space-y-6">
    <SliderQuestion
      label="AI Guess Accuracy"
      value={values.aiGuessAccuracy}
      min="All Wrong"
      max="All Correct"
      onChange={(v) => onChange('aiGuessAccuracy', v)}
    />
    
    <SliderQuestion
      label="Overall Trust in AI Guesser"
      value={values.overallTrust}
      min="Not at All"
      max="Completely"
      onChange={(v) => onChange('overallTrust', v)}
    />
  </div>
);

// ============================================
// GUESSER SURVEY
// ============================================

interface GuesserSurveyProps {
  values: {
    clueClarity: number;
    overallTrust: number;
  };
  onChange: (key: string, value: number) => void;
}

const GuesserSurvey: FC<GuesserSurveyProps> = ({ values, onChange }) => (
  <div className="space-y-6">
    <SliderQuestion
      label="AI Clue Clarity"
      value={values.clueClarity}
      min="Very Confusing"
      max="Crystal Clear"
      onChange={(v) => onChange('clueClarity', v)}
    />
    
    <SliderQuestion
      label="Overall Trust in AI Spymaster"
      value={values.overallTrust}
      min="Not at All"
      max="Completely"
      onChange={(v) => onChange('overallTrust', v)}
    />
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const MicroSurvey: FC<MicroSurveyProps> = ({ 
  turnId, 
  isOpen, 
  playerRole,
  turnHistory,
  userTeam,
  onClose, 
  onSubmit 
}) => {
  // Spymaster-specific state
  const [spymasterValues, setSpymasterValues] = useState({
    aiGuessAccuracy: 4,
    overallTrust: 4,
  });

  // Guesser-specific state
  const [guesserValues, setGuesserValues] = useState({
    clueClarity: 4,
    overallTrust: 4,
  });

  // Text feedback - shared between both roles
  const [textFeedback, setTextFeedback] = useState('');
  
  // Toggle for showing/hiding game summary
  const [showSummary, setShowSummary] = useState(true);

  const handleSpymasterChange = (key: string, value: number) => {
    setSpymasterValues(prev => ({ ...prev, [key]: value }));
  };

  const handleGuesserChange = (key: string, value: number) => {
    setGuesserValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const isSpymaster = playerRole === 'spymaster';
    
    onSubmit({
      turnId,
      timestamp: Date.now(),
      playerRole,
      clueClarity: isSpymaster ? spymasterValues.aiGuessAccuracy : guesserValues.clueClarity,
      trustInAI: isSpymaster ? spymasterValues.overallTrust : guesserValues.overallTrust,
      aiGuessAccuracy: isSpymaster ? spymasterValues.aiGuessAccuracy : undefined,
      userFeedback: textFeedback.trim() || undefined,
    });
    
    // Reset text feedback after submit
    setTextFeedback('');
  };

  const isSpymaster = playerRole === 'spymaster';
  const title = isSpymaster ? 'How Was Your AI Guesser?' : 'How Was Your AI Spymaster?';
  const subtitle = isSpymaster 
    ? 'Help us improve how the AI guesses based on your clues.'
    : 'Help us improve the clues the AI gives you.';

  const hasSummary = turnHistory && turnHistory.length > 0 && userTeam;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`bg-white rounded-2xl p-6 w-full border border-gray-200 shadow-2xl my-4 ${hasSummary ? 'max-w-3xl' : 'max-w-md'}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${isSpymaster ? 'bg-purple-100' : 'bg-blue-100'}`}>
                  {isSpymaster ? (
                    <Target className={`w-5 h-5 ${isSpymaster ? 'text-purple-600' : 'text-blue-600'}`} />
                  ) : (
                    <Eye className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <h3 className="font-display font-bold text-lg text-gray-800">
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <p className="text-gray-500 text-sm mb-6">
              {subtitle}
            </p>

            {/* Game Summary Section */}
            {hasSummary && (
              <div className="mb-6">
                <button
                  onClick={() => setShowSummary(!showSummary)}
                  className="flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 mb-2"
                >
                  {showSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showSummary ? 'Hide' : 'Show'} Game Summary
                </button>
                
                {showSummary && (
                  <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl">
                    <GameSummary 
                      turnHistory={turnHistory} 
                      userRole={playerRole} 
                      userTeam={userTeam} 
                    />
                  </div>
                )}
              </div>
            )}

            {/* Role-specific survey */}
            {isSpymaster ? (
              <SpymasterSurvey 
                values={spymasterValues} 
                onChange={handleSpymasterChange} 
              />
            ) : (
              <GuesserSurvey 
                values={guesserValues} 
                onChange={handleGuesserChange} 
              />
            )}

            {/* Text feedback */}
            <TextFeedback 
              value={textFeedback} 
              onChange={setTextFeedback} 
            />

            {/* Action buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-display rounded-xl transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                className={`flex-1 py-2.5 px-4 ${isSpymaster ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'} text-white font-display font-semibold rounded-xl transition-colors`}
              >
                Submit
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
