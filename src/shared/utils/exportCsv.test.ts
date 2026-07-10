import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn() }));

import { buildCsvString } from "@/shared/utils/exportCsv";

describe("buildCsvString", () => {
  it("prefixes a BOM and joins headers and rows with newlines", () => {
    const csv = buildCsvString(["a", "b"], [["1", "2"]]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1)).toBe("a,b\n1,2");
  });

  it("quotes values containing commas", () => {
    const csv = buildCsvString(["name"], [["كابل, نحاس"]]);

    expect(csv).toContain('"كابل, نحاس"');
  });

  it("quotes and escapes values containing double quotes", () => {
    const csv = buildCsvString(["name"], [['مقاس 3" بوصة']]);

    expect(csv).toContain('"مقاس 3"" بوصة"');
  });

  it("quotes values containing newlines so rows stay intact", () => {
    const csv = buildCsvString(["note"], [["سطر أول\nسطر ثاني"]]);

    expect(csv.slice(1).split("\n")).toHaveLength(3);
    expect(csv).toContain('"سطر أول\nسطر ثاني"');
  });

  it("leaves plain values unquoted", () => {
    const csv = buildCsvString(["a"], [["قيمة عادية"]]);

    expect(csv).not.toContain('"');
  });
});
