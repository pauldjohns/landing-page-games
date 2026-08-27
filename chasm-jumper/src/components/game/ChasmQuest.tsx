import { useEffect, useRef, useState, useCallback } from "react";
import medievalBg from "@/assets/medieval-bg.png";
import futureBg from "@/assets/future-bg.png";
import chasmBg from "@/assets/chasm-bg.png";
import { initAudio, playSfx, startMusic, stopMusic, setMusicTheme } from "./retroAudio";

// World layout (in world units = pixels at 1x scale)
const WORLD = {
  width: 2400,
  height: 540,
  groundY: 420, // top of ground
  chasmStart: 1100,
  chasmEnd: 1700, // 600px wide chasm — impossible without cheat
  futureLandStart: 1700,
  futureGroundY: 420, // same level as medieval ground
};

const PLAYER = {
  w: 28,
  h: 44,
  speed: 3.2,
  jumpV: -11,
  gravity: 0.55,
  cheatJumpV: -18,
  cheatSpeed: 11,
};

type ItemKind = "none" | "spring" | "rocket" | "grapple";
type Phase = "intro" | "playing" | "falling" | "respawn" | "win";

const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];

interface Bubble { id: number; speaker: "sage" | "hero" | "narrator"; text: string; x?: number; y?: number; }

export default function ChasmQuest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [attemptCount, setAttemptCount] = useState(0);
  const [hasCheat, setHasCheat] = useState(false);
  const [sageDialogStep, setSageDialogStep] = useState(0); // 0=closed,1..n
  const [showItemBox, setShowItemBox] = useState(false);
  const [equipped, setEquipped] = useState<ItemKind>("none");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [konamiProgress, setKonamiProgress] = useState(0);
  const [awaitingKonami, setAwaitingKonami] = useState(false);
  const [transformed, setTransformed] = useState(false);

  // mutable refs for game state (avoid re-render every frame)
  const stateRef = useRef({
    px: 120, py: WORLD.groundY - PLAYER.h, vx: 0, vy: 0,
    onGround: true, facing: 1, camX: 0,
    rocketActive: false, springActive: false, grappleActive: false,
    rocketTimer: 0, rocketLaunchX: 0,
    grappleAnchorX: 0, grappleOriginX: 0, grappleOriginY: 0, grappleProgress: 0,
    keys: new Set<string>(),
    near: null as null | "sage" | "box",
    transformed: false, attemptCount: 0, hasCheat: false,
    phase: "intro" as Phase, equipped: "none" as ItemKind,
    sparkles: [] as { x: number; y: number; vx: number; vy: number; life: number; }[],
  });

  // sync select state into ref
  useEffect(() => { stateRef.current.transformed = transformed; }, [transformed]);
  useEffect(() => { stateRef.current.attemptCount = attemptCount; }, [attemptCount]);
  useEffect(() => { stateRef.current.hasCheat = hasCheat; }, [hasCheat]);
  useEffect(() => { stateRef.current.phase = phase; }, [phase]);
  useEffect(() => { stateRef.current.equipped = equipped; }, [equipped]);

  const addBubble = useCallback((b: Omit<Bubble, "id">, opts?: { duration?: number; replaceSpeaker?: boolean }) => {
    const id = Date.now() + Math.random();
    const duration = opts?.duration ?? 4200;
    setBubbles((prev) => {
      const filtered = opts?.replaceSpeaker ? prev.filter((x) => x.speaker !== b.speaker) : prev;
      return [...filtered, { ...b, id }];
    });
    setTimeout(() => setBubbles((prev) => prev.filter((x) => x.id !== id)), duration);
    if (b.speaker === "sage") playSfx("blip");
    else if (b.speaker === "hero") playSfx("blipHi");
    else playSfx("chime");
  }, []);

  const triggerFall = useCallback(() => {
    setPhase("falling");
    stateRef.current.phase = "falling";
    setAttemptCount((c) => c + 1);
    playSfx("fall");
    setTimeout(() => addBubble({ speaker: "narrator", text: "The chasm claims another soul..." }, { duration: 2100 }), 600);
    setTimeout(() => {
      // respawn
      const s = stateRef.current;
      s.px = 120; s.py = WORLD.groundY - PLAYER.h; s.vx = 0; s.vy = 0;
      s.onGround = true; s.rocketActive = false; s.springActive = false; s.grappleActive = false;
      setEquipped("none");
      setPhase("playing");
    }, 1800);
  }, [addBubble]);

  const triggerWin = useCallback(() => {
    setPhase("win");
    stateRef.current.phase = "win";
    playSfx("win");
    setMusicTheme("victory");
    addBubble({ speaker: "hero", text: "I made it!" });
  }, [addBubble]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key;
      // Konami detection (case-insensitive for letters)
      if (awaitingKonami) {
        const expected = KONAMI[konamiProgress];
        const got = k.length === 1 ? k.toLowerCase() : k;
        if (got === expected) {
          const next = konamiProgress + 1;
          if (next === KONAMI.length) {
            setAwaitingKonami(false);
            setKonamiProgress(0);
            setTransformed(true);
            setHasCheat(true);
            addBubble({ speaker: "narrator", text: "✨ The ancient hack awakens within you! ✨" });
          } else {
            setKonamiProgress(next);
          }
          e.preventDefault();
          return;
        } else {
          setKonamiProgress(0);
        }
      }

      stateRef.current.keys.add(k);

      if (stateRef.current.phase !== "playing") return;

      if (k === " " || k === "Spacebar") {
        e.preventDefault();
        const s = stateRef.current;
        if (s.onGround) {
          const v = s.transformed ? PLAYER.cheatJumpV : PLAYER.jumpV;
          s.vy = v;
          s.onGround = false;
          playSfx(s.transformed ? "jumpHi" : "jump");
          // item activation
          if (stateRef.current.equipped === "spring") { s.springActive = true; s.vy = -22; playSfx("boing"); }
          if (stateRef.current.equipped === "rocket") { s.rocketActive = true; s.rocketTimer = 35; s.vx = 9; s.rocketLaunchX = s.px; playSfx("rocket"); }
          if (stateRef.current.equipped === "grapple") {
            s.grappleActive = true;
            s.grappleOriginX = s.px + PLAYER.w / 2;
            s.grappleOriginY = s.py + 12;
            s.grappleAnchorX = s.px + 450; // never enough to clear the 600px chasm
            s.grappleProgress = 0;
            s.vy = 0;
            playSfx("grapple");
          }
        }
      }

      if (k === "Enter" || k === "e" || k === "E") {
        if (stateRef.current.near === "sage") openSage();
        if (stateRef.current.near === "box") setShowItemBox(true);
      }
    };
    const up = (e: KeyboardEvent) => stateRef.current.keys.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingKonami, konamiProgress]);

  const openSage = useCallback(() => {
    const currentAttempts = stateRef.current.attemptCount;
    const currentTransformed = stateRef.current.transformed;
    if (currentAttempts === 0) {
      addBubble({ speaker: "sage", text: "Hold, traveler. Thou must FIRST attempt the chasm. Only then shall the tome reveal its secret." });
      return;
    }
    if (currentTransformed) {
      addBubble({ speaker: "sage", text: "The power is thine. Run, and leap!" });
      return;
    }
    // Sequential dialog
    const lines = [
      { speaker: "sage" as const, text: "Ahh... thou hast tasted the abyss. Sit. Listen." },
      { speaker: "sage" as const, text: "*opens an ancient tome, dust spirals into the air*" },
      { speaker: "sage" as const, text: "This text provides guidance on crossing the impossible chasm." },
      { speaker: "sage" as const, text: "The wisdom comes from a forgotten year... 1987." },
      { speaker: "sage" as const, text: "It speaks of a sacred sequence: ↑ ↑ ↓ ↓ ← → ← → B A" },
      { speaker: "sage" as const, text: "Inscribe it now upon thy keys, hero." },
    ];
    let i = 0;
    const showNext = () => {
      if (i >= lines.length) { setAwaitingKonami(true); return; }
      addBubble(lines[i], { duration: 5400, replaceSpeaker: true });
      i++;
      setTimeout(showNext, 5200);
    };
    showNext();
  }, [addBubble]);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const med = new Image(); med.src = medievalBg;
    const fut = new Image(); fut.src = futureBg;
    const cha = new Image(); cha.src = chasmBg;

    let raf = 0;
    let frame = 0;

    const draw = () => {
      frame++;
      const s = stateRef.current;
      const W = canvas.width, H = canvas.height;

      // Update
      if (s.phase === "playing") {
        const speed = s.transformed ? PLAYER.cheatSpeed : PLAYER.speed;
        if (s.keys.has("ArrowLeft") || s.keys.has("a") || s.keys.has("A")) { s.vx = -speed; s.facing = -1; }
        else if (s.keys.has("ArrowRight") || s.keys.has("d") || s.keys.has("D")) { s.vx = speed; s.facing = 1; }
        else if (!s.rocketActive && !s.grappleActive) { s.vx *= 0.7; if (Math.abs(s.vx) < 0.1) s.vx = 0; }

        // Rocket: continues forward, no control. Limited distance — never enough to clear the chasm.
        if (s.rocketActive) {
          s.vx = 9;
          s.rocketTimer--;
          // particles
          s.sparkles.push({ x: s.px - s.facing * 10, y: s.py + PLAYER.h / 2, vx: -s.facing * 2, vy: (Math.random() - 0.5) * 2, life: 20 });
          // Hard cap: rocket sputters out after 350px traveled
          if (s.rocketTimer <= 0 || s.px - s.rocketLaunchX > 350) {
            s.rocketActive = false;
            s.vx = 2; // small residual
          }
        }

        // Grapple: pulls hero forward to a fixed anchor — anchor never spans the chasm.
        if (s.grappleActive) {
          const targetX = s.grappleAnchorX - PLAYER.w / 2;
          const dx = targetX - s.px;
          if (Math.abs(dx) < 4) {
            s.grappleActive = false;
            s.vx = 0;
          } else {
            s.vx = Math.sign(dx) * 8;
            s.vy = 0; // suspended on rope
          }
          s.grappleProgress = Math.min(1, s.grappleProgress + 0.08);
        }

        s.px += s.vx;
        s.py += s.vy;
        s.vy += PLAYER.gravity;

        // Ground / chasm collision
        const overChasm = s.px + PLAYER.w / 2 > WORLD.chasmStart && s.px + PLAYER.w / 2 < WORLD.chasmEnd;
        const onFutureSide = s.px + PLAYER.w / 2 >= WORLD.futureLandStart;
        const localGroundY = onFutureSide ? WORLD.futureGroundY : WORLD.groundY;

        if (s.py + PLAYER.h >= localGroundY) {
          if (overChasm && !s.grappleActive) {
            // fall
            s.py += 8;
            if (s.py > WORLD.groundY + 60) { triggerFall(); return scheduleNext(); }
          } else {
            // Only land if descending OR already on ground (prevents passing through elevated future ledge from below)
            if (s.vy >= 0) {
              s.py = localGroundY - PLAYER.h;
              s.vy = 0; s.onGround = true;
              s.springActive = false; s.grappleActive = false;
            }
          }
        } else {
          s.onGround = false;
        }

        // boundaries
        if (s.px < 0) s.px = 0;
        if (s.px + PLAYER.w > WORLD.width) s.px = WORLD.width - PLAYER.w;

        // Camera follow
        s.camX = Math.max(0, Math.min(WORLD.width - W, s.px - W / 2 + PLAYER.w / 2));

        // win
        if (s.px > WORLD.futureLandStart + 80 && s.onGround && onFutureSide) {
          triggerWin(); return scheduleNext();
        }

        // proximity
        const sageX = 280;
        const boxX = 700;
        const distSage = Math.abs(s.px - sageX);
        const distBox = Math.abs(s.px - boxX);
        if (distSage < 50) s.near = "sage";
        else if (distBox < 50) s.near = "box";
        else s.near = null;
      }

      if (s.phase === "falling") {
        s.py += 10; s.vy = 10;
        s.sparkles.push({ x: s.px + Math.random()*PLAYER.w, y: s.py, vx: 0, vy: -2, life: 15 });
      }

      // update sparkles
      s.sparkles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
      s.sparkles = s.sparkles.filter(p => p.life > 0);

      // RENDER
      ctx.fillStyle = "#10131f";
      ctx.fillRect(0, 0, W, H);

      // Backgrounds: draw a single wide image stretched across each region (continuous, not tiled)
      // Slight parallax via small camera offset on background.
      const medRegionW = WORLD.chasmStart;
      const futRegionW = WORLD.width - WORLD.futureLandStart;
      if (med.complete) {
        ctx.drawImage(med, 0 - s.camX, 0, medRegionW, H);
      }
      if (fut.complete) {
        ctx.drawImage(fut, WORLD.futureLandStart - s.camX, 0, futRegionW, H);
      }

      // ground tiles
      // medieval ground
      const groundScreenY = WORLD.groundY;
      ctx.fillStyle = `hsl(110 45% 28%)`;
      ctx.fillRect(0 - s.camX, groundScreenY, WORLD.chasmStart, H - groundScreenY);
      ctx.fillStyle = `hsl(110 50% 38%)`;
      ctx.fillRect(0 - s.camX, groundScreenY, WORLD.chasmStart, 8);
      // dirt pattern
      ctx.fillStyle = `hsl(25 40% 22%)`;
      for (let x = 0; x < WORLD.chasmStart; x += 40) {
        ctx.fillRect(x - s.camX, groundScreenY + 20, 6, 6);
        ctx.fillRect(x + 18 - s.camX, groundScreenY + 50, 4, 4);
      }

      // chasm
      if (cha.complete) {
        ctx.drawImage(cha, WORLD.chasmStart - s.camX, groundScreenY - 4, WORLD.chasmEnd - WORLD.chasmStart, H - groundScreenY + 4);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(WORLD.chasmStart - s.camX, groundScreenY, WORLD.chasmEnd - WORLD.chasmStart, H - groundScreenY);
      }

      // future ground (ELEVATED)
      const futGroundScreenY = WORLD.futureGroundY;
      const futGoldGlow = stateRef.current.phase === "win";
      ctx.fillStyle = futGoldGlow ? `hsl(45 90% 45%)` : `hsl(230 25% 20%)`;
      ctx.fillRect(WORLD.futureLandStart - s.camX, futGroundScreenY, WORLD.width - WORLD.futureLandStart, H - futGroundScreenY);
      ctx.fillStyle = futGoldGlow ? `hsl(45 100% 65%)` : `hsl(175 80% 50%)`;
      ctx.fillRect(WORLD.futureLandStart - s.camX, futGroundScreenY, WORLD.width - WORLD.futureLandStart, 6);
      // grid
      ctx.fillStyle = futGoldGlow ? `hsl(45 100% 75% / 0.4)` : `hsl(175 80% 50% / 0.25)`;
      for (let x = WORLD.futureLandStart; x < WORLD.width; x += 32) {
        ctx.fillRect(x - s.camX, futGroundScreenY + 12, 1, H - futGroundScreenY);
      }
      for (let y = futGroundScreenY + 12; y < H; y += 24) {
        ctx.fillRect(WORLD.futureLandStart - s.camX, y, WORLD.width - WORLD.futureLandStart, 1);
      }

      // gold glow overlay on win
      if (futGoldGlow) {
        const grad = ctx.createRadialGradient(WORLD.futureLandStart + 200 - s.camX, 200, 50, WORLD.futureLandStart + 200 - s.camX, 200, 500);
        grad.addColorStop(0, "hsla(45,100%,70%,0.5)");
        grad.addColorStop(1, "hsla(45,100%,70%,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // SAGE at x=280
      drawSage(ctx, 280 - s.camX, WORLD.groundY - 56, frame);
      // ITEM BOX at x=700 — pulsing glow halo + "TRY THIS" sign for visibility
      drawChestBeacon(ctx, 700 - s.camX, WORLD.groundY - 36, frame);
      drawBox(ctx, 700 - s.camX, WORLD.groundY - 36, frame);
      drawTryThisSign(ctx, 700 - s.camX, WORLD.groundY, frame);

      // Grapple rope (drawn under player)
      if (s.grappleActive) {
        const anchorX = s.grappleAnchorX - s.camX;
        const anchorY = WORLD.groundY - 8;
        const heroX = s.px + PLAYER.w / 2 - s.camX;
        const heroY = s.py + 12;
        ctx.strokeStyle = "#e8d8a0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(heroX, heroY);
        ctx.lineTo(anchorX, anchorY);
        ctx.stroke();
        ctx.fillStyle = "#999";
        ctx.fillRect(anchorX - 3, anchorY - 3, 6, 6);
      }

      // Player
      drawPlayer(ctx, s.px - s.camX, s.py, s.facing, s.transformed, frame, s.rocketActive);

      // sparkles
      s.sparkles.forEach(p => {
        ctx.fillStyle = s.transformed ? `hsla(45,100%,70%,${p.life/20})` : `hsla(20,100%,60%,${p.life/20})`;
        ctx.fillRect(p.x - s.camX, p.y, 4, 4);
      });

      // interaction hint
      if (s.near && s.phase === "playing") {
        ctx.fillStyle = "hsl(45 95% 60%)";
        ctx.font = "10px 'Press Start 2P', monospace";
        const hint = s.near === "sage" ? "[E] TALK" : "[E] OPEN";
        ctx.fillText(hint, s.px - s.camX - 8, s.py - 10);
      }

      // Konami HUD
      if (awaitingKonamiRef.current) {
        ctx.fillStyle = "hsla(0,0%,0%,0.7)";
        ctx.fillRect(W/2 - 180, 16, 360, 38);
        ctx.strokeStyle = "hsl(45 95% 60%)";
        ctx.lineWidth = 2;
        ctx.strokeRect(W/2 - 180, 16, 360, 38);
        ctx.fillStyle = "hsl(45 95% 60%)";
        ctx.font = "10px 'Press Start 2P', monospace";
        ctx.fillText("ENTER THE SACRED SEQUENCE", W/2 - 160, 32);
        ctx.fillStyle = "hsl(175 80% 60%)";
        const symbols = ["↑","↑","↓","↓","←","→","←","→","B","A"];
        let xx = W/2 - 160;
        symbols.forEach((sym, i) => {
          ctx.fillStyle = i < konamiProgressRef.current ? "hsl(45 100% 70%)" : "hsl(230 15% 50%)";
          ctx.fillText(sym, xx, 48); xx += 32;
        });
      }

      scheduleNext();
    };

    const scheduleNext = () => { raf = requestAnimationFrame(draw); };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refs that follow latest state for canvas drawing
  const awaitingKonamiRef = useRef(false);
  const konamiProgressRef = useRef(0);
  useEffect(() => { awaitingKonamiRef.current = awaitingKonami; }, [awaitingKonami]);
  useEffect(() => { konamiProgressRef.current = konamiProgress; }, [konamiProgress]);

  const start = () => {
    setPhase("playing");
    stateRef.current.phase = "playing";
    canvasRef.current?.focus();
    initAudio();
    startMusic();
  };

  const equipItem = (kind: ItemKind) => {
    setEquipped(kind);
    setShowItemBox(false);
    playSfx("pickup");
    addBubble({ speaker: "narrator", text: `Equipped: ${kind.toUpperCase()}. Press SPACE to leap.` }, { duration: 2100 });
  };

  // cleanup music on unmount
  useEffect(() => () => { stopMusic(); }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-[960px] mx-auto">
      <div className="relative rounded-md overflow-hidden border-4 border-foreground/80 shadow-[8px_8px_0_hsl(0_0%_0%/0.6)] bg-chasm">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-auto pixelated block"
          tabIndex={0}
        />

        {/* Intro overlay */}
        {phase === "intro" && (
          <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center text-center p-6 gap-4">
            <h1 className="font-pixel text-2xl md:text-4xl text-gold text-glow-gold">THE IMPOSSIBLE CHASM</h1>
            <p className="font-pixel-body text-2xl text-foreground max-w-md">
              A medieval hero. A bottomless rift. A shining future just out of reach.
            </p>
            <div className="font-pixel-body text-xl text-muted-foreground space-y-1">
              <p>← → or A/D to move</p>
              <p>SPACE to jump · E to interact</p>
            </div>
            <button onClick={start} className="font-pixel text-xs px-6 py-3 bg-gold text-primary-foreground border-4 border-foreground shadow-[4px_4px_0_hsl(0_0%_0%/0.6)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_hsl(0_0%_0%/0.6)] transition-transform">
              BEGIN QUEST
            </button>
          </div>
        )}

        {/* Win overlay */}
        {phase === "win" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 gap-4 bg-gradient-to-b from-transparent to-background/60 animate-flicker">
            <h2 className="font-pixel text-3xl md:text-5xl text-gold text-glow-gold animate-gold-pulse">YOU MADE IT</h2>
            <p className="font-pixel-body text-2xl text-foreground">The future welcomes you, hero.</p>
            <button onClick={() => window.location.reload()} className="font-pixel text-xs px-6 py-3 bg-secondary text-primary-foreground border-4 border-foreground shadow-[4px_4px_0_hsl(0_0%_0%/0.6)]">
              PLAY AGAIN
            </button>
          </div>
        )}

        {/* Item box modal */}
        {showItemBox && (
          <div className="absolute inset-0 bg-background/85 flex items-center justify-center p-4">
            <div className="bg-card border-4 border-foreground p-5 max-w-md w-full shadow-[6px_6px_0_hsl(0_0%_0%/0.6)]">
              <h3 className="font-pixel text-sm text-gold mb-4 text-center">CHOOSE THINE TOOL</h3>
              <div className="grid gap-3">
                {([
                  { k: "spring" as ItemKind, n: "SPRINGBOARD", d: "A coiled platform that propels you skyward when you jump." },
                  { k: "rocket" as ItemKind, n: "BACK ROCKET", d: "Strap-on thruster that ignites on jump and rockets you forward at great speed." },
                  { k: "grapple" as ItemKind, n: "GRAPPLING HOOK", d: "Sturdy hook on a long rope. Throw it forward and swing across." },
                ]).map((it) => (
                  <button key={it.k} onClick={() => equipItem(it.k)}
                    className="text-left p-3 bg-muted border-2 border-border hover:border-gold hover:bg-popover transition-colors">
                    <div className="font-pixel text-xs text-secondary mb-1">{it.n}</div>
                    <div className="font-pixel-body text-lg text-muted-foreground">{it.d}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowItemBox(false)} className="font-pixel-body text-lg mt-4 w-full text-center text-muted-foreground hover:text-foreground">close</button>
            </div>
          </div>
        )}

        {/* Speech bubbles stacked top */}
        <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 pointer-events-none">
          {bubbles.map((b) => (
            <div key={b.id} className={`speech-bubble font-pixel-body text-xl max-w-[80%] animate-fade-in ${b.speaker === "sage" ? "" : b.speaker === "hero" ? "ml-auto" : "mx-auto bg-card"}`}>
              <div className="font-pixel text-[10px] mb-1 opacity-70">
                {b.speaker === "sage" ? "SAGE" : b.speaker === "hero" ? "HERO" : "✦"}
              </div>
              {b.text}
            </div>
          ))}
        </div>

        {/* Status bar */}
        {phase !== "intro" && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between font-pixel text-[10px] text-foreground bg-background/70 px-3 py-2 border-2 border-border">
            <span>ITEM: <span className="text-gold">{equipped.toUpperCase()}</span></span>
            <span>{transformed ? <span className="text-gold animate-flicker">★ TRACKSUIT ★</span> : "STATUS: MORTAL"}</span>
            <span>FAILS: <span className="text-accent">{attemptCount}</span></span>
            <span>{attemptCount > 0 ? <span className="text-gold">TOME: OPEN</span> : "TOME: SEALED"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------- sprite drawers (chunky pixel art via rects) -------- */

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, transformed: boolean, frame: number, rocket: boolean) {
  const px = (col: string, dx: number, dy: number, w = 1, h = 1) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x + dx * 4), Math.round(y + dy * 4), w * 4, h * 4);
  };
  const bob = Math.floor(frame / 8) % 2;
  // Skin
  const skin = "#f4c8a0";
  const hair = "#3a2410";
  const tunic = transformed ? "#6b3df5" : "#7a2828";
  const trim = transformed ? "#f5e642" : "#c9a24a";
  const pants = transformed ? "#1a1a1a" : "#2a3050";
  const boot = "#241810";
  // Head
  for (let i = 0; i < 4; i++) px(skin, 2 + i, 0 + bob);
  px(skin, 2, 1 + bob); px(skin, 5, 1 + bob);
  for (let i = 0; i < 4; i++) px(skin, 2 + i, 2 + bob);
  // hair
  for (let i = 0; i < 4; i++) px(hair, 2 + i, -1 + bob);
  px(hair, 1, 0 + bob); px(hair, 6, 0 + bob);
  // eyes
  px("#1a1a1a", facing > 0 ? 4 : 3, 1 + bob);
  // body / tunic
  for (let r = 3; r <= 5; r++) for (let c = 1; c <= 6; c++) px(tunic, c, r + bob);
  // belt
  for (let c = 1; c <= 6; c++) px(trim, c, 5 + bob);
  // arms
  px(skin, 0, 4 + bob); px(skin, 0, 5 + bob);
  px(skin, 7, 4 + bob); px(skin, 7, 5 + bob);
  // pants
  for (let r = 6; r <= 8; r++) { px(pants, 2, r + bob); px(pants, 3, r + bob); px(pants, 4, r + bob); px(pants, 5, r + bob); }
  // boots
  px(boot, 2, 9 + bob); px(boot, 3, 9 + bob); px(boot, 4, 9 + bob); px(boot, 5, 9 + bob);
  // tracksuit stripes
  if (transformed) {
    px("#f5e642", 2, 6 + bob); px("#f5e642", 5, 6 + bob);
    px("#f5e642", 2, 7 + bob); px("#f5e642", 5, 7 + bob);
    // glow halo
    ctx.fillStyle = "hsla(45,100%,70%,0.25)";
    ctx.beginPath(); ctx.arc(x + 16, y + 22, 28, 0, Math.PI * 2); ctx.fill();
  }
  // rocket sprite on back
  if (rocket) {
    px("#cccccc", facing > 0 ? -1 : 8, 3); px("#cccccc", facing > 0 ? -1 : 8, 4);
    px("#ff5522", facing > 0 ? -2 : 9, 4);
  }
}

function drawSage(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const px = (col: string, dx: number, dy: number) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * 4), Math.round(y + dy * 4), 4, 4); };
  const robe = "#3b2f6b"; const trim = "#d4af37"; const beard = "#e8e8e8"; const skin = "#e8c89a";
  const flick = Math.floor(frame / 20) % 2;
  // hat (pointy)
  px(robe, 3, -2); px(robe, 2, -1); px(robe, 3, -1); px(robe, 4, -1);
  for (let i = 1; i <= 5; i++) px(robe, i, 0);
  px(trim, 2, 0); px(trim, 4, 0);
  // face
  for (let i = 2; i <= 4; i++) px(skin, i, 1);
  px("#000", 2, 1); px("#000", 4, 1);
  // beard
  for (let r = 2; r <= 4; r++) for (let c = 1; c <= 5; c++) px(beard, c, r);
  // robe
  for (let r = 5; r <= 10; r++) for (let c = 0; c <= 6; c++) px(robe, c, r);
  // trim
  for (let c = 0; c <= 6; c++) px(trim, c, 10);
  px(trim, 0, 7); px(trim, 6, 7);
  // staff with flickering orb
  px("#5c3a1e", 7, 2); px("#5c3a1e", 7, 3); px("#5c3a1e", 7, 4); px("#5c3a1e", 7, 5); px("#5c3a1e", 7, 6); px("#5c3a1e", 7, 7); px("#5c3a1e", 7, 8);
  const orb = flick ? "#fff7a0" : "#f5c542";
  px(orb, 7, 1); px(orb, 8, 2); px(orb, 6, 2);
}

function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const px = (col: string, dx: number, dy: number) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + dx * 4), Math.round(y + dy * 4), 4, 4); };
  const wood = "#8a5a2b"; const dark = "#4a2f15"; const metal = "#c9a24a";
  const flick = Math.floor(frame / 15) % 2 ? "#fff7a0" : "#f5c542";
  for (let r = 0; r <= 6; r++) for (let c = 0; c <= 8; c++) px(wood, c, r);
  for (let c = 0; c <= 8; c++) { px(dark, c, 0); px(dark, c, 6); }
  for (let r = 0; r <= 6; r++) { px(dark, 0, r); px(dark, 8, r); }
  // metal bands
  for (let c = 0; c <= 8; c++) { px(metal, c, 2); px(metal, c, 4); }
  // glow
  px(flick, 4, 3); px(flick, 4, 1);
}

function drawChestBeacon(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  // Pulsing radial glow behind the chest
  const cx = x + 18;
  const cy = y + 14;
  const pulse = 0.55 + 0.35 * Math.sin(frame / 8);
  const r = 70 + Math.sin(frame / 10) * 8;
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
  grad.addColorStop(0, `hsla(45, 100%, 70%, ${0.85 * pulse})`);
  grad.addColorStop(0.5, `hsla(45, 100%, 60%, ${0.35 * pulse})`);
  grad.addColorStop(1, "hsla(45, 100%, 50%, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Sparkle pixels orbiting the chest
  for (let i = 0; i < 4; i++) {
    const a = frame / 12 + (i * Math.PI) / 2;
    const sx = Math.round(cx + Math.cos(a) * 26);
    const sy = Math.round(cy + Math.sin(a) * 14);
    ctx.fillStyle = i % 2 ? "#fff7a0" : "#f5c542";
    ctx.fillRect(sx, sy, 3, 3);
  }
}

function drawTryThisSign(ctx: CanvasRenderingContext2D, x: number, groundY: number, frame: number) {
  // Wooden sign post just to the right of the chest with arrow pointing left at it
  const bob = Math.sin(frame / 14) * 1;
  const postX = Math.round(x + 60);
  const postTop = Math.round(groundY - 70 + bob);
  // Post
  ctx.fillStyle = "#5c3a1e";
  ctx.fillRect(postX + 10, postTop + 30, 6, 40);
  // Sign board
  ctx.fillStyle = "#8a5a2b";
  ctx.fillRect(postX - 4, postTop, 56, 34);
  ctx.fillStyle = "#4a2f15";
  ctx.fillRect(postX - 4, postTop, 56, 3);
  ctx.fillRect(postX - 4, postTop + 31, 56, 3);
  ctx.fillRect(postX - 4, postTop, 3, 34);
  ctx.fillRect(postX + 49, postTop, 3, 34);
  // Text "TRY THIS"
  ctx.fillStyle = "#fff7a0";
  ctx.font = 'bold 9px "Press Start 2P", monospace';
  ctx.textBaseline = "top";
  ctx.fillText("TRY", postX + 6, postTop + 6);
  ctx.fillText("THIS", postX + 4, postTop + 18);
  // Arrow pointing left toward chest, blinking
  if (Math.floor(frame / 15) % 2 === 0) {
    const ay = postTop + 50;
    ctx.fillStyle = "#f5c542";
    // shaft
    ctx.fillRect(postX - 28, ay, 32, 4);
    // arrowhead
    ctx.beginPath();
    ctx.moveTo(postX - 36, ay + 2);
    ctx.lineTo(postX - 22, ay - 6);
    ctx.lineTo(postX - 22, ay + 10);
    ctx.closePath();
    ctx.fill();
  }
}