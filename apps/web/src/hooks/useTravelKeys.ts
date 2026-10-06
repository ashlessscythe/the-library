import { useEffect } from "react";
import type { MoveDirection } from "@the-library/core";

const MAP: Record<string, MoveDirection> = {
  w: "up",
  ArrowUp: "up",
  s: "down",
  ArrowDown: "down",
  a: "left",
  d: "right",
  e: "forward",
  q: "back",
  ArrowRight: "pageNext",
  ArrowLeft: "pagePrev",
};

export function useTravelKeys(
  enabled: boolean,
  onMove: (direction: MoveDirection) => void
) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const direction = MAP[key];
      if (!direction) return;
      e.preventDefault();
      onMove(direction);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onMove]);
}
