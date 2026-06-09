/**
 * Invoice Renderer Service
 * Generates semantic HTML for printing invoices with full Arabic RTL support
 * Uses tables for layout (professional print design) and Latin numerals
 */

import { formatCurrencyLatin } from "../utils/latinNumerals";

export interface InvoiceItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName?: string;
  cashierName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  currencySymbol: string;
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
  thankYouMessage?: string;
  showShopName?: boolean;
  showShopPhone?: boolean;
  showShopAddress?: boolean;
  showThankYou?: boolean;
}

export type PrintSize = "a4" | "thermal";

/**
 * Generate invoice HTML with semantic table structure
 * Uses tables for layout (professional print) and Latin numerals for numbers
 */
export function generateInvoiceHtml(
  invoice: InvoiceData,
  printSize: PrintSize = "a4"
): string {
  const isThermal = printSize === "thermal";
  const pageWidth = isThermal ? "80mm" : "210mm";
  const baseFontSize = isThermal ? "10px" : "12px";
  const headerFontSize = isThermal ? "11px" : "14px";
  const tableFontSize = isThermal ? "9px" : "11px";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة - ${invoice.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: ${pageWidth} 297mm;
      margin: 0;
    }

    html, body {
      width: ${pageWidth};
      font-family: 'Segoe UI', 'Droid Arabic Noto', Arial, sans-serif;
      font-size: ${baseFontSize};
      line-height: 1.5;
      direction: rtl;
      text-align: right;
      background: white;
      color: #000;
    }

    .invoice-container {
      width: 100%;
      padding: ${isThermal ? "5mm 4mm" : "15mm"};
    }

    /* Header Section */
    .invoice-header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: ${isThermal ? "4mm" : "8mm"};
      margin-bottom: ${isThermal ? "4mm" : "8mm"};
    }

    .shop-name {
      font-size: ${headerFontSize};
      font-weight: bold;
      margin-bottom: ${isThermal ? "2mm" : "4mm"};
      letter-spacing: 0.5px;
    }

    .shop-contact {
      font-size: ${isThermal ? "8px" : "10px"};
      line-height: 1.4;
      color: #333;
    }

    .shop-contact-line {
      margin: 1mm 0;
    }

    /* Metadata Table */
    .invoice-meta {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: ${isThermal ? "3mm" : "6mm"};
      font-size: ${tableFontSize};
    }

    .invoice-meta td {
      padding: ${isThermal ? "2mm 3mm" : "3mm 5mm"};
      border-bottom: 1px solid #ddd;
    }

    .invoice-meta .label {
      font-weight: bold;
      width: 25%;
      text-align: right;
    }

    .invoice-meta .value {
      text-align: right;
      width: 25%;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: ${isThermal ? "3mm 0" : "8mm 0"};
      font-size: ${tableFontSize};
    }

    .items-table thead {
      background-color: #f0f0f0;
      border-top: 1px solid #000;
      border-bottom: 2px solid #000;
    }

    .items-table th {
      padding: ${isThermal ? "3mm" : "5mm"};
      text-align: right;
      font-weight: bold;
      font-size: ${isThermal ? "8px" : "10px"};
    }

    .items-table td {
      padding: ${isThermal ? "2mm 3mm" : "4mm 5mm"};
      border-bottom: 1px solid #eee;
    }

    .items-table tbody tr:last-child td {
      border-bottom: 1px solid #000;
    }

    .col-item { width: 50%; text-align: right; }
    .col-qty { width: 15%; text-align: center; }
    .col-price { width: 18%; text-align: left; }
    .col-total { width: 17%; text-align: left; }

    /* Summary Table */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin: ${isThermal ? "3mm 0" : "8mm 0"};
      font-size: ${tableFontSize};
    }

    .summary-table td {
      padding: ${isThermal ? "2mm 3mm" : "3mm 5mm"};
      text-align: left;
    }

    .summary-label {
      text-align: right;
      font-weight: 500;
      width: 70%;
    }

    .summary-value {
      text-align: left;
      width: 30%;
      font-family: 'Courier New', monospace;
    }

    .summary-table .total-row td {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      font-weight: bold;
      padding: ${isThermal ? "3mm" : "5mm"};
    }

    /* Footer */
    .invoice-footer {
      text-align: center;
      margin-top: ${isThermal ? "4mm" : "12mm"};
      padding-top: ${isThermal ? "3mm" : "6mm"};
      border-top: 1px solid #000;
      font-size: ${isThermal ? "9px" : "11px"};
      line-height: 1.6;
    }

    .thank-you-msg {
      font-weight: bold;
      margin-bottom: 2mm;
    }

    @media print {
      body { margin: 0; padding: 0; }
      .invoice-container { padding: ${isThermal ? "5mm 4mm" : "15mm"}; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="invoice-header">
      ${invoice.showShopName && invoice.shopName ? `<div class="shop-name">${escapeHtml(invoice.shopName)}</div>` : ""}
      <div class="shop-contact">
        ${invoice.showShopPhone && invoice.shopPhone ? `<div class="shop-contact-line">${escapeHtml(invoice.shopPhone)}</div>` : ""}
        ${invoice.showShopAddress && invoice.shopAddress ? `<div class="shop-contact-line">${escapeHtml(invoice.shopAddress)}</div>` : ""}
      </div>
    </div>

    <!-- Invoice Metadata -->
    <table class="invoice-meta">
      <tr>
        <td class="label">رقم الفاتورة</td>
        <td class="value">${escapeHtml(invoice.invoiceNumber)}</td>
        <td class="label">التاريخ</td>
        <td class="value">${escapeHtml(invoice.date)}</td>
      </tr>
      <tr>
        <td class="label">العميل</td>
        <td class="value">${escapeHtml(invoice.customerName || "عميل عام")}</td>
        <td class="label">الكاشير</td>
        <td class="value">${escapeHtml(invoice.cashierName || "—")}</td>
      </tr>
    </table>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-item">الصنف</th>
          <th class="col-qty">الكمية</th>
          <th class="col-price">السعر الفردي</th>
          <th class="col-total">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items
          .map(
            (item) => `
        <tr>
          <td class="col-item">${escapeHtml(item.name)}</td>
          <td class="col-qty">${item.qty}</td>
          <td class="col-price">${formatCurrencyLatin(item.unitPrice)} ${invoice.currencySymbol}</td>
          <td class="col-total">${formatCurrencyLatin(item.total)} ${invoice.currencySymbol}</td>
        </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <!-- Summary -->
    <table class="summary-table">
      <tr>
        <td class="summary-label">الإجمالي الفرعي</td>
        <td class="summary-value">${formatCurrencyLatin(invoice.subtotal)} ${invoice.currencySymbol}</td>
      </tr>
      ${
        invoice.discount > 0
          ? `<tr>
        <td class="summary-label">الخصم</td>
        <td class="summary-value">-${formatCurrencyLatin(invoice.discount)} ${invoice.currencySymbol}</td>
      </tr>`
          : ""
      }
      ${
        invoice.tax > 0
          ? `<tr>
        <td class="summary-label">الضريبة</td>
        <td class="summary-value">${formatCurrencyLatin(invoice.tax)} ${invoice.currencySymbol}</td>
      </tr>`
          : ""
      }
      <tr class="total-row">
        <td class="summary-label">الإجمالي النهائي</td>
        <td class="summary-value">${formatCurrencyLatin(invoice.total)} ${invoice.currencySymbol}</td>
      </tr>
      ${
        invoice.paidAmount > 0 && invoice.paidAmount !== invoice.total
          ? `<tr>
        <td class="summary-label">المبلغ المدفوع</td>
        <td class="summary-value">${formatCurrencyLatin(invoice.paidAmount)} ${invoice.currencySymbol}</td>
      </tr>
      <tr>
        <td class="summary-label">المتبقي</td>
        <td class="summary-value">${formatCurrencyLatin(invoice.total - invoice.paidAmount)} ${invoice.currencySymbol}</td>
      </tr>`
          : ""
      }
    </table>

    <!-- Footer -->
    ${
      invoice.showThankYou
        ? `<div class="invoice-footer">
      <div class="thank-you-msg">${escapeHtml(invoice.thankYouMessage || "شكراً لزيارتكم")}</div>
      <div>نتطلع لخدمتكم مجدداً</div>
    </div>`
        : ""
    }
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters for safe rendering
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
