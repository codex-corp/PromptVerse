# PromptVerse

PromptVerse is an open-source workspace for discovering, organizing, and transforming AI prompts. It combines a polished Next.js interface with a Prisma-backed API so teams can build, iterate, and share prompt libraries with confidence.

## ✨ Highlights
- **Rich prompt management** – curate prompts with categories, tags, favorites, and version history.
- **Database-backed workflows** – create, edit, clone, and rate prompts with real Prisma models.
- **Lightning-fast discovery** – advanced filtering and live search keep the right prompt a keystroke away.
- **Built-in transformer** – open the transformer window from anywhere with <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Space</kbd>.
- **Offline-ready PWA** – install PromptVerse as a desktop experience on Windows 11 or any modern browser.
- **Dark mode design system** – accessible theming tuned for productive day and night work.

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Sync the database schema
npm run db:push

# Seed sample data (optional)
npm run db:seed

# Start the development server with Node + Next.js
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your Prisma user data to explore the workspace.

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

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript 5 + React 19
- **Styling**: Tailwind CSS 4 + shadcn/ui + Lucide icons
- **State & Forms**: React Hook Form, Zustand, TanStack Query
- **Backend**: Prisma ORM, REST APIs, Socket.IO ready server bootstrap
- **Content Tools**: MDX Editor, React Markdown, Syntax Highlighter
- **Testing & Quality**: ESLint, TypeScript strictness, automated builds

## 🧭 Project Structure
```
src/
├── app/                 # App Router routes, API handlers, and layout
├── components/          # Reusable UI, including shadcn/ui primitives
├── hooks/               # Custom React hooks
├── lib/                 # Utilities, Prisma client, socket helpers
└── prisma/              # Schema, migrations, and seeds
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
