"use client";

import { useMemo, useState } from "react";
import { Bell, BellRing, CheckCircle2, CircleAlert, Inbox, Plus, UserPlus2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type NotificationFilter = "all" | "unread" | "read";
type NotificationKind = "assigned" | "status_changed" | "overdue";

const TYPE_META: Record<
  NotificationKind,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  assigned: {
    label: "Nouvelle assignation",
    icon: UserPlus2,
    tone: "border-[color:oklch(0.87_0.08_154)] bg-[color:oklch(0.97_0.02_154)]",
  },
  status_changed: {
    label: "Mise à jour",
    icon: CheckCircle2,
    tone: "border-[color:oklch(0.88_0.08_230)] bg-[color:oklch(0.97_0.02_230)]",
  },
  overdue: {
    label: "Échéance critique",
    icon: CircleAlert,
    tone: "border-[color:oklch(0.85_0.1_28)] bg-[color:oklch(0.97_0.02_28)]",
  },
};

function formatTimeAgo(ts: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return "À l'instant";
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
  return `Il y a ${Math.floor(seconds / 86400)} j`;
}

export function NotificationsView() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [pushOpen, setPushOpen] = useState(false);
  const [pushType, setPushType] = useState<NotificationKind>("assigned");
  const [recipientProfileId, setRecipientProfileId] = useState<string>("");
  const notifications = useQuery(api.notifications.listForCurrentUser);
  const profiles = useQuery(api.profiles.listVisibleProfiles);
  const currentProfile = useQuery(api.profiles.getCurrentProfile);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const pushNotification = useMutation(api.notifications.pushNotification);

  const allNotifications = useMemo(() => notifications ?? [], [notifications]);
  const unreadCount = useMemo(
    () => allNotifications.filter((n) => !n.readAt).length,
    [allNotifications],
  );
  const readCount = allNotifications.length - unreadCount;

  const visibleNotifications = useMemo(() => {
    const sorted = [...allNotifications].sort((a, b) => b._creationTime - a._creationTime);
    if (filter === "unread") return sorted.filter((n) => !n.readAt);
    if (filter === "read") return sorted.filter((n) => !!n.readAt);
    return sorted;
  }, [allNotifications, filter]);

  const effectiveRecipientProfileId =
    recipientProfileId || currentProfile?._id || profiles?.[0]?._id || "";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BellRing className="h-5 w-5 text-primary" />
              Centre de notifications
            </CardTitle>
            <CardDescription>
              Visualise les signaux importants, traite-les vite et garde la journée fluide.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as NotificationFilter)}>
              <TabsList>
                <TabsTrigger value="all">Tout</TabsTrigger>
                <TabsTrigger value="unread">Non lues</TabsTrigger>
                <TabsTrigger value="read">Lues</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              disabled={unreadCount === 0}
              onClick={async () => {
                const result = await markAllRead({});
                toast.success(`${result.updated} notification(s) marquée(s) comme lue(s).`);
              }}
            >
              Tout marquer comme lu
            </Button>

            <Dialog open={pushOpen} onOpenChange={setPushOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Pousser une notification</DialogTitle>
                  <DialogDescription>
                    Envoie un signal ciblé dans le centre de notifications d&apos;un membre.
                  </DialogDescription>
                </DialogHeader>

                <form
                  className="grid gap-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const formEl = event.currentTarget;
                    const form = new FormData(formEl);
                    if (!effectiveRecipientProfileId) return;

                    try {
                      await pushNotification({
                        recipientProfileId: effectiveRecipientProfileId as never,
                        type: pushType,
                        title: String(form.get("title") ?? ""),
                        payload: String(form.get("payload") ?? ""),
                      });
                      toast.success("Notification envoyée.");
                      formEl.reset();
                      setRecipientProfileId("");
                      setPushType("assigned");
                      setPushOpen(false);
                    } catch (error) {
                      const message =
                        error instanceof Error ? error.message : "Impossible d'envoyer cette notification.";
                      toast.error(message);
                    }
                  }}
                >
                  <div className="space-y-1">
                    <Label>Destinataire</Label>
                    <input type="hidden" name="recipientProfileId" value={effectiveRecipientProfileId} />
                    <Select value={effectiveRecipientProfileId} onValueChange={setRecipientProfileId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un membre" />
                      </SelectTrigger>
                      <SelectContent>
                        {(profiles ?? []).map((profile) => (
                          <SelectItem key={profile._id} value={profile._id}>
                            {profile.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select value={pushType} onValueChange={(value) => setPushType(value as NotificationKind)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assigned">Nouvelle assignation</SelectItem>
                        <SelectItem value="status_changed">Mise à jour</SelectItem>
                        <SelectItem value="overdue">Échéance critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Titre</Label>
                    <Input name="title" required placeholder="Ex: Tâche prioritaire à valider" />
                  </div>

                  <div className="space-y-1">
                    <Label>Message complémentaire</Label>
                    <Textarea name="payload" placeholder="Contexte optionnel, lien, action attendue..." />
                  </div>

                  <Button type="submit" className="w-full">Envoyer la notification</Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-lg">État rapide</CardTitle>
            <CardDescription>Priorisation en un coup d&apos;œil.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Inbox className="h-4 w-4" /> Total</p>
              <p className="mt-1 text-2xl font-semibold">{allNotifications.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Bell className="h-4 w-4" /> Non lues</p>
              <p className="mt-1 text-2xl font-semibold">{unreadCount}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> Lues</p>
              <p className="mt-1 text-2xl font-semibold">{readCount}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Flux d&apos;activité</CardTitle>
          <CardDescription>Chaque notification est contextualisée pour une action immédiate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleNotifications.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground">
              Aucune notification dans cette vue.
            </p>
          ) : (
            visibleNotifications.map((notification) => {
              const type = notification.type as NotificationKind;
              const meta = TYPE_META[type];
              const Icon = meta?.icon ?? Bell;
              return (
                <article
                  key={notification._id}
                  className={cn("rounded-lg border p-4", meta?.tone ?? "border-border/70 bg-background/70")}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">{meta?.label ?? notification.type}</p>
                      <p className="text-xs text-muted-foreground">{formatTimeAgo(notification._creationTime)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={notification.readAt ? "outline" : "secondary"}>
                        {notification.readAt ? "Lue" : "À traiter"}
                      </Badge>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-1 text-xs">
                        <Icon className="h-3.5 w-3.5" />
                        {meta?.label ?? "Info"}
                      </span>
                    </div>
                  </div>

                  {!notification.readAt && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void markRead({ notificationId: notification._id })}
                      >
                        Marquer comme lue
                      </Button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
