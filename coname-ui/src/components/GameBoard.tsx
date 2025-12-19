import { FC } from 'react';

import { WordCard } from './WordCard';
import { BoardState } from '../types/game';

// ============================================
// TYPES
// ============================================

export interface GameBoardProps {
  board: BoardState;
  showColors: boolean;  // Spymaster sees colors, Guesser doesn't
  isGuessing: boolean;
  selectedWords: string[];
  highlightedWord?: string;
  onWordClick: (word: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export const GameBoard: FC<GameBoardProps> = ({
  board,
  showColors,
  isGuessing,
  selectedWords,
  highlightedWord,
  onWordClick,
}) => {
  const cardElements = board.cards.map((card, index) => (
    <WordCard
      key={`${card.word}-${index}`}
      card={card}
      showColors={showColors}
      isSelectable={isGuessing && !card.revealed}
      isSelected={selectedWords.includes(card.word)}
      isHighlighted={highlightedWord === card.word}
      onClick={() => onWordClick(card.word)}
    />
  ));

  return (
    <div className="grid grid-cols-5 gap-2 md:gap-3 p-4 bg-gray-100 rounded-2xl shadow-inner">
      {cardElements}
    </div>
  );
};
