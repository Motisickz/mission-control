import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CreateCardInlineProps = {
  onCreate: (title: string) => Promise<void> | void;
  openSignal?: number;
};

export function CreateCardInline({ onCreate, openSignal = 0 }: CreateCardInlineProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lastOpenSignal = useRef(openSignal);

  useEffect(() => {
    if (openSignal === lastOpenSignal.current) return;
    lastOpenSignal.current = openSignal;
    setOpen(true);
  }, [openSignal]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-8 w-full justify-start rounded-lg text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Ajouter une carte
      </Button>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const value = title.trim();
        if (!value) return;

        try {
          setSubmitting(true);
          await onCreate(value);
          setTitle("");
          setOpen(false);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titre de la carte"
        disabled={submitting}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={submitting || title.trim().length === 0}>
          Ajouter
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={submitting}
          onClick={() => {
            setOpen(false);
            setTitle("");
          }}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
