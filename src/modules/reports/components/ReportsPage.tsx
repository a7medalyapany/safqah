import { Component, type ReactNode } from "react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  ReportsHome,
  ReportViewScreen,
  toReportView,
} from "@/modules/reports/components/ReportsComponents";
import type { ReportView } from "@/modules/reports/types";

class ReportsErrorBoundary extends Component<{
  children: ReactNode;
}> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("Reports page crashed:", error);
    console.error("Component stack:", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="text-2xl font-semibold">حدث خطأ في صفحة التقارير</h2>
            <p className="text-muted-foreground">
              حدث خطأ غير متوقع أثناء تحميل التقارير. يرجى المحاولة مرة أخرى.
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/reports")}
              >
                <ArrowLeft />
                العودة للتقارير
              </Button>
              <Button onClick={() => window.location.reload()}>
                أعد تحميل الصفحة
              </Button>
            </div>
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                تفاصيل الخطأ
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ReportsPageContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryView = toReportView(searchParams.get("view"));
  const [activeView, setActiveView] = useState<ReportView | null>(queryView);

  const handleSelectView = (view: ReportView) => {
    setActiveView(view);
    setSearchParams({ view });
  };

  const handleBack = () => {
    setActiveView(null);
    setSearchParams({});
  };

  if (activeView) {
    return <ReportViewScreen view={activeView} onBack={handleBack} />;
  }

  return <ReportsHome onSelectView={handleSelectView} />;
}

export default function ReportsPage() {
  return (
    <ReportsErrorBoundary>
      <ReportsPageContent />
    </ReportsErrorBoundary>
  );
}
