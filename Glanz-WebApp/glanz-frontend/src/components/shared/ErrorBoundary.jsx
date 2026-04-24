import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Something unexpected happened' };
  }

  componentDidCatch(error, info) {
    const stack = info?.componentStack?.split('\n')[1]?.trim() || '';
    console.error('[ErrorBoundary]', error.message, stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--surface-bg)] flex items-center justify-center p-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 via-transparent to-amber-500/20 blur-3xl" />
            <div className="relative bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-2xl">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 mb-6">
                <AlertTriangle size={32} className="text-rose-400" />
              </div>
              <h2 className="text-xl font-bold text-[var(--heading-color)] mb-2">Oops! Something went wrong</h2>
              <p className="text-[var(--muted-color)] mb-6 text-sm leading-relaxed">
                {this.state.message}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => this.setState({ hasError: false, message: '' })}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm hover:shadow-lg hover:shadow-primary/25 transition-all"
                >
                  <RefreshCw size={16} />
                  Try Again
                </button>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-color)] font-semibold text-sm hover:bg-white/5 transition-all"
                >
                  <Home size={16} />
                  Go Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
