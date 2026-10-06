import { cn } from "@/lib/utils";

type KeyProps = {
  label: string;
  sub?: string;
  wide?: boolean;
  className?: string;
};

function Key({ label, sub, wide, className }: KeyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border border-[var(--line)] bg-[var(--panel)] px-1.5 py-1 text-center",
        wide ? "min-w-[2.75rem]" : "min-w-[1.65rem]",
        className
      )}
    >
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

/** Compact visual of travel keyboard bindings. */
export function KeyMapDiagram({ className }: { className?: string }) {
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
          <Key label="Q" sub="wall−" />
          <Key label="W" sub="shelf+" />
          <Key label="E" sub="wall+" />
        </div>
        <div className="flex items-end gap-1">
          <Key label="A" sub="book−" />
          <Key label="S" sub="shelf−" />
          <Key label="D" sub="book+" />
        </div>
      </div>

      {/* Arrows */}
      <div className="flex flex-col items-center gap-1 border-t border-[var(--line)] pt-3">
        <div className="flex items-end gap-1">
          <Key label="←" sub="page−" wide />
          <Key label="→" sub="page+" wide />
        </div>
      </div>

      {/* Floor / room */}
      <div className="grid grid-cols-2 gap-1 border-t border-[var(--line)] pt-3">
        <Key label="PgUp" sub="floor+" wide className="w-full" />
        <Key label="PgDn" sub="floor−" wide className="w-full" />
        <Key label="Home" sub="room−" wide className="w-full" />
        <Key label="End" sub="room+" wide className="w-full" />
      </div>
    </figure>
  );
}
