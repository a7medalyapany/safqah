import { describe, expect, it } from "vitest";

import {
  isPrintableKey,
  shouldAcceptBarcodeScan,
} from "@/shared/hooks/useBarcodeScanner";

describe("useBarcodeScanner helpers", () => {
  it("accepts rapid scanner-like input", () => {
    expect(
      shouldAcceptBarcodeScan({
        buffer: "1234567890",
        startedAt: 10,
        endedAt: 55,
      }),
    ).toBe(true);
  });

  it("rejects short input", () => {
    expect(
      shouldAcceptBarcodeScan({
        buffer: "123",
        startedAt: 10,
        endedAt: 40,
      }),
    ).toBe(false);
  });

  it("rejects slow human typing", () => {
    expect(
      shouldAcceptBarcodeScan({
        buffer: "abcdef",
        startedAt: 10,
        endedAt: 180,
      }),
    ).toBe(false);
  });

  it("treats single characters as printable keys", () => {
    expect(isPrintableKey("a")).toBe(true);
    expect(isPrintableKey("1")).toBe(true);
  });

  it("skips non-printable keys", () => {
    expect(isPrintableKey("Shift")).toBe(false);
    expect(isPrintableKey("Control")).toBe(false);
    expect(isPrintableKey("Enter")).toBe(false);
  });
});
