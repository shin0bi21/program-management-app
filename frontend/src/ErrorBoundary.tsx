import { Component, createRef, type ErrorInfo, type ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  private fallbackRef = createRef<HTMLElement>();

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.fallbackRef.current?.focus();
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        ref={this.fallbackRef}
        className="app-error-boundary"
        aria-labelledby="app-error-boundary-title"
        tabIndex={-1}
      >
        <div className="app-error-boundary__content">
          <h1 id="app-error-boundary-title">Something went wrong</h1>
          <p>An unexpected error occurred. Please reload the page.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </main>
    );
  }
}
