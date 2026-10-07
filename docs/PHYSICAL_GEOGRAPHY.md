# Physical Library geography

Every mathematical Babel room also has a **physical location** in an infinite hexagonal Library. Physical coordinates are derived — never stored in the database.

Implementation: [`packages/core/src/geography/`](../packages/core/src/geography/).

Mathematical addressing (room / wall / shelf / book / page) is unchanged; see [math.md](./math.md).

## Why an origin exists

The Library needs a shared reference so two readers can agree on place:

```text
Entrance = physical (q=0, r=0, level=0)
         = geography index 0
         = Babel room 1
```

There is no outer edge. The grid extends through all integer hex cells and all integer levels.

## Two coordinate systems

| System | Identity | Notes |
| --- | --- | --- |
| **Mathematical** | Babel `room ≥ 1` (base-32 in identifiers) | Content bijection; unchanged |
| **Physical** | `{ q, r, level }` as `bigint` | Axial hex + vertical level |

Bridge (do not confuse the two):

```text
geoIndex   = babelRoom − 1
babelRoom  = geoIndex + 1
```

APIs:

- `roomIndexToPhysicalLocation` / `physicalLocationToRoomIndex` — **0-based** geography index
- `babelRoomToPhysicalLocation` / `physicalLocationToBabelRoom` — Babel rooms ≥ 1

## Hexagonal horizontal grid

Store axial coordinates `q`, `r` and derive cube `s = −q − r`.

```text
hexDistance(q, r) = max(|q|, |r|, |−q−r|)
```

Pointy-top orientation; **N = +r**:

| Dir | Δq | Δr |
| --- | --- | --- |
| N | 0 | +1 |
| NE | +1 | 0 |
| SE | +1 | −1 |
| S | 0 | −1 |
| SW | −1 | 0 |
| NW | −1 | +1 |

## Vertical levels

`level` is independent of `q`/`r`.

- `0` — entrance level
- `+1` — one level above
- `−1` — one level below

`UP` / `DOWN` change only `level`. Horizontal moves change only `q`/`r`.

## Shell distance

```text
physicalDistance(q, r, level) = max(hexDistance(q, r), |level|)
```

This is a grid / topological distance (concentric 3D shells), not Euclidean meters.

Examples:

| Location | Distance |
| --- | --- |
| (0,0,0) | 0 |
| (1,0,0) | 1 |
| (0,0,±1) | 1 |
| (5,−2,3) | 5 |

## Physical spacing

```text
ROOM_SPACING_METERS = 1.25
```

This is **center-to-center** distance between horizontally adjacent rooms (and level spacing vertically). It is not the hexagon side length unless derived separately.

A vestibule sits between adjacent rooms architecturally; it is **not** a separate room and does not advance coordinates.

## Shell enumeration

Rooms are enumerated by increasing shell radius `R = physicalDistance`.

```text
hexDisk(R) = 1 + 3R(R+1)
total(R)   = (2R + 1) · hexDisk(R)   // locations with distance ≤ R
```

Geography index `N` lies in shell `R` where `R` is the smallest integer with `total(R) > N` (BigInt binary search — never linear `R++`).

```text
shellStart = total(R − 1)   // 0 when R = 0
offset     = N − shellStart
```

### Ordering within shell R

1. Levels from `−R` through `+R`
2. If `|level| < R`: enumerate the hex **ring** at radius `R` (`6R` cells)
3. If `|level| === R`: enumerate the hex **disk** radius `0…R`

Ring walk (canonical):

- Start corner: `(+R, 0)`
- Walk directions, each for `R` steps: `NW, SW, S, SE, NE, N`

Unranking is closed-form (side = `i / R`, remainder within side). Disk unranking finds the ring mathematically, then ring-unranks — no arrays of size `R`.

## Worked examples

```text
N = 0  →  (0, 0, 0)     Entrance
N = 1  →  first cell of shell 1 (level −1 disk unrank 0)
```

Babel:

```text
babelRoom 1  ↔  (0, 0, 0)
babelRoom 2  ↔  roomIndexToPhysicalLocation(1)
```

Round-trip invariants:

```ts
physicalLocationToRoomIndex(roomIndexToPhysicalLocation(n)) === n
roomIndexToPhysicalLocation(physicalLocationToRoomIndex(loc)) === loc
```

## Distance display

- Horizontal meters ≈ `hexDistance × 1.25`
- Vertical meters ≈ `|level| × 1.25`
- Optional Euclidean from axial → Cartesian (float only at the end, and only when coordinates are float-safe)

Bearing from the Entrance uses `atan2(x, y)` with **0° = North**, **90° = East**. Bearing is display-only; canonical place remains `(q, r, level)`.

Unit ladder for `formatLibraryDistance`: meters → kilometers → AU → light-years  
(`AU_METERS = 149_597_870_700`, `LIGHT_YEAR_METERS = 9_460_730_472_580_800`).

When Euclidean float coords are unavailable (book-scale / estimated shells), physical
distance falls back to **grid**: `shell × ROOM_SPACING_METERS`, formatted via
`log₁₀` so megadigit room counts still resolve to AU or light-years (scientific
exponents allowed).

## Relationship to book content

```text
Physical Location
        ↓
Room Index (Babel)
        ↓
Wall → Shelf → Book → Page
```

- **Where am I?** — physical geography  
- **What is here?** — mathematical Babel content  

Lattice travel in the reader (wall/shelf/book steps) is a separate system from physical `N/NE/SE/S/SW/NW/UP/DOWN` moves.

## Performance and memory

Geography must stay safe on mobile and desktop.

**Forbidden**

- Allocating ring/disk/shell arrays of size `6R`, `hexDisk(R)`, etc.
- Linear scans to find `R` or to walk a ring for unranking
- Default UI paths that fully decimal-stringify multi-megabyte indices

**Required**

- O(1)-space closed-form ring/disk/shell rank & unrank
- Shell find via cube-root / bit-length bound + BigInt binary search
- Compact / scientific formatting from bit length for huge values
- Float Euclidean / bearing only when `|q|,|r|,|level|` fit safe integers
- Debug UI shows only the eight immediate neighbors — never enumerates a shell

Cost may scale with the **bit length** of the room index (same class as other Babel BigInt work), but not with allocating or looping over the numeric shell radius.

## Debug UI

Developer page: `/dev/geography` — neighbor rose, shell distance, compact location text. Input digit length is capped.
