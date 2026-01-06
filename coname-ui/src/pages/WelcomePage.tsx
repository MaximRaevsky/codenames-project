import { FC } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, ArrowRight, Bot, Users, Settings, Clock, Mail, AlertCircle, BarChart3, LogOut, User } from 'lucide-react';

import { useAppState } from '../hooks/useGameState';
import { Logo } from '../components/Logo';
import { RulesTooltip } from '../components/RulesTooltip';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useLanguage } from '../i18n';

// ============================================
// CONSTANTS
// ============================================

const ANIMATION_DELAYS = {
  description: 0.4,
  teamSelection: 0.45,
  roleSelector: 0.5,
  actions: 0.6,
  footer: 0.7,
};

// ============================================
// SUB-COMPONENTS
// ============================================

const ColorLegend: FC<{ isRTL: boolean }> = ({ isRTL }) => (
  <div className="mt-4 p-4 bg-gray-50 rounded-xl">
    <div className={`flex items-center gap-4 text-sm flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-red-500" />
        <span className="text-gray-700">{isRTL ? 'קבוצה אדומה' : 'Red Team'}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-blue-500" />
        <span className="text-gray-700">{isRTL ? 'קבוצה כחולה' : 'Blue Team'}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-amber-200" />
        <span className="text-gray-700">{isRTL ? 'ניטרלי' : 'Neutral'}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-gray-800" />
        <span className="text-gray-700">{isRTL ? 'מתנקש' : 'Assassin'}</span>
      </div>
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const WelcomePage: FC = () => {
  const {
    settings,
    setSettings,
    profile,
    startNewGame,
    resumeGame,
    hasExistingGame,
    setCurrentPage,
    hasCompletedProfile,
    logout,
  } = useAppState();
  
  const { t, isRTL } = useLanguage();

  const hasValidEmail = profile.email && profile.email.length > 0;

  const handleStartGame = () => {
    if (!hasCompletedProfile || !hasValidEmail) {
      setCurrentPage('profile');
    } else {
      startNewGame();
    }
  };

  const teamButtonClass = (team: 'red' | 'blue', isSelected: boolean) => {
    const baseClass = 'p-4 rounded-xl border-2 transition-all';

    if (isSelected) {
      return `${baseClass} ${team === 'red' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}`;
    }

    return `${baseClass} border-gray-200 bg-white hover:border-gray-300`;
  };

  const roleButtonClass = (isSelected: boolean) => {
    const baseClass = 'p-4 rounded-xl border-2 transition-all';

    if (isSelected) {
      return `${baseClass} border-purple-500 bg-purple-50`;
    }

    return `${baseClass} border-gray-200 bg-white hover:border-gray-300`;
  };

  const startButtonGradient = settings.playerTeam === 'red'
    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-red-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-50 rounded-full blur-3xl opacity-40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-2xl w-full"
      >
        {/* Language Switcher */}
        <div className="absolute top-0 right-0">
          <LanguageSwitcher />
        </div>
        
        {/* Logo */}
        <div className="mb-8">
          <Logo size="lg" animate={true} />
        </div>

        {/* Profile Alert - Show if no email */}
        {!hasValidEmail && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-amber-900 mb-1">
                  Profile Setup Required
                </h3>
                <p className="text-sm text-amber-700 mb-3">
                  Before you can start playing, please complete your profile with your email address. 
                  This helps us save your preferences and improve your AI teammate experience.
                </p>
                <button
                  onClick={() => setCurrentPage('profile')}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Complete Profile Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Description Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ANIMATION_DELAYS.description }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-200 shadow-lg"
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className="font-display font-semibold text-xl text-gray-800">
              {isRTL ? 'שחק קודניימס עם שותף AI' : 'Play Codenames with an AI Teammate'}
            </h2>
            <RulesTooltip position="left" />
          </div>
          <p className="text-gray-600 leading-relaxed">
            {isRTL ? (
              <>
                שתף פעולה עם שותף AI לשחק קודניימס! כ
                <span className="text-red-500 font-semibold">מנהל מרגלים</span>, אתה נותן רמזים ושותף ה-AI שלך מנחש.
                כ<span className="text-blue-500 font-semibold">מנחש</span>, שותף ה-AI שלך נותן רמזים ואתה מפענח אותם.
                עבדו יחד למצוא את כל המילים של הקבוצה לפני קבוצת ה-AI היריבה!
              </>
            ) : (
              <>
                Team up with an AI partner to play Codenames! As a{' '}
                <span className="text-red-500 font-semibold">Spymaster</span>, you give clues while your AI teammate guesses.
                As a <span className="text-blue-500 font-semibold">Guesser</span>, your AI teammate gives clues and you decode them.
                Work together to find all your team's words before the rival AI team does!
              </>
            )}
          </p>
          <ColorLegend isRTL={isRTL} />
        </motion.div>

        {/* Team Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ANIMATION_DELAYS.teamSelection }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-200 shadow-lg"
        >
          <h3 className="font-display font-semibold text-lg text-gray-800 mb-2">
            {isRTL ? 'בחר קבוצה' : 'Choose Your Team'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {isRTL ? 'הקבוצה המתחילה נבחרת באקראי בכל משחק' : 'Starting team is randomly chosen each game'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSettings({ playerTeam: 'red' })}
              className={teamButtonClass('red', settings.playerTeam === 'red')}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-red-500" />
                <span className={`font-display font-semibold ${settings.playerTeam === 'red' ? 'text-red-600' : 'text-gray-700'}`}>
                  {isRTL ? 'קבוצה אדומה' : 'Red Team'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {isRTL ? 'אתה + AI נגד קבוצה כחולה' : 'You + AI vs Blue Team'}
              </div>
            </button>

            <button
              onClick={() => setSettings({ playerTeam: 'blue' })}
              className={teamButtonClass('blue', settings.playerTeam === 'blue')}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-500" />
                <span className={`font-display font-semibold ${settings.playerTeam === 'blue' ? 'text-blue-600' : 'text-gray-700'}`}>
                  {isRTL ? 'קבוצה כחולה' : 'Blue Team'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {isRTL ? 'אתה + AI נגד קבוצה אדומה' : 'You + AI vs Red Team'}
              </div>
            </button>
          </div>
        </motion.div>

        {/* Role Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ANIMATION_DELAYS.roleSelector }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-200 shadow-lg"
        >
          <h3 className="font-display font-semibold text-lg text-gray-800 mb-4">
            {t('selectRole')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSettings({ playerRole: 'spymaster' })}
              className={roleButtonClass(settings.playerRole === 'spymaster')}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className={`w-5 h-5 ${settings.playerRole === 'spymaster' ? 'text-purple-600' : 'text-gray-500'}`} />
                <span className={`font-display font-semibold ${settings.playerRole === 'spymaster' ? 'text-purple-600' : 'text-gray-700'}`}>
                  {t('spymaster')}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {isRTL ? 'אתה רואה את כל הצבעים ונותן רמזים' : 'You see all colors & give clues'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {isRTL ? 'שותף ה-AI מנחש' : 'AI teammate guesses'}
              </div>
            </button>

            <button
              onClick={() => setSettings({ playerRole: 'guesser' })}
              className={roleButtonClass(settings.playerRole === 'guesser')}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Bot className={`w-5 h-5 ${settings.playerRole === 'guesser' ? 'text-purple-600' : 'text-gray-500'}`} />
                <span className={`font-display font-semibold ${settings.playerRole === 'guesser' ? 'text-purple-600' : 'text-gray-700'}`}>
                  {t('guesser')}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {isRTL ? 'ה-AI נותן רמזים, אתה מנחש' : 'AI gives clues, you guess'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {isRTL ? 'הצבעים מוסתרים ממך' : 'Colors hidden from you'}
              </div>
            </button>
          </div>
        </motion.div>

        {/* Timer Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ANIMATION_DELAYS.roleSelector + 0.05 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-200 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-gray-600" />
            <h3 className="font-display font-semibold text-lg text-gray-800">Timer Duration</h3>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[0, 1, 2, 3, 5].map((minutes) => (
              <button
                key={minutes}
                onClick={() => setSettings({ timerMinutes: minutes })}
                className={`p-3 rounded-xl border-2 transition-all ${
                  settings.timerMinutes === minutes
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="text-center">
                  <div className={`font-bold text-lg ${settings.timerMinutes === minutes ? 'text-indigo-600' : 'text-gray-800'}`}>
                    {minutes === 0 ? '∞' : minutes}
                  </div>
                  <div className="text-xs text-gray-500">
                    {minutes === 0 ? 'No Timer' : `min${minutes > 1 ? 's' : ''}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Timer applies to each turn (both clue and guess phases)
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ANIMATION_DELAYS.actions }}
          className="space-y-3"
        >
          <button
            onClick={handleStartGame}
            disabled={!hasValidEmail}
            className={`w-full flex items-center justify-center gap-3 py-4 px-6 font-display font-bold text-lg rounded-xl transition-all shadow-lg ${
              hasValidEmail
                ? `${startButtonGradient} text-white hover:shadow-xl cursor-pointer`
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Play className="w-6 h-6" />
            {!hasValidEmail 
              ? (isRTL ? 'השלם פרופיל קודם' : 'Complete Profile First')
              : hasCompletedProfile 
                ? t('startNewGame')
                : (isRTL ? 'הגדר פרופיל והתחל' : 'Set Up Profile & Play')}
            <ArrowRight className="w-5 h-5" />
          </button>

          {!hasValidEmail && (
            <p className="text-center text-sm text-amber-700 bg-amber-50 py-2 px-4 rounded-lg border border-amber-200">
              <span className="font-semibold">⚠️ {isRTL ? 'נדרש אימייל:' : 'Email required:'}</span>{' '}
              {isRTL ? 'אנא השלם את הפרופיל שלך כדי להתחיל לשחק' : 'Please complete your profile to start playing'}
            </p>
          )}

          {hasExistingGame() && hasValidEmail && (
            <button
              onClick={resumeGame}
              className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-white hover:bg-gray-50 text-gray-700 font-display font-semibold rounded-xl transition-colors border border-gray-200 shadow"
            >
              <RotateCcw className="w-5 h-5" />
              {t('continueGame')}
            </button>
          )}

          {/* Logged in user info & actions - visible when profile exists */}
          {hasCompletedProfile && hasValidEmail && (
            <div className="space-y-3">
              {/* User info bar */}
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <User className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-medium">Logged in as</p>
                    <p className="text-sm text-green-800 font-semibold">{profile.email}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {isRTL ? 'התנתק' : 'Logout'}
                </button>
              </div>
              
              {/* Edit Profile & Metrics buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentPage('profile')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-600 font-display rounded-xl transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  {t('editProfile')}
                </button>
                <button
                  onClick={() => setCurrentPage('metrics')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 text-purple-700 font-display rounded-xl transition-colors border border-purple-200"
                >
                  <BarChart3 className="w-5 h-5" />
                  {isRTL ? 'מדדים' : 'Metrics'}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: ANIMATION_DELAYS.footer }}
          className="text-center mt-8 text-gray-400 text-sm"
        >
          Human-AI Collaboration in Codenames
        </motion.div>
      </motion.div>
    </div>
  );
};

// Default export for backwards compatibility
export default WelcomePage;
