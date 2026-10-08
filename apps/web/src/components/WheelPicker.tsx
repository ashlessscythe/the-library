import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";

type WheelPickerProps = {
  value: number;
  min: number;
  max: number;
  /** Prefix shown before the number, e.g. "W" */
  prefix?: string;
  /** Row height in px — keep in sync with HUD text size for compact mode. */
  itemHeight?: number;
  /** Odd number of visible rows (3 keeps the float tiny). */
  visibleRows?: number;
  onChange: (value: number) => void;
  /** Fired when the user explicitly taps a row (good moment to commit). */
  onPick?: (value: number) => void;
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function WheelPicker({
  value,
  min,
  max,
  prefix = "",
  itemHeight = 20,
  visibleRows = 3,
  onChange,
  onPick,
  className,
}: WheelPickerProps) {
  const uid = useId();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settling = useRef(false);
  const scrollEndTimer = useRef<number | null>(null);
  const [active, setActive] = useState(() => clamp(value, min, max));
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const pad = Math.floor(visibleRows / 2) * itemHeight;

  const scrollToValue = useCallback(
    (v: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollerRef.current;
      if (!el) return;
      const idx = clamp(v, min, max) - min;
      settling.current = true;
      el.scrollTo({ top: idx * itemHeight, behavior });
      window.setTimeout(() => {
        settling.current = false;
      }, behavior === "smooth" ? 280 : 0);
    },
    [min, max, itemHeight]
  );

  useLayoutEffect(() => {
    const next = clamp(value, min, max);
    setActive(next);
    scrollToValue(next, "instant");
  }, [value, min, max, scrollToValue]);

  const commitFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemHeight);
    const next = clamp(min + idx, min, max);
    setActive(next);
    if (Math.abs(el.scrollTop - idx * itemHeight) > 0.5) {
      el.scrollTo({ top: idx * itemHeight, behavior: "smooth" });
    }
    if (next !== value) onChange(next);
  }, [min, max, itemHeight, onChange, value]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / itemHeight);
    setActive(clamp(min + idx, min, max));
    if (scrollEndTimer.current != null) {
      window.clearTimeout(scrollEndTimer.current);
    }
    scrollEndTimer.current = window.setTimeout(() => {
      if (!settling.current) commitFromScroll();
    }, 90);
  };

  useEffect(() => {
    return () => {
      if (scrollEndTimer.current != null) {
        window.clearTimeout(scrollEndTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = clamp(active - 1, min, max);
        setActive(next);
        scrollToValue(next);
        onChange(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = clamp(active + 1, min, max);
        setActive(next);
        scrollToValue(next);
        onChange(next);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onPick?.(active);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [active, min, max, onChange, onPick, scrollToValue]);

  return (
    <div
      className={cn("wheel-picker relative select-none", className)}
      style={{ height: visibleRows * itemHeight } as CSSProperties}
    >
      <div className="wheel-picker-fade wheel-picker-fade-top" aria-hidden />
      <div className="wheel-picker-fade wheel-picker-fade-bottom" aria-hidden />
      <div
        className="wheel-picker-band"
        style={{ height: itemHeight } as CSSProperties}
        aria-hidden
      />
      <div
        ref={scrollerRef}
        className="wheel-picker-scroller h-full overflow-y-auto overscroll-contain outline-none touch-pan-y"
        tabIndex={0}
        role="listbox"
        aria-label="Value picker"
        aria-activedescendant={`${uid}-opt-${active}`}
        onScroll={onScroll}
      >
        <div style={{ height: pad }} aria-hidden />
        {values.map((n) => {
          const dist = Math.abs(n - active);
          const scale =
            dist === 0 ? 1.12 : dist === 1 ? 0.9 : 0.78;
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.18;
          return (
            <button
              key={n}
              id={`${uid}-opt-${n}`}
              type="button"
              role="option"
              aria-selected={n === active}
              className="wheel-picker-item"
              style={
                {
                  height: itemHeight,
                  transform: `scale(${scale})`,
                  opacity,
                } as CSSProperties
              }
              onClick={() => {
                setActive(n);
                scrollToValue(n);
                onChange(n);
                onPick?.(n);
              }}
            >
              <span className={cn(n === active && "text-[var(--mark)]")}>
                {prefix}
                {n}
              </span>
            </button>
          );
        })}
        <div style={{ height: pad }} aria-hidden />
      </div>
    </div>
  );
}
