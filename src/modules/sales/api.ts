import type {
  CreateReturnPayload,
  InvoiceDetail,
  InvoiceFilters,
  InvoiceStats,
  InvoiceSummary,
  SaleReturn,
} from "@/modules/sales/types";
import { invoke } from "@/shared/utils/invoke";

export function getInvoiceStats() {
  return invoke<InvoiceStats>("get_invoice_stats");
}

export function listInvoices(filters: InvoiceFilters) {
  return invoke<InvoiceSummary[]>("list_invoices", { filters });
}

export function getInvoiceDetail(invoiceId: number | null) {
  return invoke<InvoiceDetail>("get_invoice_detail", { invoiceId });
}

export function createReturn(payload: CreateReturnPayload) {
  return invoke<SaleReturn>("create_return", { payload }, { toast: false });
}

export function printReceipt(invoiceId: number) {
  return invoke("print_receipt", { invoiceId }, { toast: false });
}

export function generateInvoicePdf(invoiceId: number) {
  return invoke<string>("generate_invoice_pdf", { invoiceId }, { toast: false });
}

export function openWhatsappWithInvoice({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: number;
  invoiceNumber: string;
}) {
  return invoke(
    "open_whatsapp_with_invoice",
    { invoiceId, invoiceNumber },
    { toast: false },
  );
}
