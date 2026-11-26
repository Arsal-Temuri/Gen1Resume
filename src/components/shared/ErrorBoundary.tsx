import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error ? error.message : 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Gen1Resume ErrorBoundary caught error:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#09090B] text-[#09090B] dark:text-[#FAFAFA] px-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-6 shadow-xs space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg border border-[#FECACA] bg-[#FEF2F2] dark:bg-red-950/60 dark:border-red-800/70 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#DC2626] dark:text-red-400" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-base font-semibold tracking-tight">
                Something went wrong in this view
              </h1>
              <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                Your Master Profile and saved Version History are safely stored locally. You can try recovering the view or reloading the workspace.
              </p>
            </div>
          </div>

          {this.state.errorMessage && (
            <p className="text-xs font-mono text-[#DC2626] dark:text-red-400 bg-[#FEF2F2] dark:bg-red-950/40 border border-[#FECACA] dark:border-red-900/60 rounded-lg px-3 py-2 break-words">
              {this.state.errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] transition-colors cursor-pointer"
            >
              Try Recovering
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#09090B] text-white dark:bg-[#FAFAFA] dark:text-[#09090B] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reload Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }
}
