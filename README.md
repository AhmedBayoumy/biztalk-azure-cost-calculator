# BizTalk Azure Cost Calculator

An AI-powered tool to estimate Azure migration costs from BizTalk Server.

## Features

- 📄 Parse BizTalk analysis JSON/Markdown, binding XML, or free-text descriptions
- 🤖 AI-powered parsing via GitHub Models API (uses your GitHub token automatically)
- 💰 Live Azure pricing via Azure Retail Prices API
- 📊 Mermaid architecture diagrams
- 💾 Save estimates to SQLite database (local)
- 👤 Sign in with GitHub OAuth

## Quick Start

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with your credentials
npm run dev
```

## GitHub OAuth Setup (for saving estimates)

1. Go to https://github.com/settings/developers → OAuth Apps → New OAuth App
2. Homepage URL: `http://localhost:3001`
3. Callback URL: `http://localhost:3001/api/auth/callback/github`
4. Copy Client ID and Client Secret to `.env.local`
5. Generate a NextAuth secret: `openssl rand -base64 32`

## AI Parsing

The app uses GitHub Models API for parsing free-text descriptions.

- If you sign in with GitHub OAuth → your OAuth token is used automatically
- If not signed in → set `GH_TOKEN` in `.env.local` (from `gh auth login`)
- Fallback: set `OPENAI_API_KEY` for any OpenAI-compatible endpoint

## Architecture

See the Mermaid diagram rendered in the app after calculating costs.

## Tech Stack

- Next.js 15, React 19, Tailwind CSS
- NextAuth v4 (GitHub OAuth)
- better-sqlite3 (local SQLite database)
- Azure Retail Prices API (live pricing)
- GitHub Models API (AI parsing)
- jsPDF + xlsx (export)
