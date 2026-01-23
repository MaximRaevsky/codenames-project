import { FC, useState } from 'react';
import { motion } from 'framer-motion';
import { User, ChevronRight, ChevronLeft, Check, Edit3, Users as UsersIcon, Brain, Lightbulb } from 'lucide-react';

import { useAppState } from '../hooks/useGameState';
import { UserProfile } from '../types/game';
import { Logo } from '../components/Logo';
import { getUser } from '../utils/userDatabase';

// ============================================
// CONSTANTS
// ============================================

const INTERESTS = [
  { id: 'technology', label: 'Technology', emoji: '💻' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'arts', label: 'Arts & Culture', emoji: '🎨' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'movies', label: 'Movies & TV', emoji: '🎬' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'food', label: 'Food & Cooking', emoji: '🍳' },
  { id: 'history', label: 'History', emoji: '📜' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'business', label: 'Business', emoji: '💼' },
];

// ============================================
// HELPER COMPONENTS
// ============================================

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

const SectionHeader: FC<SectionHeaderProps> = ({ icon, title, subtitle }) => (
  <div className="flex items-start gap-3 mb-3">
    <div className="p-2 bg-gray-100 rounded-lg">
      {icon}
    </div>
    <div>
      <h3 className="font-display font-semibold text-gray-800">{title}</h3>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  </div>
);

// ============================================
// HELPER FUNCTIONS
// ============================================

// Ensure profile has all required fields with defaults
const ensureProfileDefaults = (profile: Partial<UserProfile>): UserProfile => ({
  email: profile.email || '',
  age: profile.age || '',
  occupation: profile.occupation || '',
  problemSolvingApproach: profile.problemSolvingApproach || '',
  interests: profile.interests || [],
  additionalNotes: profile.additionalNotes || '',
  llmSummary: profile.llmSummary || '',
});

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ProfilePage: FC = () => {
  const { 
    profile, 
    setProfile, 
    setHasCompletedProfile, 
    setCurrentPage,
    hasCompletedProfile,
    game,
  } = useAppState();

  // Ensure we have all fields with safe defaults (handles old localStorage data)
  const [formData, setFormData] = useState<UserProfile>(() => ensureProfileDefaults(profile));
  const [emailError, setEmailError] = useState('');
  const isEditing = hasCompletedProfile;

  const validateAndSetEmail = (email: string) => {
    setFormData({ ...formData, email });
    if (email && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else if (!email) {
      setEmailError('Email is required');
    } else {
      setEmailError('');
      
      // Check if user exists in database and load their data
      const existingUser = getUser(email);
      if (existingUser) {
        setFormData({
          email: existingUser.email,
          age: existingUser.age || '',
          occupation: existingUser.occupation || '',
          problemSolvingApproach: existingUser.problemSolvingApproach || '',
          interests: existingUser.interests || [],
          additionalNotes: existingUser.additionalNotes || '',
          llmSummary: existingUser.llmSummary || '',
        });
      }
    }
  };

  const toggleInterest = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests?.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...(prev.interests || []), interest],
    }));
  };

  const handleSave = () => {
    // Validate email before saving
    if (!formData.email || !isValidEmail(formData.email)) {
      setEmailError(formData.email ? 'Please enter a valid email address' : 'Email is required');
      return;
    }

    setProfile(formData);
    setHasCompletedProfile(true);
    
    if (isEditing) {
      // If there's an active game (not game over), go back to it
      if (game && game.status === 'playing') {
        setCurrentPage('game');
      } else {
        // Otherwise go to welcome page
        setCurrentPage('welcome');
      }
    } else {
      // First time profile setup - go to welcome page
      setCurrentPage('welcome');
    }
  };

  const canSave = formData.email && isValidEmail(formData.email);

  const handleBack = () => {
    // If there's an active game (not game over), go back to it
    if (game && game.status === 'playing') {
      setCurrentPage('game');
    } else {
      // Otherwise go to welcome page
      setCurrentPage('welcome');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 py-8 px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-red-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-blue-50 rounded-full blur-3xl opacity-60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-2xl mx-auto"
      >
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <Logo size="sm" animate={false} />
          <div className="mt-4 inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-100 to-blue-100 rounded-2xl">
            {isEditing ? (
              <Edit3 className="w-8 h-8 text-gray-700" />
            ) : (
              <User className="w-8 h-8 text-gray-700" />
            )}
          </div>
          <h1 className="font-display text-3xl font-bold text-gray-800 mt-4 mb-2">
            {isEditing ? 'Edit Your Profile' : 'Tell Us About Yourself'}
          </h1>
          <p className="text-gray-500 max-w-md mx-auto">
            {isEditing 
              ? 'Update your information to improve your experience' 
              : 'Help us understand how you think - this helps the AI adapt to you'}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            <span className="text-red-500">*</span> = Required
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg space-y-6">
          
          {/* Email - Required */}
          <div>
            <label className="block font-display font-semibold text-gray-800 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => validateAndSetEmail(e.target.value)}
              placeholder="your.email@example.com"
              className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
                emailError 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-gray-200 focus:ring-blue-500'
              }`}
              required
            />
            {emailError && (
              <p className="mt-2 text-sm text-red-600">{emailError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Your unique identifier for saving preferences
            </p>
          </div>

          {/* Demographics Section */}
          <div className="pt-4 border-t border-gray-100">
            <SectionHeader 
              icon={<UsersIcon className="w-5 h-5 text-gray-600" />}
              title="About You"
              subtitle="Optional - helps us understand your background"
            />

            {/* Age Range */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age Range (click to toggle)
              </label>
              <select
                value={formData.age || ''}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Not selected</option>
                <option value="under-18">Under 18</option>
                <option value="18-24">18-24</option>
                <option value="25-34">25-34</option>
                <option value="35-44">35-44</option>
                <option value="45-54">45-54</option>
                <option value="55-64">55-64</option>
                <option value="65+">65+</option>
              </select>
            </div>

            {/* Occupation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Occupation
              </label>
              <input
                type="text"
                value={formData.occupation || ''}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                placeholder="e.g., Student, Engineer, Teacher"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cognitive Style Section */}
          <div className="pt-4 border-t border-gray-100">
            <SectionHeader 
              icon={<Brain className="w-5 h-5 text-gray-600" />}
              title="Problem Solving Approach"
              subtitle="Optional - helps AI match your mental model (click to toggle)"
            />

            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'systematic', label: 'Systematic', desc: 'Step by step' },
                { id: 'creative', label: 'Creative', desc: 'Out of the box' },
                { id: 'both', label: 'Flexible', desc: 'Mix of both' },
              ].map((approach) => (
                <button
                  key={approach.id}
                  onClick={() => setFormData({ 
                    ...formData, 
                    problemSolvingApproach: formData.problemSolvingApproach === approach.id ? '' : approach.id as any 
                  })}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    formData.problemSolvingApproach === approach.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 ${
                    formData.problemSolvingApproach === approach.id ? 'text-green-600' : 'text-gray-700'
                  }`}>
                    {approach.label}
                  </div>
                  <div className="text-xs text-gray-500">{approach.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Interests Section */}
          <div className="pt-4 border-t border-gray-100">
            <SectionHeader 
              icon={<Lightbulb className="w-5 h-5 text-gray-600" />}
              title="Your Interests"
              subtitle="Optional - click to toggle interests"
            />
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((interest) => (
                <button
                  key={interest.id}
                  onClick={() => toggleInterest(interest.id)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    formData.interests?.includes(interest.id)
                      ? 'bg-purple-500 text-white font-medium shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="mr-1">{interest.emoji}</span>
                  {interest.label}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div className="pt-4 border-t border-gray-100">
            <label className="block font-display font-medium text-gray-700 mb-2">
              Anything else we should know?
            </label>
            <textarea
              value={formData.additionalNotes || ''}
              onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
              placeholder="Any other information that might help the AI understand how you think..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
            />
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full flex items-center justify-center gap-2 py-3 px-6 font-display font-bold rounded-xl transition-all shadow-md ${
              canSave
                ? 'bg-gradient-to-r from-red-500 to-blue-500 hover:from-red-600 hover:to-blue-600 text-white cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-5 h-5" />
            {isEditing ? 'Save Changes' : 'Save & Continue'}
            {!isEditing && <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
        {!canSave && !isEditing && (
          <p className="text-center text-sm text-red-600 mt-2">
            Please enter a valid email address to continue
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default ProfilePage;
