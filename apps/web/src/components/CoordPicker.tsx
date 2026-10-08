import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { WheelPicker } from "@/components/WheelPicker";
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

/** Match Reader HUD mono xs row height. */
const ITEM_H = 18;
/** One value above the selection, three below. */
const ROWS_ABOVE = 1;
const ROWS_BELOW = 3;
const VISIBLE = ROWS_ABOVE + 1 + ROWS_BELOW;
const PAD_Y = 4;
const EDGE = 8;

type CoordPickerProps = {
  kind: CoordKind;
  value: number | null;
  max: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
};

type FloatPos = {
  top: number;
  left: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
};

function measureFloat(
  trigger: DOMRect,
  floatW: number,
  floatH: number,
  selectionOffsetY: number
): FloatPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Align the selected row with the clicked label; popover hangs mostly down.
  let top =
    trigger.top + trigger.height / 2 - ITEM_H / 2 - selectionOffsetY;
  let left = trigger.left + trigger.width / 2 - floatW / 2;

  top = Math.min(Math.max(EDGE, top), Math.max(EDGE, vh - floatH - EDGE));
  left = Math.min(Math.max(EDGE, left), Math.max(EDGE, vw - floatW - EDGE));

  return {
    top,
    left,
    width: floatW,
    height: floatH,
    originX: trigger.left + trigger.width / 2 - left,
    originY: trigger.top + trigger.height / 2 - top,
  };
}

export function CoordPicker({
  kind,
  value,
  max,
  disabled,
  onCommit,
}: CoordPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(1);
  const [pos, setPos] = useState<FloatPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const prefix = PREFIX[kind];
  const label = LABELS[kind];
  const display = value == null ? "—" : String(value);

  const floatW = Math.max(
    48,
    Math.ceil(`${prefix}${max}`.length * 11 + 20)
  );
  const floatH = VISIBLE * ITEM_H + PAD_Y * 2;
  const selectionOffsetY = PAD_Y + ROWS_ABOVE * ITEM_H;

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    setPos(
      measureFloat(
        el.getBoundingClientRect(),
        floatW,
        floatH,
        selectionOffsetY
      )
    );
  }, [floatW, floatH, selectionOffsetY]);

  useEffect(() => {
    if (open && value != null) setDraft(value);
  }, [open, value]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    reposition();
    const onWin = () => reposition();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open || !pos) return;
    const id = window.requestAnimationFrame(() => {
      floatRef.current
        ?.querySelector<HTMLElement>(".wheel-picker-scroller")
        ?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, pos]);

  const confirm = (next: number) => {
    setOpen(false);
    if (value == null || next !== value) onCommit(next);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || value == null}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Select ${label}`}
        className={cn(
          "coord-trigger inline-flex items-baseline rounded-sm px-0.5 font-mono text-xs uppercase tracking-[0.2em]",
          "text-[var(--muted)] transition-[color,transform,background-color] duration-200",
          "hover:text-[var(--mark)] hover:bg-[color-mix(in_srgb,var(--mark)_12%,transparent)]",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--mark)]",
          "disabled:pointer-events-none disabled:opacity-40",
          "active:scale-95",
          open && "coord-trigger--open text-[var(--mark)]"
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn(open && "opacity-0")}>
          {prefix}
          {display}
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Dismiss picker"
              className="coord-dismiss fixed inset-0 z-40 cursor-default bg-transparent"
              onClick={() => setOpen(false)}
            />
            <div
              ref={floatRef}
              role="dialog"
              aria-label={`${label} picker`}
              className="coord-float fixed z-50"
              style={
                {
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                  height: pos.height,
                  transformOrigin: `${pos.originX}px ${pos.originY}px`,
                } as CSSProperties
              }
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="sr-only">
                Scroll or tap a value to select a {label.toLowerCase()} from 1
                to {max}.
              </p>
              <WheelPicker
                value={draft}
                min={1}
                max={max}
                prefix={prefix}
                itemHeight={ITEM_H}
                rowsAbove={ROWS_ABOVE}
                rowsBelow={ROWS_BELOW}
                onChange={setDraft}
                onPick={confirm}
                className="coord-float-wheel"
              />
            </div>
          </>,
          document.body
        )}
    </>
  );
}
