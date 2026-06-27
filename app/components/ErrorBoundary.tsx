"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error inside ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="text-yellow-400 p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
            ⚠️ Data temporarily unavailable — telemetry reconnecting...
          </div>
        )
      );
    }

    return this.props.children;
  }
}
