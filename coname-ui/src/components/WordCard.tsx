import { FC } from 'react';
import { motion } from 'framer-motion';

import { WordCard as WordCardType, CardCategory } from '../types/game';

// ============================================
// TYPES
// ============================================

export interface WordCardProps {
  card: WordCardType;
  showColors: boolean;  // true for Spymaster (sees all), false for Guesser (sees none)
  isSelectable: boolean;
  isSelected: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
}

interface CategoryStyleConfig {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

// ============================================
// CONSTANTS
// ============================================

const ANIMATION_DURATION = 0.3;

const CATEGORY_STYLES: Record<CardCategory | 'default', CategoryStyleConfig> = {
  teamA: {
    bg: 'bg-gradient-to-br from-red-400 to-red-600',
    border: 'border-red-500',
    text: 'text-white',
    dot: 'bg-red-500',
  },
  teamB: {
    bg: 'bg-gradient-to-br from-blue-400 to-blue-600',
    border: 'border-blue-500',
    text: 'text-white',
    dot: 'bg-blue-500',
  },
  neutral: {
    bg: 'bg-gradient-to-br from-amber-100 to-amber-200',
    border: 'border-amber-300',
    text: 'text-amber-900',
    dot: 'bg-amber-400',
  },
  assassin: {
    bg: 'bg-gradient-to-br from-gray-800 to-gray-900',
    border: 'border-gray-700',
    text: 'text-white',
    dot: 'bg-gray-900',
  },
  default: {
    bg: 'bg-white',
    border: 'border-gray-200',
    text: 'text-gray-800',
    dot: 'bg-gray-400',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getCategoryStyles = (category: CardCategory): CategoryStyleConfig =>
  CATEGORY_STYLES[category] || CATEGORY_STYLES.default;

const buildCardClassName = (
  isRevealed: boolean,
  showColors: boolean,
  categoryStyles: CategoryStyleConfig,
  isSelectable: boolean,
  isSelected: boolean,
  isHighlighted: boolean
): string => {
  const baseClasses = `
    relative p-3 rounded-xl border-2 min-h-[80px]
    flex items-center justify-center text-center
    transition-all duration-200 ease-out shadow-sm
  `;

  const stateClasses = getStateClasses(isRevealed, showColors, categoryStyles);
  const selectionClasses = getSelectionClasses(isSelected, isHighlighted);
  const interactionClasses = getInteractionClasses(isSelectable, isRevealed);

  return `${baseClasses} ${stateClasses} ${selectionClasses} ${interactionClasses}`.trim();
};

const getStateClasses = (
  isRevealed: boolean,
  showColors: boolean,
  categoryStyles: CategoryStyleConfig
): string => {
  if (isRevealed) {
    return `${categoryStyles.bg} ${categoryStyles.border} ${categoryStyles.text}`;
  }

  // Spymaster sees color indicators, Guesser sees plain cards
  if (showColors) {
    return `bg-white ${categoryStyles.border} border-2 text-gray-800`;
  }

  return 'bg-white border-gray-200 text-gray-800';
};

const getSelectionClasses = (isSelected: boolean, isHighlighted: boolean): string => {
  const classes: string[] = [];

  if (isSelected) {
    classes.push('ring-4 ring-blue-500 ring-opacity-80 scale-105 shadow-lg');
  }

  if (isHighlighted) {
    classes.push('ring-4 ring-yellow-400 ring-opacity-80 animate-bounce-soft');
  }

  return classes.join(' ');
};

const getInteractionClasses = (isSelectable: boolean, isRevealed: boolean): string => {
  if (!isSelectable || isRevealed) {
    return !isRevealed ? 'opacity-70' : '';
  }

  return 'hover:scale-105 hover:shadow-lg cursor-pointer hover:border-blue-400';
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface CategoryIndicatorProps {
  dotClass: string;
}

const CategoryIndicator: FC<CategoryIndicatorProps> = ({ dotClass }) => (
  <div className="absolute top-1.5 right-1.5">
    <div className={`w-3 h-3 rounded-full ${dotClass} shadow-sm`} />
  </div>
);

interface AssassinOverlayProps {
  isAssassin: boolean;
}

const AssassinOverlay: FC<AssassinOverlayProps> = ({ isAssassin }) => {
  if (!isAssassin) {
    return null;
  }

  return (
    <motion.div
      className="absolute inset-0 rounded-xl pointer-events-none flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="absolute top-1 right-1 text-xl">💀</div>
    </motion.div>
  );
};

const SelectionCheckmark: FC = () => (
  <motion.div
    className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md"
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
  >
    <span className="text-white text-xs font-bold">✓</span>
  </motion.div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const WordCard: FC<WordCardProps> = ({
  card,
  showColors,
  isSelectable,
  isSelected,
  isHighlighted = false,
  onClick,
}) => {
  const categoryStyles = getCategoryStyles(card.category);
  const isClickable = isSelectable && !card.revealed && onClick;

  const handleClick = () => {
    if (isClickable) {
      onClick();
    }
  };

  const cardClassName = buildCardClassName(
    card.revealed,
    showColors,
    categoryStyles,
    isSelectable,
    isSelected,
    isHighlighted
  );

  const hoverAnimation = isClickable ? { y: -2 } : {};
  const tapAnimation = isClickable ? { scale: 0.98 } : {};

  const shouldShowCategoryIndicator = showColors && !card.revealed;
  const shouldShowAssassinOverlay = card.revealed && card.category === 'assassin';

  return (
    <motion.div
      className={cardClassName}
      onClick={handleClick}
      whileHover={hoverAnimation}
      whileTap={tapAnimation}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ANIMATION_DURATION }}
    >
      <span className="font-mono text-sm md:text-base font-semibold">
        {card.word}
      </span>

      {shouldShowCategoryIndicator && (
        <CategoryIndicator dotClass={categoryStyles.dot} />
      )}

      {shouldShowAssassinOverlay && (
        <AssassinOverlay isAssassin={true} />
      )}

      {isSelected && <SelectionCheckmark />}
    </motion.div>
  );
};
