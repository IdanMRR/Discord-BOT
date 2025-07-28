import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon, BugAntIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate a unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log to external service if available
    this.logErrorToService(error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      error,
      errorInfo
    });
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    try {
      // In a real application, you would send this to an error tracking service
      // like Sentry, LogRocket, or Bugsnag
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: localStorage.getItem('userId') || 'anonymous'
      };

      console.log('Error data for logging service:', errorData);
      
      // Example API call to log error
      // fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData)
      // }).catch(err => console.error('Failed to log error:', err));
      
    } catch (loggingError) {
      console.error('Failed to log error to service:', loggingError);
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private copyErrorToClipboard = () => {
    const errorText = `
Error ID: ${this.state.errorId}
Time: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Error: ${this.state.error?.message}
Stack: ${this.state.error?.stack}

Component Stack: ${this.state.errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorText)
      .then(() => {
        alert('Error details copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy to clipboard:', err);
        // Fallback: show error details in an alert
        alert(errorText);
      });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Oops! Something went wrong
              </h1>
              
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                We're sorry, but something unexpected happened. The error has been logged and we'll look into it.
              </p>

              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-6">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                  Error ID: {this.state.errorId}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Time: {new Date().toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={this.handleReset}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Try Again
                </button>

                <button
                  onClick={this.handleReload}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Reload Page
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <HomeIcon className="w-4 h-4" />
                  Go Home
                </button>

                <button
                  onClick={this.copyErrorToClipboard}
                  className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <BugAntIcon className="w-4 h-4" />
                  Copy Error Details
                </button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Developer Information
                  </summary>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                    <div className="text-xs text-red-800 dark:text-red-200 font-mono mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <pre className="text-xs text-red-700 dark:text-red-300 overflow-auto max-h-32">
                        {this.state.error.stack}
                      </pre>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <details className="mt-2">
                        <summary className="text-xs font-medium text-red-600 dark:text-red-400 cursor-pointer">
                          Component Stack
                        </summary>
                        <pre className="text-xs text-red-700 dark:text-red-300 overflow-auto max-h-32 mt-1">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    console.error('Manual error report:', error, errorInfo);
    
    // In a real application, you would send this to an error tracking service
    const errorData = {
      message: error.message,
      stack: error.stack,
      additionalInfo: errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: localStorage.getItem('userId') || 'anonymous'
    };

    console.log('Error data for logging service:', errorData);
  };
}

export default ErrorBoundary;