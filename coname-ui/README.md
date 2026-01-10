# CoName UI

This is the frontend application for CoName - an AI-powered Codenames game.

**For complete documentation, setup instructions, and API key configuration, see the [main README](../README.md) in the project root.**

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create .env file with your OpenAI API key
cp .env.example .env
# Edit .env and add your VITE_OPENAI_API_KEY

# 3. Start development server
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (http://localhost:5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Environment Variables

See `.env.example` for required configuration:

```env
VITE_OPENAI_API_KEY=sk-your-key-here
```

---

See [main README](../README.md) for full documentation.
