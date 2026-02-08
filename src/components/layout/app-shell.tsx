"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, ChevronsUpDown, ClipboardList, Lightbulb, LogOut, Menu, Users, UserRound } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

import { api } from "../../../convex/_generated/api";
import { APP_NAME, MAIN_NAV, ROLE_LABELS } from "@/lib/domain-constants";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/missions": ClipboardList,
  "/calendrier": CalendarDays,
  "/profils": Users,
  "/idees": Lightbulb,
  "/notifications": Bell,
};

const NAV_ICON_TONE_CLASS: Record<string, string> = {
  "/missions": "icon-chip icon-chip-indigo",
  "/calendrier": "icon-chip icon-chip-cyan",
  "/profils": "icon-chip icon-chip-green",
  "/idees": "icon-chip icon-chip-amber",
  "/notifications": "icon-chip icon-chip-rose",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const notifications = useQuery(
    api.notifications.listForCurrentUser,
    profile ? {} : "skip",
  );
  const ensureProfile = useMutation(api.profiles.ensureCurrentProfile);
  const { signOut } = useAuthActions();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated && profile === null) {
      void ensureProfile({});
    }
  }, [isAuthenticated, profile, ensureProfile]);

  if (isAuthenticated && profile === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Initialisation du profil...</p>
      </div>
    );
  }

  const unread = (notifications ?? []).filter((n) => !n.readAt).length;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-4">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Tableau interne</p>
        <h1 className="mt-1 text-3xl font-title leading-[0.95]">{APP_NAME}</h1>
      </div>

      <nav className="px-3 py-2">
        <ul className="space-y-1">
          {MAIN_NAV.map((item) => {
            const Icon = NAV_ICONS[item.href] ?? ClipboardList;
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[18px] font-medium leading-none transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-foreground/88 hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <span className={cn(NAV_ICON_TONE_CLASS[item.href], active && "icon-chip-active")}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-3 px-5 pb-5">
        <Link
          href="/notifications"
          className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-3 py-3"
          onClick={() => setMobileOpen(false)}
        >
          <span className="flex items-center gap-2 text-sm">
            <span className="icon-chip icon-chip-rose">
              <Bell className="h-3.5 w-3.5" />
            </span>
            Notifications
          </span>
          <Badge variant="secondary">{unread}</Badge>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between rounded-xl">
              <span className="flex items-center gap-2 truncate">
                <span className="icon-chip icon-chip-violet">
                  <UserRound className="h-3.5 w-3.5" />
                </span>
                {profile?.displayName ?? "Profil"}
              </span>
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-2 py-1.5 text-sm">
              <p className="font-medium">{profile?.email ?? "-"}</p>
                <p className="text-muted-foreground">{profile ? ROLE_LABELS[profile.role] : ""}</p>
              </div>
              <DropdownMenuItem
                onClick={() => {
                  void signOut();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[19rem_1fr]">
      <aside className="hidden border-r border-border/70 bg-sidebar md:block">{sidebarContent}</aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[19rem] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              {sidebarContent}
            </SheetContent>
          </Sheet>

          <p className="text-sm text-muted-foreground">Organisation des missions quotidiennes</p>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
