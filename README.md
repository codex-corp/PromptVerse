# PromptVerse

PromptVerse is an open-source workspace for discovering, organizing, and transforming AI prompts. It combines a polished Next.js interface with a SQLite-backed API so teams can build, iterate, and share prompt libraries with confidence.

## ✨ Highlights
- **Rich prompt management** – curate prompts with categories, tags, favorites, and version history.
- **Database-backed workflows** – create, edit, clone, and rate prompts stored in a shared SQLite catalog.
- **Lightning-fast discovery** – advanced filtering and live search keep the right prompt a keystroke away.
- **Built-in transformer** – open the transformer window from anywhere with <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Space</kbd>.
- **ChatGPT supercharge** – flip the transformer to ChatGPT mode for guided mode suggestions, inline analytics, and developer-grade scaffolds.
- **Offline-ready PWA** – install PromptVerse as a desktop experience on Windows 11 or any modern browser.
- **Dark mode design system** – accessible theming tuned for productive day and night work.

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Local offline dev: create .env.local with SQLite path and Node runtime
echo -e "DATABASE_URL=file:./db/dev.db\nNEXT_RUNTIME=nodejs" > .env.local

# Seed local SQLite and create tables (applies schema automatically)
npm run db:seed:local

# Start local development (Node + Next.js)
npm run dev:local
```

Open http://localhost:3000 and explore the seeded workspace. You can change the SQLite path by updating `DATABASE_URL` in `.env.local`.

### 🌱 Seed Baseline Data

Run one of the following to load the default user (`Hany alsamman <hany@codexc.com>`), engineering categories, models, and starter templates:

```bash
npm run db:seed:local   # local SQLite seed (applies schema and data)
npm run db:seed         # uses scripts/seed.ts (better-sqlite3)
npx prisma db seed      # uses prisma/seed.ts (Prisma Client)
```

Both commands produce the same baseline dataset so the transformer’s template gallery and model picker are ready to go.

Set `SEED_USER_EMAIL` / `SEED_USER_NAME` in `.env` to customise the default account used during seeding.

### ☁️ Cloudflare Preview & Deploy

PromptVerse supports Cloudflare Pages with the edge runtime and D1. Preview and production use the same remote D1 and KV bindings configured in `wrangler.toml`.

```bash
# Preview against remote D1/KV (deploys a Pages preview on branch "preview")
npm run preview

# Deploy to production
npm run deploy
```

- Configuration lives in `wrangler.toml` (top-level and `[env.preview]` bindings).
- API routes automatically use Edge/D1 on Cloudflare and Node/SQLite locally, controlled by `NEXT_RUNTIME`.
- KV binding name is `promptverse_kv`; D1 binding name is `promptverse_d1_db`.

## 🔌 Configure the Transformer Provider

The `/api/transform-prompt` endpoint speaks to any OpenAI-compatible API, including hosted OpenAI models and local runtimes such
as [Ollama](https://ollama.com/). Set the following environment variables in your `.env` file to choose a provider:

```bash
# Example: local Ollama
AI_BASE_URL="http://localhost:11434/v1"
AI_MODEL="llama3"

# Example: OpenAI (paid)
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="sk-..."
AI_MODEL="gpt-4o-mini"

# Example: Longcat (free tier)
AI_BASE_URL="https://api.longcat.chat/v1"
AI_API_KEY="lc-..."    # obtain at https://longcat.chat/platform/docs
AI_MODEL="LongCat-Flash-Chat"
# Other option: LongCat-Flash-Thinking
```

`AI_API_KEY` is optional for self-hosted providers that do not require authentication. PromptVerse automatically normalizes the
base URL, so both local and remote deployments work without code changes.

**Using Longcat's free tier**
1. Register at [LongCat's platform](https://longcat.chat/platform/docs/) and complete the sign-up form.
2. After logging in, open the [API Keys](https://longcat.chat/platform/api_keys) page.
3. Your account automatically includes a `default` key—copy its value into `AI_API_KEY`.
   - `Name`: application identifier.
   - `Key`: secret token—store securely.

### 💬 ChatGPT Mode

The transformer now includes a **ChatGPT** toggle designed for developer workflows. Selecting this mode swaps in a system prompt that enforces a structured scaffold:

- Top-level directives (`/ROLE`, `/TASK`, `/FORMAT`, `/CONTEXT`, `/QUALITY BAR`, `/ASK`).
- Optional reasoning add-ons (`/STEP-BY-STEP`, `/CHAIN OF THOUGHT`, `/CHECKLIST`, `/PM MODE`, and more) that are only appended when the model detects they will add value.
- Follow-up questions focused on clarifying ambiguous requirements.

- Guided mode selection helps you pin modes (e.g. `/STEP-BY-STEP`) based on live suggestions derived from the raw brief.
- Inline analytics tracks the most-used modes so you can see what the team relies on while iterating prompts.
- Copy prompts as Markdown, RTF, or open a ChatGPT tab preloaded with the scaffold—the tool also copies the prompt to your clipboard on the way.
- Saving from the transformer auto-generates a crisp title and description, pulling `/ROLE` + `/TASK` metadata in ChatGPT mode or summarising the opening brief in Standard mode.
- Engineering template gallery (inspired by OpenAI's "ChatGPT for engineering teams") offers ready-to-tailor prompts for reviews, architecture decisions, debugging, migrations, and incidents. Templates adapt automatically to Standard or ChatGPT mode.
- Save finished prompts directly to your workspace—Markdown responses are auto-titled and tagged before persisting.
- Launch an embedded tour with `Ctrl` + `H` to learn the layout (templates, raw prompt builder, guided modes, analytics, and actions).

The output is always Markdown so you can paste it directly into ChatGPT or any OpenAI-compatible chat interface. Switch back to **Standard** mode to regain JSON exports.

## 📦 Install as an App
1. Launch PromptVerse in Microsoft Edge, Chrome, or another PWA-capable browser.
2. Click **Install App** in the top toolbar (or use your browser's install option).
3. Follow the prompts to pin PromptVerse to your Start menu or taskbar.

> The install experience uses a Progressive Web App manifest and service worker, so PromptVerse keeps working even when your network drops.

## 🧠 Core Features
- **Prompt library** – read, favorite, and rate prompts, with author attribution and usage stats.
- **Advanced search** – filter by category, model, tags, rating, favorites, and date range.
- **Prompt creation** – capture structured metadata and persist it instantly to the database.
- **Version manager** – clone prompts, record version notes, and evolve prompts safely.
- **Prompt transformer** – send prompts through the `/api/transform-prompt` endpoint for automated refinement.
  - Switch between the default profile and a ChatGPT-targeted profile that outputs `/ROLE`, `/TASK`, `/ASK`, and smart reasoning modes such as `/CHAIN OF THOUGHT` or `/CHECKLIST` when relevant.
  - Guided mode suggestions, pinned modes, and inline analytics keep ChatGPT prompts sharp and measurable.
  - Engineering template library with ready-to-tailor prompts for code reviews, architecture debates, debugging plans, migrations, and incident postmortems.
  - Save transformed prompts (Markdown or JSON) straight into your library with generated titles, sensible defaults, and tags.
  - Interactive tour (`Ctrl` + `H`) walks new teammates through the transformer workflow step by step.

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript 5 + React 19
- **Styling**: Tailwind CSS 4 + shadcn/ui + Lucide icons
- **State & Forms**: React Hook Form, Zustand, TanStack Query
- **Backend**: SQLite (local dev) + D1 (Cloudflare) via a unified async data layer, REST APIs, Socket.IO-ready server bootstrap
- **Content Tools**: MDX Editor, React Markdown, Syntax Highlighter
- **Testing & Quality**: ESLint, TypeScript strictness, automated builds

## 🧭 Project Structure
```
src/
├── app/                 # App Router routes, API handlers, and layout
├── components/          # Reusable UI, including shadcn/ui primitives
├── hooks/               # Custom React hooks
├── lib/                 # Utilities, SQLite data helpers, socket helpers
└── scripts/             # Database seed utilities
```

## 🤝 Contributing
1. Fork the repository and create a branch: `git checkout -b feature/amazing-idea`
2. Install dependencies and ensure the database is running.
3. Run `npm run lint` and `npm run build` before submitting your pull request.
4. Open a PR describing your changes and link any relevant issues.

We welcome issues, feature ideas, and documentation updates from the community.

## 📄 License
PromptVerse is released under the [MIT License](LICENSE). Feel free to use it in your own projects or adapt it for your team.

## 🌐 Community
Have a question or want to share how you're using PromptVerse? Open a discussion or join the conversation in the issue tracker. Let's build a richer prompt ecosystem together!
