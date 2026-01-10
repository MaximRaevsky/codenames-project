# CoName - Human-AI Collaboration in Codenames

A research platform for studying Human-AI collaboration through the board game Codenames. Players team up with an AI partner (GPT-4o) to play against an AI opponent team.

## Research Features

- **Adaptive AI Learning**: AI learns user play patterns through an LLM-generated summary updated after each game
- **User Profiling**: Captures demographics, interests, and problem-solving approach
- **Post-Game Feedback**: Micro-surveys collect trust, clarity, and satisfaction ratings
- **Metrics Dashboard**: Tracks trust evolution and performance over games
- **Game Logging**: Full turn history with AI reasoning and intended targets

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 18.x or higher |
| npm | 9.x or higher |
| OpenAI API Key | GPT-4o-mini access |

**Get OpenAI API Key**: https://platform.openai.com/api-keys

---

## Setup

```bash
# 1. Install dependencies
cd coname-ui
npm install

# 2. Configure API key
cp .env.example .env
```

Edit `.env` and add your OpenAI key:

```env
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

```bash
# 3. Start the application
npm run dev
```

Open http://localhost:5173

---

## Project Structure

```
coname-ui/src/
├── pages/
│   ├── WelcomePage.tsx      # Home & game setup
│   ├── ProfilePage.tsx      # User profile & AI summary display
│   ├── GamePage.tsx         # Main game interface
│   └── MetricsPage.tsx      # Performance analytics
│
├── components/              # UI components (board, cards, modals, etc.)
│
├── utils/
│   ├── ai-agents.ts         # AI Spymaster & Guesser logic
│   ├── openai-client.ts     # OpenAI API communication
│   ├── prompt-builders.ts   # AI prompt construction
│   ├── summaryAgent.ts      # User learning summary generation
│   ├── userDatabase.ts      # LocalStorage user data management
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

All data is stored in browser **localStorage**:

| Key | Contents |
|-----|----------|
| `coname-users` | User profiles, AI learning summaries, summary history |
| `coname-game-state` | Active game state, turn history, survey responses |

---

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + Framer Motion
- Zustand (state management)
- OpenAI GPT-4o-mini API

---

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview build
```
