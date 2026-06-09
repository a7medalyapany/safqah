/**
 * Print Service
 * Centralized service for all print operations with preview support
 */

import { generateInvoiceHtml, type InvoiceData } from "./invoiceRenderer";
import { generateReceiptHtml, type ReceiptData } from "./receiptRenderer";
import { generateBarcodeLabelHtml, type BarcodeLabelData } from "./barcodeLabelRenderer";
import { invoke } from "@/shared/utils/invoke";

export type PrintDocumentType = "invoice" | "receipt" | "barcode-label";

/**
 * Print invoice with HTML rendering
 */
export async function printInvoice(
  invoiceData: InvoiceData,
  printerName?: string,
  skipPreview: boolean = false
): Promise<void> {
  const htmlContent = generateInvoiceHtml(invoiceData, "a4");
  
  if (skipPreview) {
    // Direct print without preview
    return printDirect(htmlContent, printerName, "invoice");
  }

  // Preview will be shown in component
  return printDirect(htmlContent, printerName, "invoice");
}

/**
 * Print receipt with HTML rendering
 */
export async function printReceipt(
  receiptData: ReceiptData,
  printerName?: string,
  skipPreview: boolean = false
): Promise<void> {
  const htmlContent = generateReceiptHtml(receiptData);
  
  if (skipPreview) {
    return printDirect(htmlContent, printerName, "receipt");
  }

  return printDirect(htmlContent, printerName, "receipt");
}

/**
 * Print barcode labels with HTML rendering
 */
export async function printBarcodeLabel(
  labelData: BarcodeLabelData,
  printerName?: string,
  skipPreview: boolean = false
): Promise<void> {
  const htmlContent = generateBarcodeLabelHtml(labelData);
  
  if (skipPreview) {
    return printDirect(htmlContent, printerName, "barcode-label");
  }

  return printDirect(htmlContent, printerName, "barcode-label");
}

/**
 * Direct print - converts HTML to PDF and sends to printer
 */
async function printDirect(
  htmlContent: string,
  _printerName: string | undefined,
  _documentType: PrintDocumentType
): Promise<void> {
  try {
    // For now, use the existing print infrastructure
    // This could be extended to use puppeteer or similar for HTML->PDF conversion
    // at the Tauri level
    
    // Fallback: open browser print dialog
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Failed to create iframe for printing");
    
    doc.open();
    doc.write(htmlContent);
    doc.close();
    
    // Wait for content to load
    await new Promise(resolve => {
      iframe.onload = resolve;
      setTimeout(resolve, 1000);
    });
    
    // Trigger print
    iframe.contentWindow?.print();
    
    // Cleanup
    document.body.removeChild(iframe);
  } catch (error) {
    throw new Error(
      error instanceof Error 
        ? error.message 
        : "فشل الطباعة — تأكد من توفر الطابعة"
    );
  }
}

/**
 * Get available printers list
 */
export async function getPrinterList(): Promise<string[]> {
  try {
    return await invoke<string[]>(
      "get_label_printer_list",
      undefined,
      { toast: false }
    );
  } catch {
    return [];
  }
}

/**
 * Save print content as PDF
 */
export async function savePrintAsPdf(
  htmlContent: string,
  fileName: string
): Promise<void> {
  try {
    // Use HTML2PDF or similar library
    // For now, this is a placeholder
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(
      error instanceof Error 
        ? error.message 
        : "فشل حفظ ملف PDF"
    );
  }
}
