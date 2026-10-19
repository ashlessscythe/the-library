import { describe, expect, it, vi } from "vitest";
import {
  geographyNavStateForPath,
  readerRoomKeyFromPathname,
} from "./geographyNav";

describe("readerRoomKeyFromPathname", () => {
  it("extracts the room key from a Reader URL", () => {
    expect(
      readerRoomKeyFromPathname("/book/ab12/wall/1/shelf/2/book/3/page/4")
    ).toBe("ab12");
  });

  it("decodes percent-encoded room keys (including @hash slugs)", () => {
    expect(
      readerRoomKeyFromPathname(
        "/book/%40deadbeef/wall/1/shelf/1/book/1/page/1"
      )
    ).toBe("@deadbeef");
  });

  it("returns null outside Reader routes", () => {
    expect(readerRoomKeyFromPathname("/")).toBeNull();
    expect(readerRoomKeyFromPathname("/geography")).toBeNull();
    expect(readerRoomKeyFromPathname("/search")).toBeNull();
    expect(readerRoomKeyFromPathname("/explore")).toBeNull();
    expect(
      readerRoomKeyFromPathname("/book/ab12/wall/1/shelf/2/book/3")
    ).toBeNull();
  });
});

describe("geographyNavStateForPath", () => {
  it("reuses the Reader room when on a book page", () => {
    expect(
      geographyNavStateForPath("/book/room9/wall/4/shelf/1/book/2/page/3")
    ).toEqual({ roomKey: "room9" });
  });

  it("falls back to a random short room elsewhere", () => {
    const spy = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation(<T extends ArrayBufferView>(arr: T): T => {
        const view = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
        view.fill(7);
        return arr;
      });

    const state = geographyNavStateForPath("/search");
    expect(state.roomKey).toMatch(/^[1-9a-v][0-9a-v]{3}$/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
