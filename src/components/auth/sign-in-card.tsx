"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInCard() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [pending, setPending] = useState(false);
  const { signIn } = useAuthActions();
  const router = useRouter();

  return (
    <Card className="w-full max-w-md border-border/70 bg-card/95">
      <CardHeader>
        <CardTitle>{mode === "signIn" ? "Connexion" : "Créer un compte"}</CardTitle>
          <CardDescription>
            Authentification Convex avec email et mot de passe.
          </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            formData.set("flow", mode);
            setPending(true);
            try {
              await signIn("password", formData);
              router.push("/missions");
            } catch (error) {
              const rawMessage =
                error instanceof Error && error.message
                  ? error.message
                  : "Connexion impossible.";
              const message =
                rawMessage === "Invalid credentials"
                  ? "Identifiants invalides ou compte déjà existant. Essaie \"Se connecter\"."
                  : rawMessage;
              toast.error(message);
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            />
          </div>

          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Chargement..." : mode === "signIn" ? "Se connecter" : "Créer mon compte"}
          </Button>

          <Button
            className="w-full"
            type="button"
            variant="ghost"
            onClick={() => setMode((m) => (m === "signIn" ? "signUp" : "signIn"))}
          >
            {mode === "signIn"
              ? "Pas encore de compte ? Créer un compte"
              : "Déjà un compte ? Se connecter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
