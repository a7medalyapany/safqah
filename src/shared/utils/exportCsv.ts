import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

function csvValue(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/** BOM-prefixed CSV so Excel opens Arabic text as UTF-8. */
export function buildCsvString(headers: string[], rows: string[][]): string {
  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(csvValue).join(","))
    .join("\n")}`;
}

export function exportToCsv(filename: string, headers: string[], rows: string[][]): void {
  void (async () => {
    const csvString = buildCsvString(headers, rows);
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (path) await writeTextFile(path, csvString);
  })();
}
