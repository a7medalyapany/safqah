import type { Category, Item } from "@/modules/items/types";
import type { Customer } from "@/modules/parties/types";
import type { SaleInvoiceSuccess } from "@/modules/pos/InvoiceSuccessDialog";
import type { CreateSaleInvoicePayload } from "@/modules/pos/types";
import { invoke } from "@/shared/utils/invoke";

export function listCategories() {
  return invoke<Category[]>("list_categories", undefined, { toast: false });
}

export function searchPosItems({
  query,
  categoryId,
}: {
  query: string | null;
  categoryId: number | null;
}) {
  return invoke<Item[]>(
    "search_items",
    { query, categoryId },
    { toast: false },
  );
}

export function searchCustomers(search: string | null) {
  return invoke<Customer[]>("list_customers", { search }, { toast: false });
}

export function createSaleInvoice(payload: CreateSaleInvoicePayload) {
  return invoke<SaleInvoiceSuccess>(
    "create_sale_invoice",
    { payload },
    { toast: false },
  );
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
