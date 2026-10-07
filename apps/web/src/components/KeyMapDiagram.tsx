import type { MoveDirection } from "@the-library/core";
import { cn } from "@/lib/utils";

type KeyProps = {
  label: string;
  sub?: string;
  wide?: boolean;
  className?: string;
  direction?: MoveDirection;
  onMove?: (direction: MoveDirection) => void;
};

function Key({ label, sub, wide, className, direction, onMove }: KeyProps) {
  const interactive = Boolean(direction && onMove);
  const shared = cn(
    "flex flex-col items-center justify-center border border-[var(--line)] bg-[var(--panel)] px-1.5 py-1 text-center",
    wide ? "min-w-[2.75rem]" : "min-w-[1.65rem]",
    interactive &&
      "cursor-pointer transition-colors hover:border-[var(--mark)] hover:text-[var(--mark)] active:bg-[var(--paper)]",
    className
  );

  if (interactive && direction && onMove) {
    return (
      <button
        type="button"
        className={shared}
        aria-label={`${label}${sub ? ` · ${sub}` : ""}`}
        onClick={() => onMove(direction)}
      >
        <span className="font-mono text-[11px] leading-none text-[var(--fg)]">
          {label}
        </span>
        {sub && (
          <span className="mt-0.5 font-mono text-[8px] uppercase leading-none tracking-wide text-[var(--dim)]">
            {sub}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={shared}>
      <span className="font-mono text-[11px] leading-none text-[var(--fg)]">
        {label}
      </span>
      {sub && (
        <span className="mt-0.5 font-mono text-[8px] uppercase leading-none tracking-wide text-[var(--dim)]">
          {sub}
        </span>
      )}
    </div>
  );
}

/** Compact visual of travel keyboard bindings — keys emit moves when clicked. */
export function KeyMapDiagram({
  onMove,
  className,
}: {
  onMove?: (direction: MoveDirection) => void;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "w-full max-w-[14rem] space-y-3 border border-[var(--line)] bg-[var(--paper)] p-3",
        className
      )}
      aria-label="Keyboard travel map"
    >
      <figcaption className="font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--mark)]">
        Keys
      </figcaption>

      {/* WASD + Q/E cluster */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-end gap-1">
          <Key label="Q" sub="wall−" direction="left" onMove={onMove} />
          <Key label="W" sub="shelf+" direction="up" onMove={onMove} />
          <Key label="E" sub="wall+" direction="right" onMove={onMove} />
        </div>
        <div className="flex items-end gap-1">
          <Key label="A" sub="book−" direction="back" onMove={onMove} />
          <Key label="S" sub="shelf−" direction="down" onMove={onMove} />
          <Key label="D" sub="book+" direction="forward" onMove={onMove} />
        </div>
      </div>

      {/* Arrows */}
      <div className="flex flex-col items-center gap-1 border-t border-[var(--line)] pt-3">
        <div className="flex items-end gap-1">
          <Key
            label="←"
            sub="page−"
            wide
            direction="pagePrev"
            onMove={onMove}
          />
          <Key
            label="→"
            sub="page+"
            wide
            direction="pageNext"
            onMove={onMove}
          />
        </div>
      </div>

      {/* Floor / room */}
      <div className="grid grid-cols-2 gap-1 border-t border-[var(--line)] pt-3">
        <Key
          label="PgUp"
          sub="floor+"
          wide
          className="w-full"
          direction="floorUp"
          onMove={onMove}
        />
        <Key
          label="PgDn"
          sub="floor−"
          wide
          className="w-full"
          direction="floorDown"
          onMove={onMove}
        />
        <Key
          label="Home"
          sub="room−"
          wide
          className="w-full"
          direction="roomPrev"
          onMove={onMove}
        />
        <Key
          label="End"
          sub="room+"
          wide
          className="w-full"
          direction="roomNext"
          onMove={onMove}
        />
      </div>
    </figure>
  );
}
