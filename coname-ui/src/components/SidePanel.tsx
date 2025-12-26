import { FC } from 'react';
import { motion } from 'framer-motion';
import { Users, Target, History, Plus } from 'lucide-react';

import { TurnEvent, Team } from '../types/game';
import { useAppState } from '../hooks/useGameState';

// ============================================
// TYPES
// ============================================

export interface SidePanelProps {
  currentTeam: Team;
  teamARemaining: number;
  teamBRemaining: number;
  turnHistory: TurnEvent[];
  onNewGame: () => void;
}

interface TeamDisplayConfig {
  bgClass: string;
  borderClass: string;
  textClass: string;
  gradientClass: string;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_RECENT_EVENTS = 5;

const RED_TEAM_CONFIG: TeamDisplayConfig = {
  bgClass: 'bg-red-50',
  borderClass: 'border-red-100',
  textClass: 'text-red-600',
  gradientClass: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
};

const BLUE_TEAM_CONFIG: TeamDisplayConfig = {
  bgClass: 'bg-blue-50',
  borderClass: 'border-blue-100',
  textClass: 'text-blue-600',
  gradientClass: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getTeamConfig = (isRed: boolean): TeamDisplayConfig =>
  isRed ? RED_TEAM_CONFIG : BLUE_TEAM_CONFIG;

const formatClueNumber = (clueNumber: number): string =>
  clueNumber === -1 ? '∞' : String(clueNumber);

// ============================================
// SUB-COMPONENTS
// ============================================

interface CurrentTurnSectionProps {
  isUserTurn: boolean;
  userIsRed: boolean;
}

const CurrentTurnSection: FC<CurrentTurnSectionProps> = ({ isUserTurn, userIsRed }) => {
  const activeConfig = isUserTurn ? getTeamConfig(userIsRed) : getTeamConfig(!userIsRed);

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-gray-500" />
        <h3 className="font-display font-semibold text-gray-700">Current Turn</h3>
      </div>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`text-center py-3 rounded-xl font-display font-bold text-lg ${activeConfig.bgClass} ${activeConfig.textClass} border ${activeConfig.borderClass}`}
      >
        {isUserTurn ? 'Your Turn' : "Rival's Turn"}
      </motion.div>
    </div>
  );
};

interface WordsRemainingSectionProps {
  userTeamRemaining: number;
  rivalTeamRemaining: number;
  userIsRed: boolean;
}

const WordsRemainingSection: FC<WordsRemainingSectionProps> = ({
  userTeamRemaining,
  rivalTeamRemaining,
  userIsRed,
}) => {
  const userConfig = getTeamConfig(userIsRed);
  const rivalConfig = getTeamConfig(!userIsRed);

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-gray-500" />
        <h3 className="font-display font-semibold text-gray-700">Words Remaining</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={`text-center p-3 rounded-xl border ${userConfig.bgClass} ${userConfig.borderClass}`}>
          <div className={`text-3xl font-mono font-bold ${userConfig.textClass}`}>
            {userTeamRemaining}
          </div>
          <div className={`text-xs ${userConfig.textClass} mt-1 opacity-80`}>
            Your Team
          </div>
        </div>
        <div className={`text-center p-3 rounded-xl border ${rivalConfig.bgClass} ${rivalConfig.borderClass}`}>
          <div className={`text-3xl font-mono font-bold ${rivalConfig.textClass}`}>
            {rivalTeamRemaining}
          </div>
          <div className={`text-xs ${rivalConfig.textClass} mt-1 opacity-80`}>
            Rival Team
          </div>
        </div>
      </div>
    </div>
  );
};

interface TurnHistoryEventProps {
  event: TurnEvent;
  isUserTeamEvent: boolean;
  userIsRed: boolean;
}

const TurnHistoryEvent: FC<TurnHistoryEventProps> = ({ event, isUserTeamEvent, userIsRed }) => {
  const eventConfig = getTeamConfig(isUserTeamEvent ? userIsRed : !userIsRed);
  const borderColorClass = isUserTeamEvent
    ? (userIsRed ? 'border-red-500' : 'border-blue-500')
    : (userIsRed ? 'border-blue-500' : 'border-red-500');

  const guessElements = event.guessResults.map((result, index) => {
    const getColorByCategory = () => {
      switch (result.category) {
        case 'teamA':
          return 'text-red-600';
        case 'teamB':
          return 'text-blue-600';
        case 'neutral':
          return 'text-amber-600';
        case 'assassin':
          return 'text-gray-900';
        default:
          return 'text-gray-400';
      }
    };

    const colorClass = getColorByCategory();
    const separator = index < event.guessResults.length - 1 ? ', ' : '';

    return (
      <span key={index} className={colorClass}>
        {result.word}{separator}
      </span>
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-2 rounded-lg text-sm ${eventConfig.bgClass} border-l-4 ${borderColorClass}`}
    >
      <div className="flex justify-between items-center">
        <span className={`font-mono font-semibold ${eventConfig.textClass}`}>
          "{event.clue}" : {formatClueNumber(event.clueNumber)}
        </span>
      </div>
      <div className="text-gray-500 text-xs mt-1">
        {guessElements}
      </div>
    </motion.div>
  );
};

interface TurnHistorySectionProps {
  events: TurnEvent[];
  userIsRed: boolean;
}

const TurnHistorySection: FC<TurnHistorySectionProps> = ({ events, userIsRed }) => {
  const hasEvents = events.length > 0;

  const eventElements = events.map((event) => {
    const isUserTeamEvent = userIsRed ? event.team === 'teamA' : event.team === 'teamB';

    return (
      <TurnHistoryEvent
        key={event.id}
        event={event}
        isUserTeamEvent={isUserTeamEvent}
        userIsRed={userIsRed}
      />
    );
  });

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-5 h-5 text-gray-500" />
        <h3 className="font-display font-semibold text-gray-700">Recent Turns</h3>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {hasEvents ? eventElements : (
          <p className="text-sm text-gray-400 italic">No turns yet</p>
        )}
      </div>
    </div>
  );
};

interface ActionsSectionProps {
  userIsRed: boolean;
  onNewGame: () => void;
}

const ActionsSection: FC<ActionsSectionProps> = ({ userIsRed, onNewGame }) => {
  const config = getTeamConfig(userIsRed);

  return (
    <div>
      <button
        onClick={onNewGame}
        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 text-white font-display font-semibold rounded-xl transition-all shadow-md ${config.gradientClass}`}
      >
        <Plus className="w-4 h-4" />
        New Game
      </button>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const SidePanel: FC<SidePanelProps> = ({
  currentTeam,
  teamARemaining,
  teamBRemaining,
  turnHistory,
  onNewGame,
}) => {
  const { settings } = useAppState();

  const userIsRed = settings.playerTeam === 'red';
  const userTeamRemaining = userIsRed ? teamARemaining : teamBRemaining;
  const rivalTeamRemaining = userIsRed ? teamBRemaining : teamARemaining;
  const isUserTurn = userIsRed ? currentTeam === 'teamA' : currentTeam === 'teamB';
  const recentEvents = turnHistory.slice(-MAX_RECENT_EVENTS).reverse();

  return (
    <div className="w-full lg:w-80 bg-white rounded-2xl p-4 space-y-4 shadow-lg border border-gray-200">
      <CurrentTurnSection isUserTurn={isUserTurn} userIsRed={userIsRed} />

      <WordsRemainingSection
        userTeamRemaining={userTeamRemaining}
        rivalTeamRemaining={rivalTeamRemaining}
        userIsRed={userIsRed}
      />

      <TurnHistorySection events={recentEvents} userIsRed={userIsRed} />

      <ActionsSection
        userIsRed={userIsRed}
        onNewGame={onNewGame}
      />
    </div>
  );
};
