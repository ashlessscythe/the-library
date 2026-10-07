import { useCallback, useRef } from "react";
import type { MoveDirection } from "@the-library/core";
import { KeyMapDiagram } from "@/components/KeyMapDiagram";
import type { GeographyLocationState } from "@/lib/geographyNav";
import { cn } from "@/lib/utils";

type Props = {
  onMove: (direction: MoveDirection) => void;
  className?: string;
  geographyState?: GeographyLocationState;
};

const THRESHOLD = 36;

/**
 * Virtual trackball: drag emits discrete lattice steps with hysteresis.
 * Horizontal → wall (Q/E) · Vertical → shelf (W/S)
 */
export function Trackball({ onMove, className, geographyState }: Props) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const emitFromDelta = useCallback(
    (dx: number, dy: number) => {
      if (fired.current) return;
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      fired.current = true;
      if (Math.abs(dx) >= Math.abs(dy)) {
        onMove(dx > 0 ? "right" : "left");
      } else {
        onMove(dy > 0 ? "down" : "up");
      }
    },
    [onMove]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY };
    fired.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!origin.current) return;
    emitFromDelta(e.clientX - origin.current.x, e.clientY - origin.current.y);
  };

  const onPointerUp = () => {
    origin.current = null;
    fired.current = false;
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div
        role="application"
        aria-label="Library trackball — drag for walls and shelves"
        className="relative h-32 w-32 cursor-grab touch-none rounded-full border border-[var(--line)] bg-[var(--panel)] active:cursor-grabbing md:h-36 md:w-36"
        style={{
          backgroundImage:
            "radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--mark) 18%, transparent), transparent 55%), radial-gradient(circle at 50% 50%, var(--paper), var(--panel))",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--dim)]">
          Travel
        </div>
      </div>

      <div className="grid w-full max-w-[14rem] grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
        <button
          type="button"
          className="border border-[var(--line)] px-2 py-1 hover:border-[var(--mark)] hover:text-[var(--mark)]"
          onClick={() => onMove("back")}
        >
          A · Book−
        </button>
        <button
          type="button"
          className="border border-[var(--line)] px-2 py-1 hover:border-[var(--mark)] hover:text-[var(--mark)]"
          onClick={() => onMove("forward")}
        >
          D · Book+
        </button>
      </div>

      <KeyMapDiagram onMove={onMove} geographyState={geographyState} />
    </div>
  );
}
