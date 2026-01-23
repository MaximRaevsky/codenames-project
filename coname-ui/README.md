# CoName UI

Frontend application for CoName - an AI-powered Codenames game for Human-AI collaboration research.

> **For complete documentation, see the [main README](../README.md) in the project root.**

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env

# 3. Add your OpenAI API key to .env
# Edit .env and set: VITE_OPENAI_API_KEY=sk-your-key-here

# 4. Start development server
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Requirements

- Node.js 18+
- npm 9+
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (http://localhost:5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

---

## Project Structure

```
src/
├── pages/           # Main views (Welcome, Game, Profile, Metrics)
├── components/      # Reusable UI components
├── utils/           # AI agents, game logic, database
├── hooks/           # State management (Zustand)
└── types/           # TypeScript interfaces
```

---

See [main README](../README.md) for full documentation, gameplay instructions, and troubleshooting.
