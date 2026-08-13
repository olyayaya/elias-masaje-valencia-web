import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportCrash } from "@/lib/sentry";

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Catches render/lifecycle errors anywhere below it so a single failing
 * component shows a readable message instead of a blank white screen.
 */
class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[app-error]", error, info.componentStack);
    reportCrash(error, info.componentStack ?? undefined);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-medium text-foreground">Algo salió mal / Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            La página encontró un error inesperado. Puedes recargar para continuar.
          </p>
          <pre className="text-[11px] text-left bg-secondary/60 border border-border rounded-lg p-3 overflow-auto max-h-40 text-muted-foreground">
            {error.message}
          </pre>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-secondary"
            >
              Reintentar / Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:opacity-90"
            >
              Recargar / Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
