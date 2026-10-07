# Library mathematics

The Library maps each book coordinate to unique text using a modular bijection adapted from [tdjsnelling/babel](https://github.com/tdjsnelling/babel) (GPL-3.0).

## Geometry

- Alphabet: 32 characters (`a–z`, `.,!?-`, space)
- Hexagonal room: 6 sides; **4 shelved walls** × 5 shelves × 32 books = 640 books per room (two sides are open — doorways / shafts)
- Book: 410 pages × 40 lines × 80 characters = 1,312,000 characters
- Identifier: `ROOM.WALL.SHELF.BOOK.PAGE` (room in base-32 `[0-9a-v]`)
- Random: uniform sequential book index in `[1, N]`, plus a random page (full library depth)
- Browser engine: `gmp-wasm` in the web worker (JavaScriptCore / Safari caps native BigInt at ~1M bits; `N` is ~6.5M bits)

## Sequential index

```
seq = (room − 1) · 640 + (wall − 1) · 160 + (shelf − 1) · 32 + book
```

## Bijection

Constants `N`, `C`, `I` ship in `packages/core/data/numbers` (and fast `numbers.hex.json`):

```
contentValue ≡ seq · C  (mod N)
seq         ≡ contentValue · I  (mod N)
```

`C · I ≡ 1 (mod N)`. Changing `C`/`I` creates a different library.

## Search

Search does not scan. It builds a full book string containing the query (padding strategy depends on mode), then runs inverse lookup to obtain the coordinate of that exact book.

## Travel

WASD / trackball transforms stay on the lattice (wall, shelf, book, room). Page arrows walk sequential pages across book boundaries.
