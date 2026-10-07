/*
  Neighbor map for debug / explorer visualization.
  Only the 6 horizontal + 2 vertical neighbors — never a shell.
*/

import { move, PHYSICAL_DIRECTIONS } from "./move";
import type { PhysicalDirection, PhysicalLocation } from "./types";
import { physicalLocationToRoomIndex } from "./mapping";
import { roomDistanceFromOrigin } from "./distance";

export type NeighborCell = {
  direction: PhysicalDirection;
  location: PhysicalLocation;
  geoIndex: bigint;
};

export type NearbyMap = {
  you: PhysicalLocation;
  geoIndex: bigint;
  shellDistance: bigint;
  neighbors: NeighborCell[];
};

/** Immediate neighbors only (8). Safe for any shell radius. */
export function nearbyMap(location: PhysicalLocation): NearbyMap {
  const neighbors: NeighborCell[] = PHYSICAL_DIRECTIONS.map((direction) => {
    const next = move(location, direction);
    return {
      direction,
      location: next,
      geoIndex: physicalLocationToRoomIndex(next),
    };
  });
  return {
    you: location,
    geoIndex: physicalLocationToRoomIndex(location),
    shellDistance: roomDistanceFromOrigin(location),
    neighbors,
  };
}

/**
 * ASCII rose for horizontal neighbors (debug).
 * Vertical neighbors listed as Level ±1 lines.
 */
export function formatNearbyAscii(location: PhysicalLocation): string {
  const map = nearbyMap(location);
  const byDir = Object.fromEntries(
    map.neighbors.map((n) => [n.direction, n])
  ) as Record<PhysicalDirection, NeighborCell>;

  const label = (d: PhysicalDirection) => d.padStart(2, " ");

  const lines = [
    `             ${label("NW")}    ${label("N")}    ${label("NE")}`,
    "               \\   |   /",
    "                [YOU]",
    "               /   |   \\",
    `             ${label("SW")}    ${label("S")}    ${label("SE")}`,
    "",
    `Level: ${formatSigned(map.you.level)}`,
    `Distance: ${map.shellDistance.toString()} rooms`,
    `UP → geo ${byDir.UP.geoIndex.toString()}  |  DOWN → geo ${byDir.DOWN.geoIndex.toString()}`,
    `N ${byDir.N.geoIndex}  NE ${byDir.NE.geoIndex}  SE ${byDir.SE.geoIndex}`,
    `S ${byDir.S.geoIndex}  SW ${byDir.SW.geoIndex}  NW ${byDir.NW.geoIndex}`,
  ];
  return lines.join("\n");
}

function formatSigned(n: bigint): string {
  if (n > 0n) return `+${n.toString()}`;
  return n.toString();
}
