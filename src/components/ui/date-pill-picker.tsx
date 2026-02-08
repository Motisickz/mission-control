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
}: {
  name: string;
  defaultValue: string;
}) {
  const initial = useMemo(() => fromIsoDate(defaultValue), [defaultValue]);
  const [selectedDate, setSelectedDate] = useState<Date>(initial);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <input type="hidden" name={name} value={toIsoDate(selectedDate)} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-start rounded-full border-primary/25 bg-primary/5 text-left font-medium"
          >
            <CalendarDays className="mr-2 h-4 w-4 text-primary" />
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">Date</span>
            <span className="ml-2">
              {selectedDate.toLocaleDateString("fr-FR", {
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
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              setSelectedDate(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
