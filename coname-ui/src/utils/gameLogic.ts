import { BoardState, WordCard, CardCategory, Team, TurnEvent } from '../types/game';

// Official Codenames word bank (400 words)
const WORD_BANK = [
  'AFRICA', 'AGENT', 'AIR', 'ALIEN', 'ALPS', 'AMAZON', 'AMBULANCE', 'AMERICA',
  'ANGEL', 'ANTARCTICA', 'APPLE', 'ARM', 'ATLANTIS', 'AUSTRALIA', 'AZTEC',
  'BACK', 'BALL', 'BAND', 'BANK', 'BAR', 'BARK', 'BAT', 'BATTERY', 'BEACH',
  'BEAR', 'BEAT', 'BED', 'BEIJING', 'BELL', 'BELT', 'BERLIN', 'BERMUDA', 'BERRY',
  'BILL', 'BLOCK', 'BOARD', 'BOLT', 'BOMB', 'BOND', 'BOOM', 'BOOT', 'BOTTLE',
  'BOW', 'BOX', 'BRIDGE', 'BRUSH', 'BUCK', 'BUFFALO', 'BUG', 'BUGLE', 'BUTTON',
  'CALF', 'CANADA', 'CAP', 'CAPITAL', 'CAR', 'CARD', 'CARROT', 'CASINO', 'CAST',
  'CAT', 'CELL', 'CENTAUR', 'CENTER', 'CHAIR', 'CHANGE', 'CHARGE', 'CHECK',
  'CHEST', 'CHICK', 'CHINA', 'CHOCOLATE', 'CHURCH', 'CIRCLE', 'CLIFF', 'CLOAK',
  'CLUB', 'CODE', 'COLD', 'COMIC', 'COMPOUND', 'CONCERT', 'CONDUCTOR', 'CONTRACT',
  'COOK', 'COPPER', 'COTTON', 'COURT', 'COVER', 'CRANE', 'CRASH', 'CRICKET',
  'CROSS', 'CROWN', 'CYCLE', 'CZECH', 'DANCE', 'DATE', 'DAY', 'DEATH', 'DECK',
  'DEGREE', 'DIAMOND', 'DICE', 'DINOSAUR', 'DISEASE', 'DOCTOR', 'DOG', 'DRAFT',
  'DRAGON', 'DRESS', 'DRILL', 'DROP', 'DUCK', 'DWARF', 'EAGLE', 'EGYPT', 'EMBASSY',
  'ENGINE', 'ENGLAND', 'EUROPE', 'EYE', 'FACE', 'FAIR', 'FALL', 'FAN', 'FENCE',
  'FIELD', 'FIGHTER', 'FIGURE', 'FILE', 'FILM', 'FIRE', 'FISH', 'FLUTE', 'FLY',
  'FOOT', 'FORCE', 'FOREST', 'FORK', 'FRANCE', 'GAME', 'GAS', 'GENIUS', 'GERMANY',
  'GHOST', 'GIANT', 'GLASS', 'GLOVE', 'GOLD', 'GRACE', 'GRASS', 'GREECE', 'GREEN',
  'GROUND', 'HAM', 'HAND', 'HAWK', 'HEAD', 'HEART', 'HELICOPTER', 'HIMALAYAS',
  'HOLE', 'HOLLYWOOD', 'HONEY', 'HOOD', 'HOOK', 'HORN', 'HORSE', 'HORSESHOE',
  'HOSPITAL', 'HOTEL', 'ICE', 'ICE CREAM', 'INDIA', 'IRON', 'IVORY', 'JACK',
  'JAM', 'JET', 'JUPITER', 'KANGAROO', 'KETCHUP', 'KEY', 'KID', 'KING', 'KIWI',
  'KNIFE', 'KNIGHT', 'LAB', 'LAP', 'LASER', 'LAWYER', 'LEAD', 'LEMON', 'LEPRECHAUN',
  'LIFE', 'LIGHT', 'LIMOUSINE', 'LINE', 'LINK', 'LION', 'LITTER', 'LOCH NESS',
  'LOCK', 'LOG', 'LONDON', 'LUCK', 'MAIL', 'MAMMOTH', 'MAPLE', 'MARBLE', 'MARCH',
  'MASS', 'MATCH', 'MERCURY', 'MEXICO', 'MICROSCOPE', 'MILLIONAIRE', 'MINE',
  'MINT', 'MISSILE', 'MODEL', 'MOLE', 'MOON', 'MOSCOW', 'MOUNT', 'MOUSE', 'MOUTH',
  'MUG', 'NAIL', 'NEEDLE', 'NET', 'NEW YORK', 'NIGHT', 'NINJA', 'NOTE', 'NOVEL',
  'NURSE', 'NUT', 'OCTOPUS', 'OIL', 'OLIVE', 'OLYMPUS', 'OPERA', 'ORANGE', 'ORGAN',
  'PALM', 'PAN', 'PANTS', 'PAPER', 'PARACHUTE', 'PARK', 'PART', 'PASS', 'PASTE',
  'PENGUIN', 'PHOENIX', 'PIANO', 'PIE', 'PILOT', 'PIN', 'PIPE', 'PIRATE', 'PISTOL',
  'PIT', 'PITCH', 'PLANE', 'PLASTIC', 'PLATE', 'PLATYPUS', 'PLAY', 'PLOT', 'POINT',
  'POISON', 'POLE', 'POLICE', 'POOL', 'PORT', 'POST', 'POUND', 'PRESS', 'PRINCESS',
  'PUMPKIN', 'PUPIL', 'PYRAMID', 'QUEEN', 'RABBIT', 'RACKET', 'RAY', 'REVOLUTION',
  'RING', 'ROBIN', 'ROBOT', 'ROCK', 'ROME', 'ROOT', 'ROSE', 'ROULETTE', 'ROUND',
  'ROW', 'RULER', 'SATELLITE', 'SATURN', 'SCALE', 'SCHOOL', 'SCIENTIST', 'SCORPION',
  'SCREEN', 'SCUBA DIVER', 'SEAL', 'SERVER', 'SHADOW', 'SHAKESPEARE', 'SHARK',
  'SHIP', 'SHOE', 'SHOP', 'SHOT', 'SINK', 'SKYSCRAPER', 'SLIP', 'SLUG', 'SMUGGLER',
  'SNOW', 'SNOWMAN', 'SOCK', 'SOLDIER', 'SOUL', 'SOUND', 'SPACE', 'SPELL', 'SPIDER',
  'SPIKE', 'SPINE', 'SPOT', 'SPRING', 'SPY', 'SQUARE', 'STADIUM', 'STAFF', 'STAR',
  'STATE', 'STICK', 'STOCK', 'STRAW', 'STREAM', 'STRIKE', 'STRING', 'SUB', 'SUIT',
  'SUPERHERO', 'SWING', 'SWITCH', 'TABLE', 'TABLET', 'TAG', 'TAIL', 'TAP', 'TEACHER',
  'TELESCOPE', 'TEMPLE', 'THEATER', 'THIEF', 'THUMB', 'TICK', 'TIE', 'TIME', 'TOKYO',
  'TOOTH', 'TORCH', 'TOWER', 'TRACK', 'TRAIN', 'TRIANGLE', 'TRIP', 'TRUNK', 'TUBE',
  'TURKEY', 'UNDERTAKER', 'UNICORN', 'VACUUM', 'VAN', 'VET', 'WAKE', 'WALL', 'WAR',
  'WASHER', 'WASHINGTON', 'WATCH', 'WATER', 'WAVE', 'WEB', 'WELL', 'WHALE', 'WHIP',
  'WIND', 'WITCH', 'WORM', 'YARD'
];

// Shuffle array using Fisher-Yates
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Generate a new game board
export function generateBoard(startingTeam: Team = 'teamA'): BoardState {
  // Pick 25 random words from the word bank
  const shuffledWords = shuffle(WORD_BANK).slice(0, 25);
  
  // Assign categories: 9 for starting team, 8 for other, 7 neutral, 1 assassin
  const categories: CardCategory[] = [
    ...Array(startingTeam === 'teamA' ? 9 : 8).fill('teamA'),
    ...Array(startingTeam === 'teamA' ? 8 : 9).fill('teamB'),
    ...Array(7).fill('neutral'),
    'assassin',
  ];
  
  const shuffledCategories = shuffle(categories);
  
  const cards: WordCard[] = shuffledWords.map((word, i) => ({
    word,
    category: shuffledCategories[i],
    revealed: false,
  }));

  return {
    cards,
    teamARemaining: startingTeam === 'teamA' ? 9 : 8,
    teamBRemaining: startingTeam === 'teamA' ? 8 : 9,
  };
}

// Reveal a card and update counts
export function revealCard(
  board: BoardState,
  word: string,
  team: Team
): { 
  newBoard: BoardState; 
  result: 'correct' | 'wrong' | 'neutral' | 'assassin';
  category: CardCategory;
} {
  const cardIndex = board.cards.findIndex(
    c => c.word.toUpperCase() === word.toUpperCase()
  );
  
  if (cardIndex === -1) {
    throw new Error(`Word "${word}" not found on board`);
  }

  const card = board.cards[cardIndex];
  
  if (card.revealed) {
    throw new Error(`Word "${word}" is already revealed`);
  }

  const newCards = [...board.cards];
  newCards[cardIndex] = { ...card, revealed: true, selectedBy: team };

  let newTeamARemaining = board.teamARemaining;
  let newTeamBRemaining = board.teamBRemaining;
  let result: 'correct' | 'wrong' | 'neutral' | 'assassin';

  switch (card.category) {
    case 'teamA':
      newTeamARemaining--;
      result = team === 'teamA' ? 'correct' : 'wrong';
      break;
    case 'teamB':
      newTeamBRemaining--;
      result = team === 'teamB' ? 'correct' : 'wrong';
      break;
    case 'neutral':
      result = 'neutral';
      break;
    case 'assassin':
      result = 'assassin';
      break;
  }

  return {
    newBoard: {
      cards: newCards,
      teamARemaining: newTeamARemaining,
      teamBRemaining: newTeamBRemaining,
    },
    result,
    category: card.category,
  };
}

// Check for game over conditions
export function checkGameOver(board: BoardState): { 
  gameOver: boolean; 
  winner?: Team; 
  reason?: string;
} {
  // Check if assassin was revealed
  const assassinCard = board.cards.find(c => c.category === 'assassin');
  if (assassinCard?.revealed) {
    const loser = assassinCard.selectedBy;
    return {
      gameOver: true,
      winner: loser === 'teamA' ? 'teamB' : 'teamA',
      reason: `${loser === 'teamA' ? 'Red Team' : 'Blue Team'} found the assassin!`,
    };
  }

  // Check if a team has won by finding all their words
  if (board.teamARemaining === 0) {
    return {
      gameOver: true,
      winner: 'teamA',
      reason: 'Red Team found all their words!',
    };
  }

  if (board.teamBRemaining === 0) {
    return {
      gameOver: true,
      winner: 'teamB',
      reason: 'Blue Team found all their words!',
    };
  }

  return { gameOver: false };
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create turn event
export function createTurnEvent(
  team: Team,
  role: 'spymaster' | 'guesser',
  clue: string,
  clueNumber: number,
  guesses: string[],
  guessResults: { word: string; correct: boolean; category: CardCategory }[],
  teamARemaining: number,
  teamBRemaining: number,
  intendedTargets?: string[],
  spymasterReasoning?: string,
  guesserReasoning?: string,
  guesserWordConfidences?: { word: string; confidence: number }[],
  guesserWordExplanations?: Record<string, string>
): TurnEvent {
  return {
    id: generateId(),
    timestamp: Date.now(),
    team,
    role,
    clue,
    clueNumber,
    guesses,
    guessResults,
    teamARemaining,
    teamBRemaining,
    intendedTargets,
    spymasterReasoning,
    guesserReasoning,
    guesserWordConfidences,
    guesserWordExplanations,
  };
}

