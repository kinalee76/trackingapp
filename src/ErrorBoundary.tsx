import { Component, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort safety net: if a screen throws during render/commit (e.g. a
 * third-party map SDK left in a broken state — see
 * docs/reports/14-white-screen-crash.md), React unmounts the whole tree by
 * default, leaving a permanently blank screen with no way to recover short
 * of force-closing the app. This shows a recoverable error screen instead.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[ErrorBoundary] caught render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: 24,
            textAlign: 'center',
            gap: 12,
          }}
        >
          <p style={{ fontSize: 16, color: '#b91c1c', margin: 0 }}>문제가 발생했습니다.</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}>다시 시도</button>
        </div>
      );
    }
    return this.props.children;
  }
}
