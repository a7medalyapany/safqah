import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PrintSize = "a4" | "thermal";

interface PrintPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  htmlContent: string;
  onPrint: (printerName?: string) => Promise<void>;
  onSavePdf?: () => Promise<void>;
  defaultSize?: PrintSize;
  availablePrinters?: string[];
}

export function PrintPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  htmlContent,
  onPrint,
  onSavePdf,
  defaultSize = "a4",
  availablePrinters = [],
}: PrintPreviewDialogProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [printSize, setPrintSize] = useState<PrintSize>(defaultSize);

  // Load the HTML content into the iframe
  useEffect(() => {
    if (open && iframeRef.current && htmlContent) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    }
  }, [open, htmlContent]);

  const handlePrint = useCallback(async () => {
    try {
      setIsPrinting(true);
      await onPrint(selectedPrinter || undefined);
      toast.success("تمت الطباعة بنجاح");
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "فشلت الطباعة";
      toast.error(message);
    } finally {
      setIsPrinting(false);
    }
  }, [onPrint, selectedPrinter, onOpenChange]);

  const handleSavePdf = useCallback(async () => {
    try {
      setIsSaving(true);
      if (onSavePdf) {
        await onSavePdf();
        toast.success("تم حفظ ملف PDF بنجاح");
        onOpenChange(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل حفظ PDF";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [onSavePdf, onOpenChange]);

  const handleBrowserPrint = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Preview Controls */}
          <div className="flex flex-wrap gap-3 border-b pb-4">
            <div className="flex items-center gap-2">
              <label htmlFor="size-select" className="text-sm font-medium">
                حجم الصفحة:
              </label>
              <Select value={printSize} onValueChange={(v: string) => setPrintSize(v as PrintSize)}>
                <SelectTrigger id="size-select" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="thermal">حراري (80 مم)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {availablePrinters.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="printer-select" className="text-sm font-medium">
                  الطابعة:
                </label>
                <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                  <SelectTrigger id="printer-select" className="w-40">
                    <SelectValue placeholder="الطابعة الافتراضية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">الطابعة الافتراضية</SelectItem>
                    {availablePrinters.map((printer) => (
                      <SelectItem key={printer} value={printer}>
                        {printer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Preview Area */}
          <div className="border rounded-lg bg-slate-50 p-4 overflow-hidden">
            <div className="bg-white rounded border" style={{ maxHeight: "500px", overflow: "auto" }}>
              <iframe
                ref={iframeRef}
                style={{
                  width: "100%",
                  height: "500px",
                  border: "none",
                  padding: "0",
                }}
                title="Print Preview"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="flex gap-2 justify-between">
            <div className="flex gap-2">
              {onSavePdf && (
                <Button
                  variant="outline"
                  onClick={handleSavePdf}
                  disabled={isSaving || isPrinting}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Download className="mr-2 h-4 w-4" />
                  حفظ PDF
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleBrowserPrint}
                disabled={isPrinting || isSaving}
              >
                <Printer className="mr-2 h-4 w-4" />
                طباعة متقدمة
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPrinting || isSaving}
              >
                إلغاء
              </Button>
              <Button
                onClick={handlePrint}
                disabled={isPrinting || isSaving}
              >
                {isPrinting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Printer className="mr-2 h-4 w-4" />
                طباعة مباشرة
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
