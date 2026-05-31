import { invoke } from "@/shared/utils/invoke";

export function listPrinters() {
  return invoke<string[]>("list_printers", undefined, { toast: false });
}

export function getDbFileSize() {
  return invoke<number>("get_db_file_size", undefined, { toast: false });
}

export function vacuumDatabase() {
  return invoke<boolean>("vacuum_database", undefined, { toast: false });
}

export function printTestReceipt(printerName: string | undefined) {
  return invoke("print_test_receipt", { printerName });
}
