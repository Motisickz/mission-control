"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

import { api } from "../../../convex/_generated/api";
import { APP_NAME, MAIN_NAV, ROLE_LABELS } from "@/lib/domain-constants";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const notifications = useQuery(api.notifications.listForCurrentUser);
  const ensureProfile = useMutation(api.profiles.ensureCurrentProfile);
  const { signOut } = useAuthActions();

  useEffect(() => {
    if (isAuthenticated && profile === null) {
      void ensureProfile({});
    }
  }, [isAuthenticated, profile, ensureProfile]);

  const unread = (notifications ?? []).filter((n) => !n.readAt).length;

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="px-4 py-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Tableau interne
              </p>
              <h1 className="font-bold text-lg leading-none">{APP_NAME}</h1>
            </div>
            <SidebarTrigger />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            {MAIN_NAV.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname === item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          <div className="mt-6 px-4">
            <Link
              href="/notifications"
              className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4" /> Notifications
              </span>
              <Badge variant="secondary">{unread}</Badge>
            </Link>
          </div>
        </SidebarContent>

        <SidebarFooter className="px-3 pb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2 truncate">
                  <UserRound className="h-4 w-4" />
                  {profile?.displayName ?? "Profil"}
                </span>
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium">{profile?.email ?? "-"}</p>
                <p className="text-muted-foreground">
                  {profile ? ROLE_LABELS[profile.role] : ""}
                </p>
              </div>
              <DropdownMenuItem
                onClick={() => {
                  void signOut();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Se deconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
          <p className="text-sm text-muted-foreground">Organisation des missions quotidiennes</p>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
