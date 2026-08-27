# landing-page-games

A monorepo of small browser games built to sit on a landing page - the kind a visitor plays for
ninety seconds while deciding whether to read the rest of the page. Each game is its own
self-contained Vite project under a kebab-case folder. Each game is its own self-contained Vite project under a kebab-case folder, independent of the others: run, build and deploy
one without touching the rest.

## Games

| Game | Folder | Status | Plan |
|---|---|---|---|
| Chasm Jumper | [`chasm-jumper/`](./chasm-jumper) | Playable locally | [`chasm-jumper-plan.md`](./chasm-jumper-plan.md) |

## Run a game

```bash
cd chasm-jumper
npm install
npm run dev
```

Default dev port is `8080` (set in each game's `vite.config.ts`).

## Build a game for deploy

```bash
cd chasm-jumper
npm run build
# → produces ./dist – static files, drop on Vercel / Netlify / GitHub Pages / S3
```

## Add a new game

```bash
# from repo root
cp -R chasm-jumper my-new-game
cd my-new-game
# edit package.json "name", index.html title, src/pages/Index.tsx
rm -rf node_modules dist
npm install
npm run dev
```

Then add a row to the games table above and commit.

## Conventions

- Folder names are lowercase kebab-case (`chasm-jumper`, not `Chasm Jumper`).
- Each game has its own `package.json` and `node_modules` – no shared workspace yet. If the repo grows, switch to npm workspaces or Turborepo.
- Each game ships a `PLAN.md` (or sibling plan doc at repo root for the first game) explaining the concept and any open design questions.
- Per-game `vite.config.ts` keeps the `@/` alias pointing at that game's `./src`. Do not cross-import between games.

## Stack

Per game: Vite 5, React 18, TypeScript, Tailwind 3. Slimmed dependency lists – no router, no query, no UI kits unless a game actually needs them.
