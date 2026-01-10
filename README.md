# CoName - Human-AI Collaboration in Codenames

A web application for playing Codenames with an AI teammate. Built for researching Human-AI collaboration, trust, and adaptive learning.

## Overview

Team up with an AI partner to play Codenames against an AI opponent team. Choose your role:

| Role | You Do | AI Does |
|------|--------|---------|
| **Spymaster** | See all colors, give one-word clues | Guess words based on your clues |
| **Guesser** | Guess words based on clues | See all colors, give you clues |

**Game Goal**: Find all your team's words (9 or 8) before the rival team. Avoid the Assassin (instant loss).

---

## Features

### For Players
- Play Codenames with an intelligent AI teammate
- Choose team color (Red/Blue) and role (Spymaster/Guesser)
- Configurable turn timer (1-5 minutes or unlimited)
- Game state saved automatically (resume anytime)

### For Research
- **Adaptive AI Learning**: AI learns your play patterns via LLM-generated summaries updated after each game
- **User Profiling**: Collects demographics, interests, and cognitive style
- **Post-Game Feedback**: Surveys capture trust, clarity, and satisfaction ratings
- **Metrics Dashboard**: Visualizes trust evolution and performance trends
- **Full Logging**: Turn history with AI reasoning, intended targets, and confidence scores

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 18.x or higher |
| npm | 9.x or higher |
| OpenAI API Key | GPT-4o-mini access |

**Get OpenAI API Key**: https://platform.openai.com/api-keys  
**Estimated Cost**: ~$0.01-0.05 per game

---

## Setup

```bash
# 1. Clone and install
cd coname-ui
npm install

# 2. Configure API key
cp .env.example .env
```

Edit `.env`:
```env
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

```bash
# 3. Run
npm run dev
```

Open **http://localhost:5173**

---

## How to Play

1. **Create Profile**: Enter email and optional info (helps AI personalize clues)
2. **Select Team & Role**: Choose Red/Blue and Spymaster/Guesser
3. **Set Timer**: Choose turn duration (or unlimited)
4. **Play**: 
   - As **Spymaster**: Give one-word clues + number of related words
   - As **Guesser**: Click words that match the AI's clue
5. **Feedback**: Rate the AI after the game ends

### Clue Rules
- Single word only
- Cannot be a word on the board (or part of one)
- Number indicates how many words relate to the clue
- Guesser can guess up to (number + 1) words

---

## Project Structure

```
coname-ui/src/
├── pages/
│   ├── WelcomePage.tsx      # Home & game setup
│   ├── ProfilePage.tsx      # User profile & AI summary
│   ├── GamePage.tsx         # Main game interface
│   └── MetricsPage.tsx      # Performance analytics
│
├── components/              # UI components (board, cards, modals)
│
├── utils/
│   ├── ai-agents.ts         # AI Spymaster & Guesser logic
│   ├── openai-client.ts     # OpenAI API wrapper
│   ├── prompt-builders.ts   # AI prompt construction
│   ├── summaryAgent.ts      # User learning summary generation
│   ├── userDatabase.ts      # LocalStorage user management
│   └── gameLogic.ts         # Core game mechanics
│
├── hooks/
│   └── useGameState.ts      # Zustand state management
│
└── types/
    └── game.ts              # TypeScript interfaces
```

---

## Data Storage

All data stored in browser **localStorage**:

| Key | Contents |
|-----|----------|
| `coname-users` | User profiles, AI learning summaries, summary update history |
| `coname-game-state` | Game state, turn history, survey responses |

### Accessing Data
```javascript
// In browser console
JSON.parse(localStorage.getItem('coname-users'))
JSON.parse(localStorage.getItem('coname-game-state'))
```

---

## Configuration

### AI Model
Default: `gpt-4o-mini`. To change, edit `src/utils/openai-client.ts`:
```typescript
const MODEL = 'gpt-4o'; // For better performance (higher cost)
```

### Timer Options
Set on Welcome page: ∞ (unlimited), 1, 2, 3, or 5 minutes per turn.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 + TypeScript | UI framework |
| Vite | Build tool |
| Tailwind CSS | Styling |
| Framer Motion | Animations |
| Zustand | State management |
| OpenAI API | AI agents (GPT-4o-mini) |

---

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```
