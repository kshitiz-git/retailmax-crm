import * as React from "react";
import { Button } from "@/components/ui/button";

/** Keeps one broken page from blanking the whole app; the sidebar stays usable. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="rounded-xl border border-border bg-surface p-8 text-center">
        <h2 className="font-display text-lg font-semibold">This page hit an error</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">{this.state.error.message}</p>
        <Button className="mt-4" size="sm" onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </div>
    );
  }
}
