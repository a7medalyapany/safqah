import type { InvoicePrintData } from "@/modules/sales/types";
import { formatEGP } from "@/shared/utils/money";

/**
 * Builds the printable HTML document for a sales invoice. Shared by the POS
 * success screen and the invoice detail sheet so the receipt layout stays in one
 * place. Pair with `printHtml` from `@/shared/utils/printHtml` to send it to print.
 */
export function buildInvoicePrintHtml(data: InvoicePrintData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right">${item.itemNameAr}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${item.qty}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${formatEGP(item.unitPriceMillieme)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">${formatEGP(item.discountMillieme)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:left">${formatEGP(item.totalMillieme)}</td>
        </tr>`,
    )
    .join("");

  return `
        <html dir="rtl" lang="ar">
          <head><meta charset="utf-8"><title>فاتورة ${data.invoiceNumber}</title>
          <style>
            body{font-family:'Segoe UI',Tahoma,Arial;padding:20px;margin:0;direction:rtl}
            .header{text-align:center;margin-bottom:16px}
            .header h1{margin:0;font-size:18px}
            .header p{margin:2px 0;font-size:13px;color:#555}
            table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
            th{background:#f5f5f5;padding:6px 8px;border-bottom:2px solid #ddd;text-align:right}
            .totals{margin-top:12px;font-size:13px}
            .totals div{display:flex;justify-content:space-between;padding:3px 0}
            .totals .grand{font-weight:bold;font-size:15px;border-top:2px solid #333;padding-top:6px;margin-top:4px}
            .footer{text-align:center;margin-top:16px;font-size:12px;color:#888}
          </style></head>
          <body>
            <div class="header">
              <h1>${data.shop.shopName}</h1>
              ${data.shop.shopAddress ? `<p>${data.shop.shopAddress}</p>` : ""}
              ${data.shop.shopPhone ? `<p>${data.shop.shopPhone}</p>` : ""}
              <p>رقم الفاتورة: ${data.invoiceNumber}</p>
              ${data.cashierName ? `<p>الكاشير: ${data.cashierName}</p>` : ""}
              ${data.customerName ? `<p>العميل: ${data.customerName}</p>` : ""}
            </div>
            <table>
              <thead><tr>
                <th style="text-align:right">الصنف</th>
                <th style="text-align:center">الكمية</th>
                <th style="text-align:center">السعر</th>
                <th style="text-align:center">الخصم</th>
                <th style="text-align:left">الإجمالي</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <div class="totals">
              <div><span>المجموع الفرعي</span><span>${formatEGP(data.subtotalMillieme)}</span></div>
              ${data.discountMillieme ? `<div><span>الخصم</span><span>${formatEGP(data.discountMillieme)}</span></div>` : ""}
              <div class="grand"><span>الإجمالي</span><span>${formatEGP(data.totalMillieme)}</span></div>
              <div><span>المدفوع</span><span>${formatEGP(data.paidMillieme)}</span></div>
            </div>
            <div class="footer">شكراً لزيارتكم</div>
          </body>
        </html>`;
}
