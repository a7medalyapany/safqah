import { describe, expect, it } from "vitest";

import { formatEGP, toMillieme } from "./money";

describe("money", () => {
  it('toMillieme("10.5") === 10500', () => {
    expect(toMillieme("10.5")).toBe(10500);
  });

  it('toMillieme("10") === 10000', () => {
    expect(toMillieme("10")).toBe(10000);
  });

  it("toMillieme(10.5) === 10500", () => {
    expect(toMillieme(10.5)).toBe(10500);
  });

  it('toMillieme("0") === 0', () => {
    expect(toMillieme("0")).toBe(0);
  });

  it('toMillieme(\"\") === 0', () => {
    expect(toMillieme("")).toBe(0);
  });

  it('toMillieme("99999.99") === 99999990', () => {
    expect(toMillieme("99999.99")).toBe(99999990);
  });

  it('formatEGP(10500) === "١٠٫٥٠ ج.م"', () => {
    expect(formatEGP(10500)).toBe("١٠٫٥٠ ج.م");
  });

  it('formatEGP(0) === "٠٫٠٠ ج.م"', () => {
    expect(formatEGP(0)).toBe("٠٫٠٠ ج.م");
  });

  it('formatEGP(10000) === "١٠٫٠٠ ج.م"', () => {
    expect(formatEGP(10000)).toBe("١٠٫٠٠ ج.م");
  });

  it('formatEGP(1) === "٠٫٠٠ ج.م"', () => {
    expect(formatEGP(1)).toBe("٠٫٠٠ ج.م");
  });

  it('formatEGP(999990) === "٩٩٩٫٩٩ ج.م"', () => {
    expect(formatEGP(999990)).toBe("٩٩٩٫٩٩ ج.م");
  });
});
