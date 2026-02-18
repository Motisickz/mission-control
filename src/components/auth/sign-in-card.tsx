"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SHARED_CONTACT_IDENTIFIER = "contact@hedayatmusic.com";
const SHARED_CONTACT_PERSONAS = [
  { value: "louise", label: "Louise" },
  { value: "anissa", label: "Anissa" },
] as const;

type SharedContactPersona = (typeof SHARED_CONTACT_PERSONAS)[number]["value"];
const SHARED_CONTACT_AUTH_IDENTIFIERS: Record<SharedContactPersona, string> = {
  louise: "contact+louise@hedayatmusic.com",
  anissa: "contact+anissa@hedayatmusic.com",
};

export function SignInCard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialMode = useMemo(() => {
    const modeParam = searchParams.get("mode");
    const code = searchParams.get("code");
    if (modeParam === "reset-verification" || code) return "resetVerification";
    return "signIn";
  }, [searchParams]);

  const [mode, setMode] = useState<"signIn" | "signUp" | "reset" | "resetVerification">(initialMode);
  const [pending, setPending] = useState(false);
  const { signIn } = useAuthActions();
  const upsertSharedContactPasswords = useAction(api.sharedAuth.upsertSharedContactPasswords);
  const resetStatus = useQuery(api.authStatus.passwordResetStatus);
  const resetKnown = resetStatus !== undefined;
  const resetEnabled = resetStatus?.enabled ?? false;

  const [resetEmail, setResetEmail] = useState(() => searchParams.get("email") ?? "");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [sharedPersona, setSharedPersona] = useState<SharedContactPersona | "">("");

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    const code = searchParams.get("code");
    if (modeParam === "reset-verification" || code) {
      setMode("resetVerification");
      const emailParam = searchParams.get("email");
      if (emailParam) setResetEmail(emailParam);
    }
  }, [searchParams]);

  const formatErrorMessage = (rawMessage: string, flow: "signIn" | "signUp") => {
    const message = rawMessage.toLowerCase();
    if (message.includes("invalid credentials")) {
      return flow === "signIn"
        ? "Identifiant ou mot de passe incorrect."
        : "Ce compte existe déjà. Utilise \"Se connecter\".";
    }
    if (message.includes("invalidaccountid") || message.includes("invalid account id")) {
      return flow === "signIn"
        ? "Ce profil n'existe pas encore. Clique \"Créer un compte\" avec le même identifiant, puis choisis Louise ou Anissa."
        : "Impossible de créer ce profil. Vérifie l'identifiant et réessaie.";
    }
    if (message.includes("already exists")) {
      return "Ce compte existe déjà. Utilise \"Se connecter\".";
    }
    if (message.includes("password") && message.includes("8")) {
      return "Le mot de passe doit contenir au moins 8 caractères.";
    }
    if (message.includes("rate")) {
      return "Trop de tentatives. Réessaie dans quelques instants.";
    }
    return rawMessage;
  };

  const normalizeIdentifier = (identifier: string) => identifier.trim().toLowerCase();
  const isSharedContact = (identifier: string) => normalizeIdentifier(identifier) === SHARED_CONTACT_IDENTIFIER;
  const resolveAuthIdentifier = (
    identifier: string,
    persona: SharedContactPersona | "",
  ) => {
    if (!isSharedContact(identifier)) return identifier;
    if (!persona) return null;
    return SHARED_CONTACT_AUTH_IDENTIFIERS[persona];
  };
  const loginIsSharedContact = isSharedContact(loginIdentifier);

  const submitPasswordFlow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const identifierRaw = loginIdentifier || String(formData.get("email") ?? "");
    const normalizedIdentifier = normalizeIdentifier(identifierRaw);
    const sharedContactFlow = isSharedContact(normalizedIdentifier);
    const authIdentifier = resolveAuthIdentifier(normalizedIdentifier, sharedPersona);
    if (!authIdentifier) {
      toast.error("Choisis d'abord si tu es Louise ou Anissa.");
      return;
    }
    formData.set("email", authIdentifier);

    if (mode === "signUp") {
      const password = String(formData.get("password") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");
      if (password !== confirmPassword) {
        toast.error("Les mots de passe ne correspondent pas.");
        return;
      }
    }

    setPending(true);
    try {
      const isSignUpFlow = mode === "signUp";
      let authFlow: "signIn" | "signUp" = isSignUpFlow ? "signUp" : "signIn";
      if (sharedContactFlow && isSignUpFlow) {
        await upsertSharedContactPasswords({
          identifier: normalizedIdentifier,
          password: String(formData.get("password") ?? ""),
        });
        authFlow = "signIn";
      }
      formData.set("flow", authFlow);
      await signIn("password", formData);
      router.push("/missions");
    } catch (error) {
      const rawMessage =
        error instanceof Error && error.message
          ? error.message
          : "Connexion impossible.";
      toast.error(formatErrorMessage(rawMessage, mode === "signUp" ? "signUp" : "signIn"));
    } finally {
      setPending(false);
    }
  };

  const requestPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identifier = normalizeIdentifier(resetEmail);
    if (!identifier) {
      toast.error("Entre ton identifiant.");
      return;
    }
    if (isSharedContact(identifier)) {
      toast.error("Réinitialisation indisponible pour le compte partagé contact. Passe par l'admin.");
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("flow", "reset");
      formData.set("email", identifier);
      // On inclut l'email dans l'URL pour pré-remplir le formulaire.
      formData.set("redirectTo", `/connexion?mode=reset-verification&email=${encodeURIComponent(identifier)}`);
      await signIn("password", formData);
      toast.success("Si ce compte utilise un email réel, le lien de réinitialisation a été envoyé.");
      setMode("signIn");
    } catch {
      // On ne veut pas divulguer si le compte existe ou non.
      toast.success("Si ce compte utilise un email réel, le lien de réinitialisation a été envoyé.");
      setMode("signIn");
    } finally {
      setPending(false);
    }
  };

  const verifyResetAndChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = searchParams.get("code") ?? "";
    const identifier = normalizeIdentifier(resetEmail);
    if (!code) {
      toast.error("Lien invalide: code manquant.");
      return;
    }
    if (!identifier) {
      toast.error("Entre ton identifiant.");
      return;
    }
    if (isSharedContact(identifier)) {
      toast.error("Réinitialisation indisponible pour le compte partagé contact. Passe par l'admin.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    try {
      const formData = new FormData();
      formData.set("flow", "reset-verification");
      formData.set("email", identifier);
      formData.set("code", code);
      formData.set("newPassword", newPassword);
      await signIn("password", formData);
      router.replace("/missions");
    } catch (error) {
      const rawMessage =
        error instanceof Error && error.message ? error.message : "Impossible de changer le mot de passe.";
      const msg = rawMessage.toLowerCase().includes("invalid code") || rawMessage.toLowerCase().includes("could not verify")
        ? "Code invalide ou expiré. Recommence la procédure."
        : rawMessage;
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border/70 bg-card/95">
      <CardHeader>
        <CardTitle>
          {mode === "signIn"
            ? "Connexion"
            : mode === "signUp"
              ? "Créer un compte"
              : mode === "reset"
                ? "Mot de passe oublié"
                : "Nouveau mot de passe"}
        </CardTitle>
        <CardDescription>
          {mode === "reset" || mode === "resetVerification"
            ? "Réinitialisation: privilégie un compte avec email réel."
            : "Utilise un identifiant unique (email ou pseudo)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "reset" ? (
          <form className="space-y-4" onSubmit={requestPasswordReset}>
            <div className="space-y-2">
              <Label htmlFor="resetEmail">Identifiant</Label>
              <Input
                id="resetEmail"
                type="text"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <Button className="w-full" type="submit" disabled={pending || !resetKnown || !resetEnabled}>
              {pending ? "Envoi..." : !resetKnown ? "Chargement..." : "Envoyer le lien"}
            </Button>
            {resetKnown && !resetEnabled ? (
              <p className="text-xs text-muted-foreground">
                Réinitialisation non configurée (clé email manquante côté serveur).
              </p>
            ) : null}
            <Button
              className="w-full"
              type="button"
              variant="ghost"
              onClick={() => setMode("signIn")}
              disabled={pending}
            >
              Retour
            </Button>
          </form>
        ) : mode === "resetVerification" ? (
          <form className="space-y-4" onSubmit={verifyResetAndChangePassword}>
            <div className="space-y-2">
              <Label htmlFor="resetEmailVerify">Identifiant</Label>
              <Input
                id="resetEmailVerify"
                type="text"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoComplete="username"
              />
              <p className="text-xs text-muted-foreground">
                Astuce: utilise exactement le même identifiant que celui du compte.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>

            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Mise à jour..." : "Changer mon mot de passe"}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={submitPasswordFlow}>
            <div className="space-y-2">
              <Label htmlFor="email">Identifiant de connexion</Label>
              <Input
                id="email"
                name="email"
                type="text"
                required
                autoComplete="username"
                value={loginIdentifier}
                onChange={(event) => {
                  setLoginIdentifier(event.target.value);
                  if (!isSharedContact(event.target.value)) {
                    setSharedPersona("");
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">Exemples: viaultaliceav@gmail.com, louise, anissa</p>
            </div>
            {loginIsSharedContact ? (
              <div className="space-y-2">
                <Label>Vous êtes</Label>
                <Select
                  value={sharedPersona}
                  onValueChange={(value) => setSharedPersona(value as SharedContactPersona)}
                  disabled={pending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir Louise ou Anissa" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHARED_CONTACT_PERSONAS.map((persona) => (
                      <SelectItem key={persona.value} value={persona.value}>
                        {persona.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Compte partagé détecté: choisis ton profil avant de continuer.
                </p>
              </div>
            ) : null}
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
            {mode === "signUp" ? (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>
            ) : null}

            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Chargement..." : mode === "signIn" ? "Se connecter" : "Créer mon compte"}
            </Button>

            {mode === "signIn" ? (
              <Button
                className="w-full"
                type="button"
                variant="ghost"
                onClick={() => setMode("reset")}
                disabled={pending}
              >
                Mot de passe oublié ?
              </Button>
            ) : null}

            <Button
              className="w-full"
              type="button"
              variant="ghost"
              onClick={() => setMode((m) => (m === "signIn" ? "signUp" : "signIn"))}
              disabled={pending}
            >
              {mode === "signIn"
                ? "Pas encore de compte ? Créer un compte"
                : "Déjà un compte ? Se connecter"}
            </Button>

          </form>
        )}
      </CardContent>
    </Card>
  );
}
