import { Button } from "@/components/ui/button";

type PdfPathDisplayProps = {
  pdfPath: string;
};

export function PdfPathDisplay({ pdfPath }: PdfPathDisplayProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted p-2 text-right text-sm">
      <span className="min-w-0 flex-1 truncate font-mono">{pdfPath}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void navigator.clipboard.writeText(pdfPath);
        }}
      >
        نسخ المسار
      </Button>
    </div>
  );
}
