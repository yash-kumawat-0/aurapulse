// ============================================
// ErrorBoundary — Graceful React Fault Recovery
// ============================================
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('AuraPulse UI boundary caught error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-fallback" role="alert">
          <div className="app-fallback-card">
            <h1>Something paused unexpectedly</h1>
            <p>Your air quality session encountered an unexpected glitch.</p>
            <button type="button" onClick={() => window.location.reload()} className="app-fallback-btn">
              Reload AuraPulse
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
