import { SignInCard } from "@/components/auth/sign-in-card";

export default function ConnexionPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(70rem_40rem_at_10%_10%,oklch(0.96_0.04_255),transparent),radial-gradient(50rem_30rem_at_90%_20%,oklch(0.96_0.03_40),transparent),linear-gradient(130deg,oklch(0.99_0.01_250),oklch(0.97_0.01_80))]" />
      <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-border/60 bg-background/80 p-8 backdrop-blur md:p-10">
        <div className="mb-8 max-w-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Mission controle</p>
          <h1 className="font-title mt-2 text-4xl leading-tight md:text-5xl">Organisation quotidienne des missions</h1>
          <p className="mt-3 text-muted-foreground">
            Plateforme interne pour planifier, assigner et suivre les taches de l&apos;equipe.
          </p>
        </div>
        <SignInCard />
      </div>
    </div>
  );
}
