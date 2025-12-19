# CoName - Human-AI Teammate for Codenames

A web UI mockup for playing Codenames with an AI teammate. Built for generating screenshots and demo videos.

## Features

### 1. Welcome / Start Screen
- Game description and overview
- Role selection (Spymaster or Guesser)
- Demo mode toggle (shows board colors for screenshots)
- Autoplay rival team toggle
- Resume last game from local storage

### 2. Profile Questionnaire
- Multi-select interests
- Free-text hobbies
- Clue style preference (concise/detailed)
- Tone preference (serious/playful)
- Language preference
- All data stored locally

### 3. Main Game Screen
- 5x5 word card grid with reveal animations
- Category colors: Gold (your team), Cyan (rival), Beige (neutral), Red (assassin)
- Side panel with:
  - Current turn indicator
  - Remaining words counter
  - Turn history (last 5 events)
  - Action buttons (New Game, Reset, Export)

### 4. Gameplay Modes

**Spymaster Mode:**
- Enter clue word + number
- Clue validation (single word, not on board)
- AI teammate proposes guesses
- Approve or override AI selections

**Guesser Mode:**
- AI spymaster provides clue
- Click words to select guesses
- Confirm or undo selections
- Up to N+1 guesses allowed

### 5. Micro-Survey
- Appears every 2 turns
- Rate: Clue clarity, Trust in AI, AI understanding
- Results stored locally

### 6. History / Analytics
- Full turn timeline
- Trust over time chart
- Game statistics
- JSON export

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Zustand** for state management
- **Lucide React** for icons
- **Local Storage** for persistence

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Demo Data

Click "Load Demo Data" on the welcome screen to:
- Populate a sample user profile
- Load a partially-played game
- Enable demo mode (visible board colors)
- Add sample survey responses

This is useful for taking screenshots and recording demo videos.

## AI Stubs

The app uses deterministic stub functions instead of real AI calls:

- `aiSpymasterStub()` - Returns themed clues based on board words
- `aiGuesserStub()` - Proposes guesses based on letter matching
- `rivalTurnStub()` - Simulates rival team turns
- `validateClue()` - Checks clue validity

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── WordCard.tsx     # Individual word card
│   ├── GameBoard.tsx    # 5x5 grid
│   ├── SidePanel.tsx    # Game info sidebar
│   ├── ClueInput.tsx    # Spymaster clue form
│   ├── AIGuessPanel.tsx # AI guess review
│   ├── GuesserPanel.tsx # Guesser controls
│   ├── MicroSurvey.tsx  # Feedback modal
│   ├── GameOverModal.tsx# Win/lose modal
│   └── TrustChart.tsx   # Trust analytics
├── pages/               # Main app views
│   ├── WelcomePage.tsx
│   ├── ProfilePage.tsx
│   ├── GamePage.tsx
│   └── HistoryPage.tsx
├── hooks/               # Custom React hooks
│   ├── useGameState.ts  # Zustand store
│   └── useLocalStorage.ts
├── utils/               # Helper functions
│   ├── aiStubs.ts       # AI mock functions
│   ├── validator.ts     # Clue validation
│   └── gameLogic.ts     # Game mechanics
├── types/               # TypeScript types
│   └── game.ts
├── App.tsx              # Main app component
├── main.tsx             # React entry point
└── index.css            # Global styles
```

## Color Scheme

| Element | Color | Hex |
|---------|-------|-----|
| Your Team (A) | Gold/Amber | #f59e0b |
| Rival Team (B) | Cyan | #06b6d4 |
| Neutral | Beige/Stone | #a3a38c |
| Assassin | Red | #dc2626 |
| Background | Dark Slate | #0a0e1a |

## Local Storage Keys

- `coname-storage` - Full game state (Zustand persist)

## Export Format

The JSON export includes:
- Timestamp
- User profile
- Complete game state
- All survey responses
- Turn history with board snapshots

## Screenshots Guide

1. **Welcome Screen**: Load the app fresh
2. **Profile Page**: Click "Start New Game" without existing profile
3. **Game Board**: Use demo mode for visible colors
4. **Clue Input**: Show validation errors
5. **AI Guesses**: Submit a clue to see AI proposals
6. **Survey Modal**: Complete 2+ turns
7. **History View**: Navigate to history tab
8. **Game Over**: Reveal the assassin or win

---

Built for Human-AI Collaboration Research

