import { FC, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  TrendingUp, 
  TrendingDown,
  Trophy, 
  Target, 
  Brain,
  BarChart3,
  Activity,
  Users,
  Zap,
  MessageSquare
} from 'lucide-react';
import { useAppState } from '../hooks/useGameState';
import { Logo } from '../components/Logo';
import { getUser, getDatabaseStats } from '../utils/userDatabase';

// ============================================
// TYPES
// ============================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange';
}

interface ChartBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

// ============================================
// HELPER COMPONENTS
// ============================================

const MetricCard: FC<MetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  trendValue,
  color = 'blue' 
}) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[color]} text-white`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : 
             trend === 'down' ? <TrendingDown className="w-4 h-4" /> : null}
            {trendValue}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </motion.div>
  );
};

const ChartBar: FC<ChartBarProps> = ({ label, value, maxValue, color }) => {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-sm text-gray-600 text-right">{label}</div>
      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
      <div className="w-12 text-sm font-medium text-gray-700">{value}</div>
    </div>
  );
};

const TrustGauge: FC<{ value: number; label: string }> = ({ value, label }) => {
  // value is 1-7, convert to percentage
  const percentage = ((value - 1) / 6) * 100;
  const rotation = (percentage / 100) * 180 - 90; // -90 to 90 degrees
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-t-full" />
        <div className="absolute inset-1 bg-white rounded-t-full" />
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-14 bg-gray-800 origin-bottom rounded-full"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-gray-800 rounded-full transform -translate-x-1/2 translate-y-1/2" />
      </div>
      <div className="text-2xl font-bold text-gray-800 mt-2">{value.toFixed(1)}/7</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const MetricsPage: FC = () => {
  const { 
    profile, 
    surveyResponses, 
    setCurrentPage,
    game,
  } = useAppState();

  // Get user data from database
  const userData = useMemo(() => {
    if (!profile.email) return null;
    return getUser(profile.email);
  }, [profile.email]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const dbStats = getDatabaseStats();
    
    // Survey-based metrics
    const recentSurveys = surveyResponses.slice(-20); // Last 20 surveys
    const avgTrust = recentSurveys.length > 0 
      ? recentSurveys.reduce((sum, s) => sum + s.trustInAI, 0) / recentSurveys.length 
      : 0;
    const avgClarity = recentSurveys.length > 0
      ? recentSurveys.reduce((sum, s) => sum + s.clueClarity, 0) / recentSurveys.length
      : 0;
    
    // Trust trend (compare first half to second half)
    let trustTrend: 'up' | 'down' | 'neutral' = 'neutral';
    let trustChange = 0;
    if (recentSurveys.length >= 4) {
      const half = Math.floor(recentSurveys.length / 2);
      const firstHalf = recentSurveys.slice(0, half);
      const secondHalf = recentSurveys.slice(half);
      const firstAvg = firstHalf.reduce((sum, s) => sum + s.trustInAI, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, s) => sum + s.trustInAI, 0) / secondHalf.length;
      trustChange = secondAvg - firstAvg;
      trustTrend = trustChange > 0.3 ? 'up' : trustChange < -0.3 ? 'down' : 'neutral';
    }

    // Role-specific metrics
    const spymasterSurveys = surveyResponses.filter(s => s.playerRole === 'spymaster');
    const guesserSurveys = surveyResponses.filter(s => s.playerRole === 'guesser');
    
    const avgGuessAccuracy = spymasterSurveys.length > 0
      ? spymasterSurveys.reduce((sum, s) => sum + (s.aiGuessAccuracy || 0), 0) / spymasterSurveys.length
      : 0;

    // Feedback analysis
    const feedbackCount = surveyResponses.filter(s => s.userFeedback && s.userFeedback.length > 0).length;
    
    // Trust distribution
    const trustDistribution = [0, 0, 0, 0, 0, 0, 0]; // 1-7
    surveyResponses.forEach(s => {
      if (s.trustInAI >= 1 && s.trustInAI <= 7) {
        trustDistribution[s.trustInAI - 1]++;
      }
    });

    return {
      totalGames: userData?.gamesPlayed || 0,
      totalSurveys: surveyResponses.length,
      avgTrust,
      avgClarity,
      trustTrend,
      trustChange,
      avgGuessAccuracy,
      feedbackCount,
      spymasterGames: spymasterSurveys.length,
      guesserGames: guesserSurveys.length,
      trustDistribution,
      hasSummary: !!userData?.llmSummary,
      summaryLength: userData?.llmSummary?.length || 0,
      dbStats,
    };
  }, [surveyResponses, userData]);

  // Trust history for chart
  const trustHistory = useMemo(() => {
    return surveyResponses.slice(-10).map((s, i) => ({
      game: i + 1,
      trust: s.trustInAI,
      clarity: s.clueClarity,
    }));
  }, [surveyResponses]);

  const handleBack = () => {
    if (game && game.status === 'playing') {
      setCurrentPage('game');
    } else {
      setCurrentPage('welcome');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 py-8 px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-purple-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-50 rounded-full blur-3xl opacity-60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-6xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <Logo size="sm" animate={false} />
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl mb-4">
            <BarChart3 className="w-8 h-8 text-purple-600" />
          </div>
          <h1 className="font-display text-3xl font-bold text-gray-800 mb-2">
            Performance Metrics
          </h1>
          <p className="text-gray-500">
            Track your progress and trust with the AI agent
          </p>
        </div>

        {/* No data state */}
        {metrics.totalSurveys === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
            <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Data Yet</h2>
            <p className="text-gray-500 mb-6">
              Play some games and complete the feedback surveys to see your metrics!
            </p>
            <button
              onClick={() => setCurrentPage('welcome')}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-blue-600 transition-colors"
            >
              Start Playing
            </button>
          </div>
        ) : (
          <>
            {/* Trust Gauges */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6">
              <h2 className="font-display font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                Trust & Satisfaction
              </h2>
              <div className="flex justify-around flex-wrap gap-8">
                <TrustGauge value={metrics.avgTrust || 4} label="Overall Trust" />
                <TrustGauge value={metrics.avgClarity || 4} label="Clue Clarity" />
                {metrics.avgGuessAccuracy > 0 && (
                  <TrustGauge value={metrics.avgGuessAccuracy} label="AI Guess Accuracy" />
                )}
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                title="Games Played"
                value={metrics.totalGames}
                icon={<Trophy className="w-5 h-5" />}
                color="blue"
              />
              <MetricCard
                title="Surveys Completed"
                value={metrics.totalSurveys}
                subtitle={`${metrics.feedbackCount} with written feedback`}
                icon={<MessageSquare className="w-5 h-5" />}
                color="green"
              />
              <MetricCard
                title="Trust Trend"
                value={metrics.trustTrend === 'up' ? 'Improving' : metrics.trustTrend === 'down' ? 'Declining' : 'Stable'}
                trend={metrics.trustTrend}
                trendValue={metrics.trustChange !== 0 ? `${metrics.trustChange > 0 ? '+' : ''}${metrics.trustChange.toFixed(1)}` : ''}
                icon={<Activity className="w-5 h-5" />}
                color={metrics.trustTrend === 'up' ? 'green' : metrics.trustTrend === 'down' ? 'red' : 'purple'}
              />
              <MetricCard
                title="AI Learning"
                value={metrics.hasSummary ? 'Active' : 'Pending'}
                subtitle={metrics.hasSummary ? 'Clues & guesses personalized' : 'Complete more games'}
                icon={<Zap className="w-5 h-5" />}
                color={metrics.hasSummary ? 'orange' : 'purple'}
              />
            </div>

            {/* Role Breakdown */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Trust Distribution */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h2 className="font-display font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Trust Distribution
                </h2>
                <div className="space-y-2">
                  {metrics.trustDistribution.map((count, i) => (
                    <ChartBar
                      key={i}
                      label={`${i + 1}/7`}
                      value={count}
                      maxValue={Math.max(...metrics.trustDistribution, 1)}
                      color={i < 2 ? 'bg-red-400' : i < 4 ? 'bg-yellow-400' : 'bg-green-400'}
                    />
                  ))}
                </div>
              </div>

              {/* Role Stats */}
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h2 className="font-display font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-500" />
                  Games by Role
                </h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">As Spymaster</span>
                      <span className="font-medium">{metrics.spymasterGames}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${metrics.totalSurveys > 0 ? (metrics.spymasterGames / metrics.totalSurveys) * 100 : 0}%` 
                        }}
                        className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">As Guesser</span>
                      <span className="font-medium">{metrics.guesserGames}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${metrics.totalSurveys > 0 ? (metrics.guesserGames / metrics.totalSurveys) * 100 : 0}%` 
                        }}
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100">
                  <div className="text-sm text-gray-500 mb-2">AI Learning Status</div>
                  {metrics.hasSummary ? (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-green-700 font-medium text-sm">Summary Active</div>
                      <div className="text-green-600 text-xs mt-1">
                        AI adjusts clue creativity and risk based on your preferences
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="text-yellow-700 font-medium text-sm">Learning in Progress</div>
                      <div className="text-yellow-600 text-xs mt-1">
                        Complete more games to build your profile
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Trust History Line Graph */}
            {trustHistory.length > 1 && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6">
                <h2 className="font-display font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                  Trust Over Time (Last 10 Games)
                </h2>
                <div className="relative">
                  {/* SVG Line Graph */}
                  <svg viewBox="0 0 500 200" className="w-full h-64">
                    {/* Background grid */}
                    <defs>
                      <linearGradient id="trustGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    
                    {/* Y-axis labels */}
                    <text x="15" y="25" className="text-[10px] fill-gray-400">7</text>
                    <text x="15" y="65" className="text-[10px] fill-gray-400">6</text>
                    <text x="15" y="105" className="text-[10px] fill-gray-400">5</text>
                    <text x="15" y="145" className="text-[10px] fill-gray-400">4</text>
                    <text x="15" y="185" className="text-[10px] fill-gray-400">3</text>
                    
                    {/* Grid lines */}
                    {[1, 2, 3, 4, 5].map(i => (
                      <line key={i} x1="40" y1={i * 40} x2="480" y2={i * 40} stroke="#e5e7eb" strokeWidth="1" />
                    ))}
                    
                    {/* Neutral line (4) */}
                    <line x1="40" y1="120" x2="480" y2="120" stroke="#f59e0b" strokeWidth="1" strokeDasharray="5,5" />
                    <text x="485" y="124" className="text-[8px] fill-amber-500">neutral</text>
                    
                    {/* Area fill under line */}
                    <motion.path
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1 }}
                      d={`M ${40 + (440 / (trustHistory.length - 1)) * 0} ${200 - ((trustHistory[0]?.trust || 4) / 7) * 180} ` +
                        trustHistory.map((p, i) => 
                          `L ${40 + (440 / (trustHistory.length - 1)) * i} ${200 - (p.trust / 7) * 180}`
                        ).join(' ') +
                        ` L ${40 + (440 / (trustHistory.length - 1)) * (trustHistory.length - 1)} 200 L 40 200 Z`}
                      fill="url(#trustGradient)"
                    />
                    
                    {/* Line */}
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.5, ease: "easeInOut" }}
                      d={trustHistory.map((p, i) => 
                        `${i === 0 ? 'M' : 'L'} ${40 + (440 / (trustHistory.length - 1)) * i} ${200 - (p.trust / 7) * 180}`
                      ).join(' ')}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* Data points */}
                    {trustHistory.map((p, i) => {
                      const x = 40 + (440 / (trustHistory.length - 1)) * i;
                      const y = 200 - (p.trust / 7) * 180;
                      const color = p.trust >= 6 ? '#22c55e' : p.trust >= 4 ? '#8b5cf6' : '#f97316';
                      return (
                        <g key={i}>
                          <motion.circle
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                            cx={x}
                            cy={y}
                            r="8"
                            fill={color}
                            stroke="white"
                            strokeWidth="2"
                          />
                          <text x={x} y={y + 4} textAnchor="middle" className="text-[10px] fill-white font-bold">
                            {p.trust}
                          </text>
                          <text x={x} y="215" textAnchor="middle" className="text-[9px] fill-gray-500">
                            G{p.game}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                
                {/* Legend */}
                <div className="flex justify-center gap-6 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-gray-500">High (6-7)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-gray-500">Medium (4-5)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-gray-500">Low (1-3)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }} />
                    <span className="text-gray-500">Neutral line</span>
                  </div>
                </div>
              </div>
            )}

            {/* How We're Learning About You */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h2 className="font-display font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-orange-500" />
                How We're Learning About You
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  The AI adapts to your play style through several mechanisms:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-purple-500" />
                      <span className="font-medium text-purple-700">Your Feedback</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      After each game, your survey responses and written feedback help us understand what clue styles work best for you.
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-green-700">Gameplay Patterns</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      We track which clues led to successful guesses and which caused confusion, learning your interpretation style.
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-orange-500" />
                      <span className="font-medium text-orange-700">Your Profile</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Your interests, occupation, and problem-solving approach help the AI choose clues that resonate with your background.
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-blue-700">Continuous Improvement</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      After each game, the AI updates its understanding of your preferences, getting better at communicating with you over time.
                    </p>
                  </div>
                </div>
                {metrics.hasSummary && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200 mt-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-green-600" />
                      <span className="text-green-700 font-medium text-sm">
                        AI Adaptation Active - Personalizing clues and guesses based on your play history
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default MetricsPage;

