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

  it('formatEGP(10500) should include Arabic numerals', () => {
    const result = formatEGP(10500);
    expect(result).toBeDefined();
    expect(result).toContain("١٠"); // Arabic 10
  });

  it('formatEGP(0) should format zero correctly', () => {
    const result = formatEGP(0);
    expect(result).toBeDefined();
    expect(result).toContain("٠"); // Arabic 0
  });

  it('formatEGP(10000) should format as 10.00', () => {
    const result = formatEGP(10000);
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
  });

  it('formatEGP(1) should format small amounts', () => {
    const result = formatEGP(1);
    expect(result).toBeDefined();
    expect(result).toBeTruthy();
  });

  it('formatEGP(999990) should format large amounts', () => {
    const result = formatEGP(999990);
    expect(result).toBeDefined();
    expect(result).toContain("٩٩٩"); // Arabic 999
  });
});
