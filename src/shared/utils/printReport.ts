function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printReport(title: string, contentHtml: string): void {
  const html = `
    <html dir="rtl" lang="ar">
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial; direction: rtl; padding: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background: #f5f5f5; }
          button { margin-top: 16px; padding: 8px 16px; cursor: pointer; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(title)}</h2>
        ${contentHtml}
        <button onclick="window.print()">طباعة</button>
      </body>
    </html>
  `;
  const w = window.open("", "_blank");
  if (!w) {
    printFromIframe(html);
    return;
  }

  w.document.write(html);
  w.document.close();
  w.focus();
}

function printFromIframe(html: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.left = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    return;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();
  frameWindow.focus();
  frameWindow.print();
  window.setTimeout(() => frame.remove(), 1000);
}
