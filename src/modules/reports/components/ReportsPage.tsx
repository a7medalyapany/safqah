import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  ReportsHome,
  ReportViewScreen,
  toReportView,
} from "@/modules/reports/components/ReportsComponents";
import type { ReportView } from "@/modules/reports/types";

export default function ReportsPage() {
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
