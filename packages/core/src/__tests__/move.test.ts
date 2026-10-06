import { formatIdentifier, parseIdentifier } from "../coordinates/identifier";
import { moveCoordinate, moveIdentifier } from "../coordinates/move";

describe("lattice travel", () => {
  it("moves shelf up/down within a wall", () => {
    const base = parseIdentifier("1.1.2.1.1");
    expect(moveCoordinate(base, "up").shelf).toBe(3);
    expect(moveCoordinate(base, "down").shelf).toBe(1);
  });

  it("wraps wall left/right and steps room on full wrap from wall 1 left", () => {
    const atWall1 = parseIdentifier("2.1.1.1.1");
    const left = moveCoordinate(atWall1, "left");
    expect(left.wall).toBe(4);
    expect(left.room).toBe(1n);

    const atWall4 = parseIdentifier("1.4.1.1.1");
    const right = moveCoordinate(atWall4, "right");
    expect(right.wall).toBe(1);
    expect(right.room).toBe(2n);
  });

  it("carries book forward across shelf", () => {
    const atLastBook = parseIdentifier("1.1.1.32.1");
    const next = moveCoordinate(atLastBook, "forward");
    expect(next.shelf).toBe(2);
    expect(next.book).toBe(1);
  });

  it("walks pages across books", () => {
    expect(moveIdentifier("1.1.1.1.410", "pageNext")).toBe("1.1.1.2.1");
    expect(moveIdentifier("1.1.1.2.1", "pagePrev")).toBe("1.1.1.1.410");
  });

  it("formats moved coordinates consistently", () => {
    const id = "1.2.3.4.5";
    const moved = moveIdentifier(id, "right");
    const parsed = parseIdentifier(moved);
    expect(formatIdentifier(parsed.roomString, parsed.wall, parsed.shelf, parsed.book, parsed.page)).toBe(
      moved
    );
  });

  it("steps room and floor without changing wall/shelf/book/page", () => {
    // room "a" = 10 in base-32
    const base = parseIdentifier("a.2.3.4.5");
    const nextRoom = moveCoordinate(base, "roomNext");
    expect(nextRoom.room).toBe(11n);
    expect(nextRoom.wall).toBe(2);
    expect(nextRoom.shelf).toBe(3);

    const prevRoom = moveCoordinate(base, "roomPrev");
    expect(prevRoom.room).toBe(9n);

    const up = moveCoordinate(base, "floorUp");
    expect(up.room).toBe(16n);
    const down = moveCoordinate(base, "floorDown");
    expect(down.room).toBe(4n);
  });
});
