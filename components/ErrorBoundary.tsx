"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Send to debug API
    fetch('/api/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    }).catch(console.error);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-8 bg-red-50 min-h-screen z-50 fixed inset-0 overflow-auto">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Dashboard Crash Detected</h1>
          <p className="text-red-800 mb-4">An error occurred while rendering the dashboard.</p>
          <div className="bg-white p-4 rounded border border-red-200 overflow-auto">
            <h2 className="font-bold">Error:</h2>
            <pre className="text-sm text-red-600 whitespace-pre-wrap">{this.state.error?.toString()}</pre>
            <h2 className="font-bold mt-4">Component Stack:</h2>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
