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
        </style>
      </head>
      <body>
        <h2>${escapeHtml(title)}</h2>
        ${contentHtml}
      </body>
    </html>
  `;
  printFromIframe(html);
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

  let cleanedUp = false;
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    frame.remove();
  }
  frameWindow.addEventListener("afterprint", cleanup);
  window.setTimeout(cleanup, 5000);
}
