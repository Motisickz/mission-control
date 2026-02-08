"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NotificationsView() {
  const notifications = useQuery(api.notifications.listForCurrentUser);
  const markRead = useMutation(api.notifications.markRead);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Centre de notifications</CardTitle>
        <CardDescription>Suivi des assignations et changements de statut.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(notifications ?? []).map((notification) => (
          <div key={notification._id} className="rounded-md border border-border/70 p-3">
            <p className="font-medium">{notification.title}</p>
            <p className="text-xs text-muted-foreground">Type: {notification.type}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={!!notification.readAt}
              onClick={() => void markRead({ notificationId: notification._id })}
            >
              {notification.readAt ? "Lue" : "Marquer comme lue"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
