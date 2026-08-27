import ChasmQuest from "@/components/game/ChasmQuest";

const Index = () => {
  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* scanlines */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-20 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, hsl(0 0% 0% / 0.6) 0 2px, transparent 2px 4px)",
        }}
      />
      <div className="relative z-10 container py-10 md:py-16 flex flex-col items-center gap-8">
        <header className="text-center max-w-2xl">
          <p className="font-pixel text-[10px] text-secondary tracking-widest mb-3">
            ★ AN 8-BIT DEMO ★
          </p>
          <h1 className="font-pixel text-xl md:text-3xl text-gold text-glow-gold leading-tight">
            THE IMPOSSIBLE CHASM
          </h1>
          <p className="font-pixel-body text-2xl text-muted-foreground mt-3">
            Cross from the medieval realm to the shining future. If you can.
          </p>
        </header>

        <ChasmQuest />

        <footer className="font-pixel-body text-xl text-muted-foreground text-center max-w-xl">
          <p>Hint: speak to the sage… but only after you have tried.</p>
        </footer>
      </div>
    </main>
  );
};

export default Index;
