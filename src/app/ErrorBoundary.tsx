import { Component, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: unknown;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="text-xl font-bold text-red-600">حدث خطأ غير متوقع</h2>
          <p className="text-muted-foreground">يرجى إعادة تشغيل البرنامج</p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            محاولة مرة أخرى
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
