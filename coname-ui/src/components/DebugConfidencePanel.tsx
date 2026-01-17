import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, ChevronDown, ChevronUp, Eye, EyeOff, History, Zap, MessageSquare, Target, AlertCircle } from 'lucide-react';
import { GameState, Team } from '../types/game';

interface DebugConfidencePanelProps {
  game: GameState;
  userTeam: Team;
}

const SELECTION_THRESHOLD = 10; // Words above this are considered for selection
const DECAY_RATE = 0.9;

export function DebugConfidencePanel({ game, userTeam }: DebugConfidencePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRevealed, setShowRevealed] = useState(true); // Show all words by default
  const [activeTab, setActiveTab] = useState<'user' | 'rival'>('user');
  const [selectedTurn, setSelectedTurn] = useState<number | 'current'>('current');
  const [showReasoning, setShowReasoning] = useState(true);

  const rivalTeam: Team = userTeam === 'teamA' ? 'teamB' : 'teamA';
  const activeTeam = activeTab === 'user' ? userTeam : rivalTeam;

  // Get team history
  const teamHistory = useMemo(() => {
    return game.turnHistory.filter(t => t.team === activeTeam);
  }, [game.turnHistory, activeTeam]);

  // Calculate "Open Mistakes" - clueNumber minus correct guesses
  // Simple: if clue was for 2 and only 1 correct, that's 1 open mistake
  const openMistakesData = useMemo(() => {
    const mistakes: { turn: number; clue: string; expected: number; guessed: number; missed: number }[] = [];
    let totalMissed = 0;
    
    teamHistory.forEach((turn, i) => {
      const expected = turn.clueNumber;
      if (expected <= 0) return; // Skip avoidance/unlimited clues
      
      // Simple: clueNumber - correct guesses = missed words
      const correctCount = turn.guessResults.filter(r => r.correct).length;
      const missed = Math.max(0, expected - correctCount);
      
      if (missed > 0) {
        mistakes.push({
          turn: i + 1,
          clue: turn.clue,
          expected,
          guessed: correctCount,
          missed,
        });
        totalMissed += missed;
      }
    });
    
    return {
      mistakes,
      totalMissed,
      canUsePlusOne: totalMissed > 0,
      isFirstTurn: teamHistory.length === 0,
    };
  }, [teamHistory]);

  // Build word confidence data for a specific turn snapshot
  const buildTurnSnapshot = useMemo(() => {
    return (turnIndex: number | 'current') => {
      const relevantHistory = turnIndex === 'current' 
        ? teamHistory 
        : teamHistory.slice(0, turnIndex + 1);
      
      const currentTurnNumber = relevantHistory.length;
      const currentTurn = turnIndex === 'current' 
        ? (teamHistory.length > 0 ? teamHistory[teamHistory.length - 1] : null)
        : teamHistory[turnIndex];

      // Build confidence map
      const wordData: {
        word: string;
        category: string;
        isRevealed: boolean;
        wasGuessedThisTurn: boolean;
        guessResult: 'correct' | 'wrong' | 'neutral' | 'assassin' | null;
        wasIntendedTarget: boolean;
        confidenceHistory: {
          turnNumber: number;
          clue: string;
          rawConfidence: number;
          decayedConfidence: number;
          turnsAgo: number;
          decayMultiplier: number;
        }[];
        bestStoredConfidence: number;
        bestStoredClue: string;
        bestStoredTurn: number;
        currentClueConfidence: number;
        finalConfidence: number;
        source: 'current' | 'stored' | 'none';
      }[] = [];

      game.board.cards.forEach(card => {
        // Check if this word was guessed in the current/selected turn
        let wasGuessedThisTurn = false;
        let guessResult: 'correct' | 'wrong' | 'neutral' | 'assassin' | null = null;
        let wasIntendedTarget = false;

        if (currentTurn) {
          // Check if word was guessed in this turn
          const guessInfo = currentTurn.guessResults?.find(
            g => g.word.toUpperCase() === card.word.toUpperCase()
          );
          if (guessInfo) {
            wasGuessedThisTurn = true;
            if (guessInfo.category === 'assassin') guessResult = 'assassin';
            else if (guessInfo.category === 'neutral') guessResult = 'neutral';
            else guessResult = guessInfo.correct ? 'correct' : 'wrong';
          }

          // Check if word was an intended target
          wasIntendedTarget = currentTurn.intendedTargets?.some(
            t => t.toUpperCase() === card.word.toUpperCase()
          ) || false;
        }

        const entry = {
          word: card.word,
          category: card.category,
          isRevealed: card.revealed,
          wasGuessedThisTurn,
          guessResult,
          wasIntendedTarget,
          confidenceHistory: [] as any[],
          bestStoredConfidence: 0,
          bestStoredClue: '',
          bestStoredTurn: 0,
          currentClueConfidence: 0,
          finalConfidence: 0,
          source: 'none' as 'current' | 'stored' | 'none',
        };

        // Process each turn's confidence data
        relevantHistory.forEach((turn, idx) => {
          const turnNumber = idx + 1;
          const turnsAgo = currentTurnNumber - turnNumber;
          const decayMultiplier = Math.pow(DECAY_RATE, turnsAgo);

          if (turn.guesserWordConfidences) {
            const wordConf = turn.guesserWordConfidences.find(
              wc => wc.word.toUpperCase() === card.word.toUpperCase()
            );
            if (wordConf) {
              const decayed = Math.round(wordConf.confidence * decayMultiplier);
              entry.confidenceHistory.push({
                turnNumber,
                clue: turn.clue,
                rawConfidence: wordConf.confidence,
                decayedConfidence: decayed,
                turnsAgo,
                decayMultiplier,
              });

              // Track best stored confidence
              if (turnsAgo > 0 && decayed > entry.bestStoredConfidence) {
                entry.bestStoredConfidence = decayed;
                entry.bestStoredClue = turn.clue;
                entry.bestStoredTurn = turnNumber;
              }
            }
          }
        });

        // Current turn confidence (no decay) - from historical turn data
        if (currentTurn?.guesserWordConfidences) {
          const wordConf = currentTurn.guesserWordConfidences.find(
            wc => wc.word.toUpperCase() === card.word.toUpperCase()
          );
          if (wordConf) {
            entry.currentClueConfidence = wordConf.confidence;
          }
        }

        // LIVE current clue confidence - ONLY when:
        // 1. Viewing 'current' state
        // 2. Live data exists
        // 3. It IS this team's turn (activeTeam matches currentTeam)
        // 4. There's an ACTIVE clue for this team (prevents showing stale data from previous turn)
        const isThisTeamsTurn = game.currentTeam === activeTeam;
        const hasActiveClueForThisTeam = game.currentClue && game.currentTeam === activeTeam;
        if (turnIndex === 'current' && game.aiGuesserWordConfidences && isThisTeamsTurn && hasActiveClueForThisTeam) {
          const wordConf = game.aiGuesserWordConfidences.find(
            wc => wc.word.toUpperCase() === card.word.toUpperCase()
          );
          if (wordConf) {
            entry.currentClueConfidence = wordConf.confidence;
          }
        }

        // Calculate final confidence (take higher of current vs stored)
        if (entry.currentClueConfidence > entry.bestStoredConfidence) {
          entry.finalConfidence = entry.currentClueConfidence;
          entry.source = 'current';
        } else if (entry.bestStoredConfidence > 0) {
          entry.finalConfidence = entry.bestStoredConfidence;
          entry.source = 'stored';
        } else {
          entry.finalConfidence = entry.currentClueConfidence;
          entry.source = entry.currentClueConfidence > 0 ? 'current' : 'none';
        }

        wordData.push(entry);
      });

      return {
        turnNumber: currentTurnNumber,
        turn: currentTurn,
        words: wordData.sort((a, b) => b.finalConfidence - a.finalConfidence),
      };
    };
  }, [teamHistory, game.board.cards, game.aiGuesserWordConfidences, activeTab, activeTeam, game.turnHistory]);

  const snapshot = useMemo(() => buildTurnSnapshot(selectedTurn), [buildTurnSnapshot, selectedTurn]);

  // Filter data
  const displayData = useMemo(() => {
    let data = snapshot.words;
    if (!showRevealed) {
      data = data.filter(d => !d.isRevealed);
    }
    return data;
  }, [snapshot.words, showRevealed]);

  const userTeamName = userTeam === 'teamA' ? 'Red (You + AI)' : 'Blue (You + AI)';
  const rivalTeamName = rivalTeam === 'teamA' ? 'Red (Rival AI)' : 'Blue (Rival AI)';

  const getCategoryBadge = (category: string) => {
    const styles: Record<string, string> = {
      teamA: 'bg-red-500/30 text-red-300',
      teamB: 'bg-blue-500/30 text-blue-300',
      assassin: 'bg-gray-600 text-white',
      neutral: 'bg-yellow-500/30 text-yellow-300',
    };
    const labels: Record<string, string> = {
      teamA: 'RED',
      teamB: 'BLUE',
      assassin: '💀',
      neutral: 'NEU',
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${styles[category] || ''}`}>
        {labels[category] || category}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900 rounded-2xl shadow-xl border border-gray-700 overflow-hidden font-mono text-xs"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-800 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-bold">DEBUG: AI Confidence Tracker</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {/* Team Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => { setActiveTab('user'); setSelectedTurn('current'); }}
                className={`flex-1 px-3 py-1.5 text-xs font-medium ${
                  activeTab === 'user' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                {userTeamName}
              </button>
              <button
                onClick={() => { setActiveTab('rival'); setSelectedTurn('current'); }}
                className={`flex-1 px-3 py-1.5 text-xs font-medium ${
                  activeTab === 'rival' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                {rivalTeamName} 🔍
              </button>
            </div>

            {/* Turn Selector */}
            <div className="px-3 py-2 bg-gray-850 border-b border-gray-700 flex items-center gap-2 flex-wrap">
              <History className="w-3 h-3 text-gray-400" />
              <span className="text-gray-400">View Turn:</span>
              <button
                onClick={() => setSelectedTurn('current')}
                className={`px-2 py-0.5 rounded ${
                  selectedTurn === 'current' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Current
              </button>
              {teamHistory.map((turn, idx) => (
                <button
                  key={turn.id}
                  onClick={() => setSelectedTurn(idx)}
                  className={`px-2 py-0.5 rounded ${
                    selectedTurn === idx ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  T{idx + 1}: "{turn.clue}" {turn.clueNumber}
                </button>
              ))}
              {teamHistory.length === 0 && (
                <span className="text-gray-500">No turns yet</span>
              )}

              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className={`flex items-center gap-1 ${showReasoning ? 'text-blue-400' : 'text-gray-500'} hover:text-white`}
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>{showReasoning ? 'Hide' : 'Show'} reasoning</span>
                </button>
                <button
                  onClick={() => setShowRevealed(!showRevealed)}
                  className="flex items-center gap-1 text-gray-400 hover:text-white"
                >
                  {showRevealed ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{showRevealed ? 'Hide' : 'Show'} revealed</span>
                </button>
              </div>
            </div>

            {/* Current Clue Info */}
            {snapshot.turn && (
              <div className="px-3 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-400">Clue:</span>
                  <span className="text-white font-bold">"{snapshot.turn.clue}"</span>
                  <span className="text-yellow-400">for {snapshot.turn.clueNumber}</span>
                  {snapshot.turn.intendedTargets && snapshot.turn.intendedTargets.length > 0 && (
                    <>
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-400">Targets:</span>
                      <span className="text-green-400">{snapshot.turn.intendedTargets.join(', ')}</span>
                    </>
                  )}
                  {snapshot.turn.guessResults && snapshot.turn.guessResults.length > 0 && (
                    <>
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-400">Guessed:</span>
                      {snapshot.turn.guessResults.map((g, i) => (
                        <span key={i} className={g.correct ? 'text-green-400' : 'text-red-400'}>
                          {g.word}{i < snapshot.turn!.guessResults.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Live Current Clue (when viewing current AND it's this team's turn) */}
            {selectedTurn === 'current' && game.currentClue && game.currentTeam === activeTeam && (
              <div className="px-3 py-2 bg-green-900/30 border-b border-green-700">
                <div className="flex flex-wrap items-center gap-2">
                  <Zap className="w-3 h-3 text-green-400" />
                  <span className="text-green-400">LIVE (this team's turn):</span>
                  <span className="text-white font-bold">"{game.currentClue.word}"</span>
                  <span className="text-yellow-400">for {game.currentClue.number}</span>
                  {game.currentClue.intendedTargets && (
                    <>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-300">{game.currentClue.intendedTargets.join(', ')}</span>
                    </>
                  )}
                </div>
                {/* Spymaster Reasoning */}
                {showReasoning && game.currentClue.reasoning && (
                  <div className="mt-2 p-2 bg-gray-800/60 rounded text-[10px]">
                    <div className="flex items-start gap-1">
                      <Target className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-cyan-400 font-bold">Spymaster Reasoning: </span>
                        <span className="text-gray-300">{game.currentClue.reasoning}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* +1 Rule Status & Open Mistakes */}
            {selectedTurn === 'current' && (
              <div className={`px-3 py-2 border-b ${openMistakesData.canUsePlusOne ? 'bg-purple-900/30 border-purple-700' : 'bg-gray-800/50 border-gray-700'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <AlertCircle className={`w-3 h-3 ${openMistakesData.canUsePlusOne ? 'text-purple-400' : 'text-gray-500'}`} />
                  <span className={`font-bold ${openMistakesData.canUsePlusOne ? 'text-purple-400' : 'text-gray-500'}`}>
                    +1 Rule:
                  </span>
                  {openMistakesData.isFirstTurn ? (
                    <span className="text-gray-500">First turn - NO +1 available</span>
                  ) : openMistakesData.canUsePlusOne ? (
                    <>
                      <span className="text-purple-300">
                        {openMistakesData.totalMissed} open mistake{openMistakesData.totalMissed > 1 ? 's' : ''} → +1 AVAILABLE!
                      </span>
                      <span className="text-gray-500">|</span>
                      <span className="text-[10px] text-gray-400">
                        {openMistakesData.mistakes.map(m => 
                          `T${m.turn} "${m.clue}" (${m.guessed}/${m.expected})`
                        ).join(', ')}
                      </span>
                    </>
                  ) : (
                    <span className="text-green-400">✓ All previous words found - NO +1 available</span>
                  )}
                </div>
              </div>
            )}

            {/* AI Guesser Reasoning (live) */}
            {selectedTurn === 'current' && showReasoning && game.aiGuesserReasoning && game.currentTeam === activeTeam && (
              <div className="px-3 py-2 bg-blue-900/30 border-b border-blue-700">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-[10px]">
                    <span className="text-blue-400 font-bold">AI Guesser Reasoning: </span>
                    <span className="text-gray-300">{game.aiGuesserReasoning}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Turn Reasoning (when viewing past turns) */}
            {selectedTurn !== 'current' && showReasoning && snapshot.turn && (
              <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700 space-y-2">
                {snapshot.turn.spymasterReasoning && (
                  <div className="flex items-start gap-2 text-[10px]">
                    <Target className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-cyan-400 font-bold">Spymaster: </span>
                      <span className="text-gray-300">{snapshot.turn.spymasterReasoning}</span>
                    </div>
                  </div>
                )}
                {snapshot.turn.guesserReasoning && (
                  <div className="flex items-start gap-2 text-[10px]">
                    <MessageSquare className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-blue-400 font-bold">Guesser: </span>
                      <span className="text-gray-300">{snapshot.turn.guesserReasoning}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Show info when viewing rival tab */}
            {activeTab === 'rival' && (
              <div className="px-3 py-2 bg-red-900/30 border-b border-red-700">
                <div className="flex items-center gap-2 text-red-300 text-[10px]">
                  <span>🔍 DEBUG VIEW: Showing rival AI's confidence data and intended targets</span>
                </div>
              </div>
            )}
            
            {/* Show info when it's not the active team's turn */}
            {selectedTurn === 'current' && game.currentClue && game.currentTeam !== activeTeam && (
              <div className="px-3 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2 text-gray-400 text-[10px]">
                  <span>ℹ️ Currently {game.currentTeam === userTeam ? 'your' : "rival's"} turn - viewing {activeTab === 'user' ? 'your' : "rival's"} historical data</span>
                </div>
              </div>
            )}

            {/* Info Bar */}
            <div className="px-3 py-1 bg-gray-850 border-b border-gray-700 text-[10px] text-gray-500">
              <span className="text-yellow-400">Selection threshold: ≥{SELECTION_THRESHOLD}%</span>
              <span className="mx-2">|</span>
              <span>Decay: {DECAY_RATE}^turnsAgo</span>
            </div>

            {/* Table */}
            <div className="max-h-[450px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-800 sticky top-0 z-10">
                  <tr className="text-gray-400 text-[10px]">
                    <th className="px-2 py-1 text-left w-6">#</th>
                    <th className="px-2 py-1 text-left">Word</th>
                    <th className="px-2 py-1 text-left w-12">Cat</th>
                    <th className="px-2 py-1 text-left w-20">This Turn</th>
                    <th className="px-2 py-1 text-left w-16">Final %</th>
                    <th className="px-2 py-1 text-left">Current Clue</th>
                    <th className="px-2 py-1 text-left">Best Stored</th>
                    <th className="px-2 py-1 text-left">All History</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((item, index) => {
                    const isSelectable = item.finalConfidence >= SELECTION_THRESHOLD;
                    
                    // Row styling based on what happened
                    let rowBg = '';
                    if (item.wasGuessedThisTurn) {
                      if (item.guessResult === 'correct') rowBg = 'bg-green-900/40 border-l-4 border-l-green-500';
                      else if (item.guessResult === 'wrong') rowBg = 'bg-red-900/40 border-l-4 border-l-red-500';
                      else if (item.guessResult === 'neutral') rowBg = 'bg-yellow-900/40 border-l-4 border-l-yellow-500';
                      else if (item.guessResult === 'assassin') rowBg = 'bg-gray-900 border-l-4 border-l-gray-500';
                    } else if (item.wasIntendedTarget) {
                      rowBg = 'bg-cyan-900/30 border-l-4 border-l-cyan-500';
                    } else if (item.isRevealed) {
                      rowBg = 'bg-gray-900/50 opacity-60';
                    }
                    
                    return (
                      <tr key={item.word} className={`${rowBg} border-b border-gray-800 hover:bg-gray-800`}>
                        <td className="px-2 py-1.5 text-gray-500">{index + 1}</td>
                        <td className="px-2 py-1.5 text-white font-medium">
                          <div className="flex items-center gap-1">
                            {item.word}
                            {item.wasIntendedTarget && <span className="text-cyan-400 text-[10px]">🎯</span>}
                            {item.isRevealed && !item.wasGuessedThisTurn && <span className="text-gray-500 text-[10px]">(revealed)</span>}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">{getCategoryBadge(item.category)}</td>
                        <td className="px-2 py-1.5">
                          {item.wasGuessedThisTurn ? (
                            <span className={`font-bold ${
                              item.guessResult === 'correct' ? 'text-green-400' :
                              item.guessResult === 'wrong' ? 'text-red-400' :
                              item.guessResult === 'neutral' ? 'text-yellow-400' :
                              'text-gray-400'
                            }`}>
                              {item.guessResult === 'correct' ? '✓ CORRECT' :
                               item.guessResult === 'wrong' ? '✗ WRONG' :
                               item.guessResult === 'neutral' ? '○ NEUTRAL' :
                               '💀 ASSASSIN'}
                            </span>
                          ) : item.wasIntendedTarget ? (
                            <span className="text-cyan-400">🎯 TARGET</span>
                          ) : isSelectable ? (
                            <span className="text-green-400">≥{SELECTION_THRESHOLD}%</span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={item.finalConfidence >= SELECTION_THRESHOLD ? 'text-green-400 font-bold' : 'text-gray-400'}>
                            {item.finalConfidence}%
                            {item.source === 'stored' && <span className="text-purple-400 ml-1">↺</span>}
                            {item.source === 'current' && <span className="text-blue-400 ml-1">⚡</span>}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          {item.currentClueConfidence > 0 ? (
                            <span className={item.source === 'current' ? 'text-blue-400 font-bold' : 'text-gray-500'}>
                              {item.currentClueConfidence}%
                            </span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {item.bestStoredConfidence > 0 ? (
                            <span className={item.source === 'stored' ? 'text-purple-400 font-bold' : 'text-gray-500'}>
                              {item.bestStoredConfidence}% 
                              <span className="text-gray-500 ml-1 text-[9px]">
                                "{item.bestStoredClue}"
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {item.confidenceHistory.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.confidenceHistory.map((h, i) => (
                                <span key={i} className="bg-gray-700 px-1 py-0.5 rounded text-[9px]">
                                  <span className="text-yellow-400">T{h.turnNumber}</span>
                                  <span className="text-white mx-0.5">{h.rawConfidence}%</span>
                                  {h.turnsAgo > 0 && (
                                    <span className="text-purple-400">→{h.decayedConfidence}%</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="px-3 py-2 bg-gray-850 border-t border-gray-700 flex flex-wrap gap-3 text-[10px]">
              <span className="text-gray-400">Row colors:</span>
              <span className="text-green-400">✓ Correct guess</span>
              <span className="text-red-400">✗ Wrong guess</span>
              <span className="text-yellow-400">○ Neutral</span>
              <span className="text-cyan-400">🎯 Intended target</span>
              <span className="text-gray-400">|</span>
              <span className="text-blue-400">⚡ From current clue</span>
              <span className="text-purple-400">↺ From stored</span>
            </div>

            {/* Formula Reference */}
            <div className="px-3 py-2 bg-gray-800 border-t border-gray-700 text-[10px] text-gray-500">
              <span className="text-gray-400">Formula:</span>{' '}
              <span className="text-green-400">final</span> = max(
              <span className="text-blue-400">current_clue_conf</span>, 
              <span className="text-purple-400">best_stored</span>)
              <span className="mx-2">|</span>
              <span className="text-purple-400">stored</span> = 
              <span className="text-white">raw</span> × {DECAY_RATE}^<span className="text-yellow-400">turns_ago</span>
              <span className="mx-2">|</span>
              <span className="text-green-400">↺</span> = using stored value
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default DebugConfidencePanel;
