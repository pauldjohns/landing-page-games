# Chasm Jumper – Plan & Status

*Started 2026-05-01 as an idea. Updated 2026-05-03 after a working build was pulled down from Lovable and rebuilt locally.*

## Current status

A working version lives in `chasm-jumper/`. It was originally built on Lovable, then ported off (Lovable's GitHub sync would have created a new repo and required OAuth, so the source was downloaded file-by-file from the editor instead). The local copy is a slimmed Vite + React + TypeScript + Tailwind project – the Lovable starter shipped with a lot of unused shadcn/Radix/router/query plumbing, which has been stripped out. The actual game and its art assets are unchanged from what Lovable produced.

To run it:

```bash
cd chasm-jumper
npm install
npm run dev
# → http://localhost:8080
```

## What Lovable built (vs the original idea)

The Lovable build is faithful to the original pitch with three notable diffs worth deciding on for a future pass:

| Original idea | What Lovable did |
|---|---|
| 2 items: springboard, rocket pack | 3 items: springboard, rocket pack, **grappling hook** |
| Year on the ancient tome: 1986 | 1987 |
| Code: ↑↓↑↓←→←→ A B A B select start (a variant) | ↑ ↑ ↓ ↓ ← → ← → B A (canonical Konami code) |
| 'No audio at all. All dialogue in speech bubbles.' | Web Audio chiptune background music plus sound effects on every action |

The audio in particular is a real divergence. It is well done – pure Web Audio square/triangle/noise oscillators, no asset files – but it is not what the original brief asked for. Easy to mute or remove if we want to keep the spec.

Visually, Lovable nailed it: medieval pixel landscape with castle silhouette, glowing gold chest with a 'TRY THIS' wooden sign, robed sage with staff and orb, futuristic neon-grid city across the chasm, gold-flooded win state.

## Architecture (current)

- **Engine:** HTML5 canvas + vanilla `requestAnimationFrame` game loop, all in one ~700-line component (`src/components/game/ChasmQuest.tsx`).
- **Audio:** `src/components/game/retroAudio.ts` – pure Web Audio chiptune.
- **Sprites:** mostly drawn pixel-by-pixel with `ctx.fillRect` calls (player, sage, chest, sign). The three backgrounds (`medieval-bg.png`, `future-bg.png`, `chasm-bg.png`) are 1024 x 1024 PNGs.
- **Fonts:** Press Start 2P (titles), VT323 (body), both via Google Fonts.
- **Stack:** Vite 5 + React 18 + TypeScript + Tailwind 3, slimmed deps (107 packages installed, no Next.js, no router, no query, no shadcn UI kit).

## Ideas to vibe-code over the weekend

Pick any subset – none are required.

- **Honor the original spec.** Drop the grappling hook back to the original two items, change 1987 → 1986, swap the canonical Konami in for the A-B-A-B-select-start variant, and either mute audio entirely or gate it behind a small toggle.
- **Tighten the hack reveal.** Right now the sage runs through six sequential bubbles before opening the input. Could be shorter, or could be more theatrical with a slow tome-opening animation.
- **Sage personality.** Lovable's sage talks like a generic 'thou must first attempt' fantasy NPC. The sage's voice could be funnier here.
- **Win-state ceremony.** The current gold flood is fine. Could add a one-liner from the future-city ('welcome, hero') or a small confetti / sparkle pass.
- **Embed.** Decide where this lives – standalone microsite, or a sub-page on your marketing site. Easy to deploy as a static build (`npm run build`).

## Why the rebuild went smoothly

This came together in one session because all the heavy lifting (game design, art, audio) was already done by Lovable. The local rebuild was mostly a porting exercise: pull files, drop the Lovable-specific build plugin, slim the dependency list, run. The only friction was that Lovable's per-file Download in the code editor is the only no-OAuth way to extract the source, so each file required a click-pair. Worth knowing for future Lovable pulls.

## File inventory

```
Chasm Jumper/
├── index.html
├── package.json          ← slimmed (no router, query, shadcn, lovable-tagger)
├── postcss.config.js
├── tailwind.config.ts    ← all the gold/neon/chasm colour tokens
├── tsconfig.{json,app.json,node.json}
├── vite.config.ts        ← lovable-tagger removed, '@/' alias preserved
└── src/
    ├── main.tsx          ← simplified – renders Index directly
    ├── index.css         ← design system + speech bubble + animations
    ├── pages/Index.tsx
    ├── components/game/
    │   ├── ChasmQuest.tsx   ← the entire game, ~700 lines
    │   └── retroAudio.ts    ← Web Audio chiptune
    └── assets/
        ├── medieval-bg.png  (224 KB)
        ├── future-bg.png    (228 KB)
        └── chasm-bg.png     (74 KB)
```

## Original idea (kept for reference)

Below is the spec as it was first written down on 2026-05-01, before the Lovable build existed. Useful for comparing intent vs what shipped.

> A simple 8-bit landing-page game. Slight bird's-eye-view side-scroller. Two minutes from start to finish. The whole game is a setup for one joke.
>
> Player spawns medieval (left), large chasm middle, futuristic city far right. Walking up to the sage before any jump attempt: refusal. Try to jump – fall. Box of items on the medieval side: springboard (shoots up, falls down chasm), rocket pack (slams into far wall, slides). After at least one failed attempt, sage opens the tome, reads guidance from 1986, dictates the Contra code. Player enters it, character glows and transforms into a tracksuit, every jump now clears the chasm. Land on the far side, future city lights up gold. End.
>
> No audio. All dialogue in 90s-style speech bubbles.
