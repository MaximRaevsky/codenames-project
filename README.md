# CoName - Human-AI Collaboration in Codenames

A web application for playing Codenames with an AI teammate. Built for researching Human-AI collaboration, trust, and adaptive learning.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [How to Play](#how-to-play)
- [Data Storage](#data-storage)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Troubleshooting](#troubleshooting)

---

## Overview

Team up with an AI partner to play Codenames against an AI opponent team. Choose your role:

| Role | You Do | AI Does |
|------|--------|---------|
| **Spymaster** | See all card colors, give one-word clues | Guess words based on your clues |
| **Guesser** | Guess words based on clues | See all card colors, give you clues |

**Game Goal**: Find all your team's words (9 or 8) before the rival team. Avoid the Assassin word (instant loss).

---

## Features

### For Players
- Play Codenames with an intelligent AI teammate
- Choose team color (Red/Blue) and role (Spymaster/Guesser)
- Configurable turn timer (1-5 minutes or unlimited)
- Game state saved automatically (resume anytime)
- Beautiful, responsive UI

### For Research
- **Adaptive AI Learning**: AI learns your play patterns via LLM-generated summaries updated after each game
- **User Profiling**: Collects demographics, interests, and cognitive style preferences
- **Post-Game Feedback**: Surveys capture trust, clarity, and satisfaction ratings (1-7 scale)
- **Metrics Dashboard**: Visualizes trust evolution and performance trends over time
- **Full Logging**: Complete turn history with AI reasoning, intended targets, and confidence scores

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Minimum Version | Check Command |
|-------------|-----------------|---------------|
| **Node.js** | 18.x or higher | `node --version` |
| **npm** | 9.x or higher | `npm --version` |
| **Git** | Any recent version | `git --version` |

### OpenAI API Key (Required)

The game uses OpenAI's GPT-4o-mini model for AI agents. You need an API key:

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign up or log in to your OpenAI account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. **Important**: Ensure your account has billing set up and credits available

---

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd "Codenames Project"
```

### Step 2: Install Dependencies

Navigate to the UI directory and install all required packages:

```bash
cd coname-ui
npm install
```

This will install React, TypeScript, Tailwind CSS, and other dependencies (~100MB).

### Step 3: Configure Environment Variables

Create your environment file from the example template:

```bash
cp .env.example .env
```

Open the `.env` file in a text editor and add your OpenAI API key:

```env
# OpenAI API Key (REQUIRED)
# Get yours at: https://platform.openai.com/api-keys
VITE_OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Security Note**: Never commit your `.env` file to version control. It's already in `.gitignore`.

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_OPENAI_API_KEY` | Yes | Your OpenAI API key for AI agents |

### AI Model Configuration

The default AI model is `gpt-4o-mini` (fast and cost-effective). To use a different model, edit `src/utils/openai-client.ts`:

```typescript
const MODEL = 'gpt-4o';  // More capable but higher cost (~10x)
```

### Timer Options

Timer duration is configured in-game on the Welcome page:
- **∞ (Unlimited)**: No time pressure
- **1-5 minutes**: Per turn time limit

---

## Running the Application

### Development Mode

Start the development server:

```bash
npm run dev
```

The application will be available at: **http://localhost:5173**

The server supports hot-reloading - changes to code will automatically refresh the browser.

### Production Build

To create an optimized production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

### All Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run start` | Same as dev (alias) |
| `npm run build` | Create optimized production build |
| `npm run preview` | Preview production build locally |

---

## How to Play

### Getting Started

1. **Create Profile**: Enter your email and optionally fill in demographics and interests (this helps the AI personalize clues to your background)
2. **Select Team & Role**: Choose Red or Blue team, and whether you want to be Spymaster or Guesser
3. **Set Timer**: Choose turn duration (unlimited recommended for first game)
4. **Start Game**: Click "Start Game" to begin

### Playing as Spymaster (You give clues)

1. You can see all card colors (your team, rival team, neutral, assassin)
2. Enter a one-word clue and the number of related words
3. Your AI teammate will guess based on your clue
4. Watch the AI's reasoning to understand its thought process

### Playing as Guesser (AI gives clues)

1. The AI Spymaster gives you a clue and number
2. Click on words you think match the clue
3. You can guess up to (number + 1) words per turn
4. Click "End Turn" when you want to stop guessing

### Clue Rules

- **One word only** - no phrases, hyphens, or compound words
- **Cannot be on the board** - or a variant/part of a board word
- **Number** - indicates how many of your team's words relate to the clue
- **+1 Rule** - Guesser can guess one extra word (for catching up on previous clues)

### Game End Conditions

- **Win**: Your team finds all their words first
- **Lose**: You click the Assassin word, or rival team finds all their words first

### After the Game

1. Complete the brief survey rating the AI's performance
2. View the game summary with turn-by-turn analysis
3. Check your Metrics page to see performance trends

---

## Data Storage

### How Data is Stored

All data is stored locally in your browser's **localStorage**. No data is sent to external servers (except OpenAI API calls for AI responses).

| Storage Key | Contents |
|-------------|----------|
| `coname-user-database` | User profiles, game history, AI learning summaries |
| `coname-game-state` | Current game state and settings |

### Accessing Data in Browser Console

Open browser Developer Tools (F12) → Console tab:

```javascript
// View all user data
JSON.parse(localStorage.getItem('coname-user-database'))

// View current game state
JSON.parse(localStorage.getItem('coname-game-state'))
```

### Clearing Data

To reset all data and start fresh:

```javascript
// In browser console
localStorage.removeItem('coname-user-database')
localStorage.removeItem('coname-game-state')
location.reload()
```

---

## Project Structure

```
Codenames Project/
├── README.md                 # This file
└── coname-ui/                # Frontend application
    ├── .env.example          # Environment template
    ├── .env                  # Your config (create this)
    ├── package.json          # Dependencies
    ├── index.html            # Entry HTML
    ├── vite.config.ts        # Vite configuration
    ├── tailwind.config.js    # Tailwind CSS config
    └── src/
        ├── main.tsx          # React entry point
        ├── App.tsx           # Main app component
        ├── index.css         # Global styles
        │
        ├── pages/
        │   ├── WelcomePage.tsx    # Home & game setup
        │   ├── ProfilePage.tsx    # User profile & AI summary
        │   ├── GamePage.tsx       # Main game interface
        │   └── MetricsPage.tsx    # Performance analytics
        │
        ├── components/
        │   ├── GameBoard.tsx      # 5x5 word grid
        │   ├── WordCard.tsx       # Individual word cards
        │   ├── ClueInput.tsx      # Spymaster clue entry
        │   ├── GuessSequence.tsx  # Animated guess display
        │   ├── GameSummary.tsx    # Post-game analysis
        │   ├── MicroSurvey.tsx    # Trust/feedback survey
        │   ├── SidePanel.tsx      # Game info sidebar
        │   └── ...                # Other UI components
        │
        ├── utils/
        │   ├── ai-agents.ts       # AI Spymaster & Guesser logic
        │   ├── openai-client.ts   # OpenAI API wrapper
        │   ├── prompt-builders.ts # AI prompt construction
        │   ├── summaryAgent.ts    # User learning summary generation
        │   ├── userDatabase.ts    # LocalStorage user management
        │   ├── gameLogic.ts       # Core game mechanics
        │   └── validator.ts       # Clue validation
        │
        ├── hooks/
        │   └── useGameState.ts    # Zustand state management
        │
        └── types/
            └── game.ts            # TypeScript interfaces
```

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | UI framework |
| TypeScript | 5.3 | Type safety |
| Vite | 5.0 | Build tool & dev server |
| Tailwind CSS | 3.3 | Utility-first styling |
| Framer Motion | 10.16 | Animations |
| Zustand | 4.4 | State management |
| Lucide React | 0.294 | Icons |
| OpenAI API | GPT-4o-mini | AI agents |

---

## Troubleshooting

### "Cannot find module" or dependency errors

```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### API Error: 401 Unauthorized

Your API key is invalid or missing:
1. Check that `.env` file exists in `coname-ui/` directory
2. Verify the key starts with `sk-`
3. Restart the dev server after changing `.env`

### API Error: 429 Rate Limit / Quota Exceeded

Your OpenAI account has insufficient credits:
1. Go to [OpenAI Billing](https://platform.openai.com/account/billing)
2. Add credits to your account
3. Wait a few minutes for limits to reset

### Game not loading / blank screen

1. Check browser console (F12) for errors
2. Try clearing localStorage:
   ```javascript
   localStorage.clear()
   location.reload()
   ```
3. Try a different browser

### Port 5173 already in use

Another process is using the port:
```bash
# Find and kill the process (macOS/Linux)
lsof -i :5173
kill -9 <PID>

# Or use a different port
npm run dev -- --port 3000
```

### Changes not appearing

Vite's hot-reload may have stalled:
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Restart the dev server

---

## Support

If you encounter issues not covered here, please:
1. Check the browser console for error messages
2. Ensure all prerequisites are met
3. Try the troubleshooting steps above

---

## License

This project was created for academic research on Human-AI collaboration.
