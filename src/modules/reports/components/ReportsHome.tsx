import type { ReactNode } from "react";
import { ArrowUpLeft, BarChart3, CalendarDays, CreditCard, LineChart as LineChartIcon, PackageSearch, Receipt, TrendingUp, Truck, Users, WalletCards } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { ReportView } from "@/modules/reports/types";

const reportSections: {
  title: string;
  cards: {
    view: ReportView;
    title: string;
    subtitle: string;
    icon: ReactNode;
  }[];
}[] = [
  {
    title: "تقارير المبيعات",
    cards: [
      {
        view: "daily",
        title: "تقرير المبيعات اليومية",
        subtitle: "ملخص فواتير ومبالغ اليوم حسب طريقة الدفع.",
        icon: <CalendarDays />,
      },
      {
        view: "period-week",
        title: "تقرير المبيعات الأسبوعية",
        subtitle: "اتجاه المبيعات مجمّعاً حسب الأسبوع.",
        icon: <LineChartIcon />,
      },
      {
        view: "period-month",
        title: "تقرير المبيعات الشهرية",
        subtitle: "مقارنة المبيعات والخصومات على مستوى الشهر.",
        icon: <BarChart3 />,
      },
      {
        view: "top-items",
        title: "أفضل المنتجات مبيعاً",
        subtitle: "أعلى الأصناف حسب الكمية والإيراد والربح.",
        icon: <TrendingUp />,
      },
    ],
  },
  {
    title: "تقارير مالية",
    cards: [
      {
        view: "profit",
        title: "تحليل الأرباح",
        subtitle: "صافي الربح والهامش بعد التكلفة والمصروفات.",
        icon: <WalletCards />,
      },
      {
        view: "expenses",
        title: "ملخص المصروفات",
        subtitle: "إجمالي المصروفات وتوزيعها حسب التصنيف.",
        icon: <Receipt />,
      },
      {
        view: "payments",
        title: "تقرير طرق الدفع",
        subtitle: "نسب التحصيل حسب كاش وفيزا وآجل.",
        icon: <CreditCard />,
      },
    ],
  },
  {
    title: "تقارير العملاء والموردين",
    cards: [
      {
        view: "customers",
        title: "تقرير ديون العملاء",
        subtitle: "الأرصدة المستحقة وعدد الفواتير الآجلة.",
        icon: <Users />,
      },
      {
        view: "suppliers",
        title: "تقرير ديون الموردين",
        subtitle: "مستحقات الموردين الحالية وأقدم فاتورة.",
        icon: <Truck />,
      },
    ],
  },
  {
    title: "تقارير المخزون",
    cards: [
      {
        view: "low-stock",
        title: "تقرير المخزون المنخفض",
        subtitle: "الأصناف تحت الحد الأدنى وحجم النقص.",
        icon: <PackageSearch />,
      },
    ],
  },
];

export function ReportsHome({ onSelectView }: { onSelectView: (view: ReportView) => void }) {
  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">التقارير</h1>
        <p className="text-sm text-muted-foreground">
          مركز تقارير المبيعات والمالية والعملاء والمخزون.
        </p>
      </header>

      {reportSections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.cards.map((card) => (
              <button
                key={card.view}
                type="button"
                onClick={() => onSelectView(card.view)}
                className="group rounded-2xl text-right outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex h-full items-center gap-4 p-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-6">
                      {card.icon}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-base font-semibold">{card.title}</h3>
                      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {card.subtitle}
                      </p>
                    </div>
                    <ArrowUpLeft className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:translate-y-1" />
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
