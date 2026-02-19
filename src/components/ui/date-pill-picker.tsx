"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function fromIsoDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DatePillPicker({
  name,
  defaultValue,
  value,
  onValueChange,
  compact,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (nextValue: string) => void;
  compact?: boolean;
}) {
  const fallbackValue = defaultValue ?? value ?? new Date().toISOString().slice(0, 10);
  const initial = useMemo(() => fromIsoDate(fallbackValue), [fallbackValue]);
  const [selectedDate, setSelectedDate] = useState<Date>(initial);
  const [open, setOpen] = useState(false);
  const controlledDate = value ? fromIsoDate(value) : undefined;
  const activeDate = controlledDate ?? selectedDate;
  const activeValue = toIsoDate(activeDate);

  return (
    <div>
      {name ? <input type="hidden" name={name} value={activeValue} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={
              compact
                ? "h-10 w-full justify-start gap-2 rounded-full border-primary/25 bg-primary/5 px-3 text-left font-medium"
                : "h-10 w-full justify-start rounded-full border-primary/25 bg-primary/5 text-left font-medium"
            }
          >
            <CalendarDays className={compact ? "h-4 w-4 text-primary" : "mr-2 h-4 w-4 text-primary"} />
            {compact ? null : <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">Date</span>}
            <span className={compact ? "" : "ml-2"}>
              {activeDate.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <Calendar
            mode="single"
            selected={activeDate}
            onSelect={(date) => {
              if (!date) return;
              if (!value) {
                setSelectedDate(date);
              }
              onValueChange?.(toIsoDate(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
