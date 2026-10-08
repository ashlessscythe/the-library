import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { cn } from "@/lib/utils";

const ITEM_H = 36;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;

type WheelPickerProps = {
  value: number;
  min: number;
  max: number;
  /** Prefix shown before the number, e.g. "W" */
  prefix?: string;
  onChange: (value: number) => void;
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
  onChange,
  className,
}: WheelPickerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settling = useRef(false);
  const scrollEndTimer = useRef<number | null>(null);
  const [active, setActive] = useState(() => clamp(value, min, max));
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const scrollToValue = useCallback(
    (v: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollerRef.current;
      if (!el) return;
      const idx = clamp(v, min, max) - min;
      settling.current = true;
      el.scrollTo({ top: idx * ITEM_H, behavior });
      window.setTimeout(() => {
        settling.current = false;
      }, behavior === "smooth" ? 320 : 0);
    },
    [min, max]
  );

  useLayoutEffect(() => {
    const next = clamp(value, min, max);
    setActive(next);
    scrollToValue(next, "instant");
  }, [value, min, max, scrollToValue]);

  const commitFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const next = clamp(min + idx, min, max);
    setActive(next);
    // Snap exactly onto the item.
    if (Math.abs(el.scrollTop - idx * ITEM_H) > 0.5) {
      el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
    }
    if (next !== value) onChange(next);
  }, [min, max, onChange, value]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
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

  // Keyboard: ↑/↓ while focused on the wheel.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = clamp(active - 1, min, max);
        scrollToValue(next);
        onChange(next);
        setActive(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = clamp(active + 1, min, max);
        scrollToValue(next);
        onChange(next);
        setActive(next);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [active, min, max, onChange, scrollToValue]);

  return (
    <div
      className={cn("wheel-picker relative select-none", className)}
      style={{ height: VISIBLE * ITEM_H } as CSSProperties}
    >
      <div className="wheel-picker-fade wheel-picker-fade-top" aria-hidden />
      <div className="wheel-picker-fade wheel-picker-fade-bottom" aria-hidden />
      <div className="wheel-picker-band" aria-hidden />
      <div
        ref={scrollerRef}
        className="wheel-picker-scroller h-full overflow-y-auto outline-none"
        tabIndex={0}
        role="listbox"
        aria-label="Value picker"
        aria-activedescendant={`wheel-opt-${active}`}
        onScroll={onScroll}
      >
        <div style={{ height: PAD }} aria-hidden />
        {values.map((n) => {
          const dist = Math.abs(n - active);
          const scale = dist === 0 ? 1.18 : dist === 1 ? 0.92 : dist === 2 ? 0.78 : 0.68;
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.28 : 0.12;
          return (
            <button
              key={n}
              id={`wheel-opt-${n}`}
              type="button"
              role="option"
              aria-selected={n === active}
              className="wheel-picker-item"
              style={
                {
                  height: ITEM_H,
                  transform: `scale(${scale})`,
                  opacity,
                } as CSSProperties
              }
              onClick={() => {
                setActive(n);
                scrollToValue(n);
                onChange(n);
              }}
            >
              <span className={cn(n === active && "text-[var(--mark)]")}>
                {prefix}
                {n}
              </span>
            </button>
          );
        })}
        <div style={{ height: PAD }} aria-hidden />
      </div>
    </div>
  );
}
