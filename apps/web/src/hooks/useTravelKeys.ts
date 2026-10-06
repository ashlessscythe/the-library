import { useEffect } from "react";
import type { MoveDirection } from "@the-library/core";

/**
 * ←/→ pages · A/D books · W/S shelves · Q/E walls ·
 * PageUp/PageDown floor · Home/End room (hex)
 */
const MAP: Record<string, MoveDirection> = {
  ArrowLeft: "pagePrev",
  ArrowRight: "pageNext",
  a: "back",
  d: "forward",
  w: "up",
  s: "down",
  q: "left",
  e: "right",
  PageUp: "floorUp",
  PageDown: "floorDown",
  Home: "roomPrev",
  End: "roomNext",
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
