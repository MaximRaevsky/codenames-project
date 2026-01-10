# CoName - AI-Powered Codenames

A Human-AI collaboration game where you team up with an AI partner to play Codenames. Built with React, TypeScript, and OpenAI's GPT-4o.

## 🎮 Overview

CoName is a web-based implementation of the popular board game Codenames, featuring:
- **AI Teammate**: Play with an AI partner as either Spymaster (giving clues) or Guesser (interpreting clues)
- **AI Opponents**: Compete against a fully AI-controlled rival team
- **Adaptive Learning**: The AI learns your play style and preferences over time
- **User Profiling**: Create a profile to help the AI understand your thinking patterns
- **Metrics Dashboard**: Track your performance and trust metrics over games

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| **Node.js** | 18.x or higher | `node --version` |
| **npm** | 9.x or higher | `npm --version` |
| **OpenAI API Key** | GPT-4o access | [Get one here](https://platform.openai.com/api-keys) |

---

## 🔑 API Keys Required

### OpenAI API Key (Required)

This project requires an OpenAI API key with access to **GPT-4o-mini** model.

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Ensure your account has billing enabled and sufficient credits
4. The key should have access to the `gpt-4o-mini` model

**Estimated Cost**: ~$0.01-0.05 per game (varies based on game length)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "Codenames Project"
```

### 2. Install Dependencies

```bash
cd coname-ui
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `coname-ui` directory:

```bash
cd coname-ui
touch .env
```

Add your OpenAI API key to the `.env` file:

```env
# OpenAI API Configuration (REQUIRED)
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

> ⚠️ **Important**: Never commit your `.env` file to version control!

### 4. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

---

## 📁 Project Structure

```
Codenames Project/
└── coname-ui/                    # Main application directory
    ├── src/
    │   ├── components/           # React UI components
    │   │   ├── ClueInput.tsx     # Spymaster clue input form
    │   │   ├── CountdownTimer.tsx # Turn timer display
    │   │   ├── GameBoard.tsx     # 5x5 word grid
    │   │   ├── GameOverModal.tsx # End game modal
    │   │   ├── GameSummary.tsx   # Post-game turn analysis
    │   │   ├── GuessSequence.tsx # Guesser word selection
    │   │   ├── MicroSurvey.tsx   # Post-game feedback form
    │   │   ├── SidePanel.tsx     # Score and turn history
    │   │   └── WordCard.tsx      # Individual word tile
    │   │
    │   ├── pages/                # Page components
    │   │   ├── WelcomePage.tsx   # Home/setup page
    │   │   ├── ProfilePage.tsx   # User profile editor
    │   │   ├── GamePage.tsx      # Main game interface
    │   │   └── MetricsPage.tsx   # Performance analytics
    │   │
    │   ├── hooks/
    │   │   └── useGameState.ts   # Zustand state management
    │   │
    │   ├── utils/
    │   │   ├── ai-agents.ts      # AI Spymaster & Guesser logic
    │   │   ├── openai-client.ts  # OpenAI API wrapper
    │   │   ├── prompt-builders.ts # AI prompt construction
    │   │   ├── summaryAgent.ts   # User learning summary AI
    │   │   ├── userDatabase.ts   # Local storage user data
    │   │   ├── gameLogic.ts      # Core game mechanics
    │   │   └── validator.ts      # Clue validation
    │   │
    │   ├── types/
    │   │   └── game.ts           # TypeScript interfaces
    │   │
    │   ├── App.tsx               # Root component
    │   ├── main.tsx              # Entry point
    │   └── index.css             # Global styles (Tailwind)
    │
    ├── .env                      # Environment variables (create this!)
    ├── package.json              # Dependencies
    ├── vite.config.ts            # Vite configuration
    ├── tailwind.config.js        # Tailwind CSS config
    └── tsconfig.json             # TypeScript config
```

---

## 🎯 How to Play

### Game Rules (Codenames)

1. A 5x5 grid of 25 words is displayed
2. Words belong to 4 categories:
   - **Your Team** (9 words if starting, 8 otherwise) - Red or Blue
   - **Rival Team** (8 words if starting, 9 otherwise)
   - **Neutral** (7 words) - End your turn
   - **Assassin** (1 word) - Instant loss!

3. Teams take turns giving clues and guessing
4. First team to find all their words wins

### Roles

| Role | You Do | AI Does |
|------|--------|---------|
| **Spymaster** | See all colors, give one-word clues | Guess words based on your clues |
| **Guesser** | Guess words based on clues | See all colors, give you clues |

### Clue Rules

- Must be a **single word**
- Cannot be a word on the board (or root/substring of one)
- Include a number indicating how many words relate to the clue
- Guesser can guess up to (number + 1) words

---

## 💾 Data Storage

### User Profiles

User data is stored in **browser localStorage** under the key `coname-users`.

Data includes:
- Email (unique identifier)
- Profile information (age, occupation, interests)
- AI learning summary (updated after each game)
- Summary history with timestamps

### Game State

Active game state is persisted in localStorage under `coname-game-state`.

### Exporting Data

For research purposes, user data can be exported to CSV:
1. Open browser console (F12)
2. Run: `localStorage.getItem('coname-users')`

---

## 🔧 Configuration Options

### Timer Settings

Available timer durations (set on Welcome page):
- **∞** - No timer
- **1 min** - Speed mode
- **2 min** - Standard (default)
- **3 min** - Relaxed
- **5 min** - Extended

### AI Model

The AI uses **GPT-4o-mini** by default. To change:

Edit `coname-ui/src/utils/openai-client.ts`:
```typescript
const MODEL = 'gpt-4o-mini'; // Change to 'gpt-4o' for better performance (higher cost)
```

---

## 🛠️ Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Styling |
| **Zustand** | State management |
| **Framer Motion** | Animations |
| **Lucide React** | Icons |
| **OpenAI API** | AI agents |

---

## 🐛 Troubleshooting

### "OpenAI API key not configured"

1. Ensure `.env` file exists in `coname-ui/` directory
2. Check the key starts with `sk-`
3. Restart the dev server after changing `.env`

### "API error 401"

- Your API key is invalid or expired
- Check your OpenAI account has billing enabled

### "API error 429"

- Rate limit exceeded
- Wait a moment and try again
- Consider upgrading your OpenAI plan

### Game not saving

- Check browser localStorage isn't disabled
- Try clearing localStorage and starting fresh:
  ```javascript
  localStorage.clear()
  ```

### AI taking too long

- GPT-4o responses can take 3-10 seconds
- Check your internet connection
- The console shows API call progress

---

## 📊 Metrics & Analytics

The Metrics page tracks:
- **Trust Score**: How much you trust AI decisions
- **Clue Clarity**: How clear AI clues are to you
- **Win/Loss Record**: Game outcomes over time
- **Performance Trends**: Historical data visualization

---

## 🔒 Privacy

- All data is stored **locally** in your browser
- API calls go directly to OpenAI (not through any proxy)
- No analytics or tracking
- Your OpenAI API key never leaves your browser

---

## 📄 License

This project is for research and educational purposes.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📞 Support

For issues or questions:
1. Check the Troubleshooting section above
2. Open a GitHub issue
3. Include console logs and browser info

---

## ✨ Features Roadmap

- [x] AI Spymaster & Guesser
- [x] User profiles with AI learning
- [x] Post-game feedback surveys
- [x] Metrics dashboard
- [x] Timer options
- [ ] Multiplayer support
- [ ] More AI models (Claude, Gemini)
- [ ] Game replay feature
