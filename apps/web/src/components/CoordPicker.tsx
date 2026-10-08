import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { WheelPicker } from "@/components/WheelPicker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CoordKind = "wall" | "shelf" | "book" | "page";

const LABELS: Record<CoordKind, string> = {
  wall: "Wall",
  shelf: "Shelf",
  book: "Book",
  page: "Page",
};

const PREFIX: Record<CoordKind, string> = {
  wall: "W",
  shelf: "S",
  book: "B",
  page: "P",
};

type CoordPickerProps = {
  kind: CoordKind;
  value: number | null;
  max: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
};

export function CoordPicker({
  kind,
  value,
  max,
  disabled,
  onCommit,
}: CoordPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(1);
  const prefix = PREFIX[kind];
  const label = LABELS[kind];
  const display = value == null ? "—" : String(value);

  useEffect(() => {
    if (open && value != null) setDraft(value);
  }, [open, value]);

  const confirm = (next: number) => {
    setOpen(false);
    if (value == null || next !== value) onCommit(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={disabled || value == null}
          className={cn(
            "coord-trigger inline-flex items-baseline rounded-sm px-0.5 font-mono text-xs uppercase tracking-[0.2em]",
            "text-[var(--muted)] transition-[color,transform,background-color] duration-200",
            "hover:text-[var(--mark)] hover:bg-[color-mix(in_srgb,var(--mark)_12%,transparent)]",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mark)]",
            "disabled:pointer-events-none disabled:opacity-40",
            "active:scale-95"
          )}
          aria-label={`Select ${label}`}
        >
          {prefix}
          {display}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="coord-overlay fixed inset-0 z-50 bg-black/55" />
        <Dialog.Content
          className="coord-sheet fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-sm outline-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:px-4"
          onOpenAutoFocus={(e) => {
            // Focus the wheel scroller, not the close chrome.
            e.preventDefault();
            const wheel = document.querySelector<HTMLElement>(
              ".coord-sheet .wheel-picker-scroller"
            );
            wheel?.focus();
          }}
        >
          <div className="border border-[var(--line)] bg-[var(--panel)] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] sm:shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <Dialog.Title className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                {label}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Scroll or tap to choose a {label.toLowerCase()} from 1 to {max}.
              </Dialog.Description>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--dim)] transition-colors hover:text-[var(--fg)]"
                >
                  Cancel
                </button>
              </Dialog.Close>
            </div>

            <div className="px-6 py-5">
              <WheelPicker
                value={draft}
                min={1}
                max={max}
                prefix={prefix}
                onChange={setDraft}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
              <Button
                type="button"
                size="sm"
                variant="mark"
                onClick={() => confirm(draft)}
              >
                Open {prefix}
                {draft}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
