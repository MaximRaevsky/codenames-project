import { FC, useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface CountdownTimerProps {
  startTime: number;           // Unix timestamp when phase started
  durationSeconds: number;     // Total duration of the phase
  teamColor: 'red' | 'blue';   // For styling
  onTimeUp?: () => void;       // Callback when time expires
  label?: string;              // Optional label (e.g., "Clue Time", "Guess Time")
}

// ============================================
// CONSTANTS
// ============================================

const WARNING_THRESHOLD_SECONDS = 30;
const CRITICAL_THRESHOLD_SECONDS = 10;
const UPDATE_INTERVAL_MS = 1000;

// ============================================
// HELPERS
// ============================================

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getTimerClasses = (
  remaining: number,
  teamColor: 'red' | 'blue'
): { bg: string; text: string; border: string } => {
  if (remaining <= CRITICAL_THRESHOLD_SECONDS) {
    return {
      bg: 'bg-red-100',
      text: 'text-red-600',
      border: 'border-red-300',
    };
  }

  if (remaining <= WARNING_THRESHOLD_SECONDS) {
    return {
      bg: 'bg-amber-100',
      text: 'text-amber-600',
      border: 'border-amber-300',
    };
  }

  if (teamColor === 'red') {
    return {
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-200',
    };
  }

  return {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
  };
};

// ============================================
// COMPONENT
// ============================================

export const CountdownTimer: FC<CountdownTimerProps> = ({
  startTime,
  durationSeconds,
  teamColor,
  onTimeUp,
  label,
}) => {
  // Hide timer if duration is very large (no timer mode)
  if (durationSeconds > 10000) {
    return null;
  }

  const endTime = useMemo(() => startTime + durationSeconds * 1000, [startTime, durationSeconds]);
  
  const [remaining, setRemaining] = useState(() => {
    const now = Date.now();
    return Math.max(0, Math.floor((endTime - now) / 1000));
  });

  useEffect(() => {
    let hasFired = false;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const newRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setRemaining(newRemaining);

      if (newRemaining === 0 && onTimeUp && !hasFired) {
        hasFired = true;
        console.log('CountdownTimer: Time is up! Calling onTimeUp');
        onTimeUp();
        clearInterval(interval);
      }
    }, UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [endTime, onTimeUp]);

  const timerClasses = getTimerClasses(remaining, teamColor);
  const isCritical = remaining <= CRITICAL_THRESHOLD_SECONDS;
  const isWarning = remaining <= WARNING_THRESHOLD_SECONDS;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${timerClasses.bg} ${timerClasses.border}`}
    >
      {isCritical ? (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
        >
          <AlertTriangle className={`w-4 h-4 ${timerClasses.text}`} />
        </motion.div>
      ) : (
        <Clock className={`w-4 h-4 ${timerClasses.text}`} />
      )}
      
      <div className="flex flex-col">
        {label && (
          <span className="text-xs text-gray-500">{label}</span>
        )}
        <motion.span
          key={remaining}
          initial={isWarning ? { scale: 1.1 } : undefined}
          animate={{ scale: 1 }}
          className={`font-mono font-bold text-lg ${timerClasses.text}`}
        >
          {formatTime(remaining)}
        </motion.span>
      </div>
    </motion.div>
  );
};

