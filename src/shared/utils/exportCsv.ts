import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

function csvValue(value: string) {
  if (value.includes(",")) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function exportToCsv(filename: string, headers: string[], rows: string[][]): void {
  void (async () => {
    const csvString = `\uFEFF${[headers, ...rows]
      .map((row) => row.map(csvValue).join(","))
      .join("\n")}`;
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (path) await writeTextFile(path, await blob.text());
  })();
}
