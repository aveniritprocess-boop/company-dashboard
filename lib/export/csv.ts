import Papa from "papaparse";
import { checkExportLimit, generateExportFilename } from "./export-utils";

export async function exportToCsv(
  data: Record<string, unknown>[],
  columns: { key: string; header: string }[],
  module: string
) {
  if (!checkExportLimit(data.length, "csv")) return;

  const mappedData = data.map((row) => {
    const newRow: Record<string, unknown> = {};
    columns.forEach((col) => {
      newRow[col.header] = row[col.key];
    });
    return newRow;
  });

  const csv = Papa.unparse(mappedData);
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", generateExportFilename(module, "csv"));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
