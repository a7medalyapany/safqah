import {
  Component,
  Suspense,
  lazy,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { RouteFallback } from "@/app/routing/RouteFallback";

type RouteModule = { default: ComponentType<Record<string, never>> };
type RouteLoader = () => Promise<RouteModule>;

/**
 * Catches failures that happen while a lazily-loaded route chunk is being
 * fetched/evaluated. This boundary deliberately lives OUTSIDE the lazy chunk
 * (in the always-loaded app shell) so it can catch the dynamic `import()`
 * rejection itself — a module-level boundary inside the chunk never mounts when
 * the chunk fails to load, which is why such failures used to bubble all the
 * way to the global app boundary and present an unrecoverable, undiagnosable
 * "restart the program" screen.
 */
class LazyRouteErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("Failed to load route chunk:", error);
    console.error("Component stack:", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="text-2xl font-semibold">تعذّر تحميل الصفحة</h2>
            <p className="text-muted-foreground">
              حدث خطأ أثناء تحميل هذا القسم. تحقق من اتصالك وحاول مرة أخرى.
            </p>
            <div className="flex justify-center">
              <Button onClick={this.props.onRetry}>إعادة المحاولة</Button>
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

/**
 * Renders a lazily-loaded route module behind a Suspense fallback and an error
 * boundary that can actually recover. Each retry bumps `attempt`, which builds
 * a brand-new `lazy()` component so the loader runs again — a failed dynamic
 * import is not cached by the module system, so this re-fetches the chunk
 * instead of replaying React.lazy's cached rejection forever.
 */
export function LazyRoute({ loader }: { loader: RouteLoader }) {
  const [attempt, setAttempt] = useState(0);
  const LazyComponent = useMemo(
    () => lazy(loader),
    // Rebuild the lazy component on every retry to force a fresh import().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loader, attempt],
  );

  return (
    <LazyRouteErrorBoundary
      key={attempt}
      onRetry={() => setAttempt((previous) => previous + 1)}
    >
      <Suspense fallback={<RouteFallback />}>
        <LazyComponent />
      </Suspense>
    </LazyRouteErrorBoundary>
  );
}
