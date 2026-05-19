import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LanguageContext } from '../../context/LanguageContext';

export default class ErrorBoundary extends React.Component {
  static contextType = LanguageContext;

  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    const isChunkError = error?.name === 'ChunkLoadError'
      || /loading chunk|failed to fetch dynamically imported/i.test(error?.message || '');
    return { hasError: true, message: error?.message || '', isChunkError };
  }

  componentDidCatch(error, info) {
    const stack = info?.componentStack?.split('\n')[1]?.trim() || '';
    console.error('[ErrorBoundary]', error.message, stack);
  }

  render() {
    const t = this.context?.t || ((key) => key);

    if (this.state.hasError) {
      const isChunk = this.state.isChunkError;
      return (
        <div className="min-h-screen bg-[var(--surface-bg)] flex items-center justify-center p-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 via-transparent to-amber-500/20 blur-3xl" />
            <div className="relative bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-2xl">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 mb-6">
                <AlertTriangle size={32} className="text-rose-400" />
              </div>
              <h2 className="text-xl font-bold text-[var(--heading-color)] mb-2">
                {isChunk ? t('common.errorBoundary.updateAvailable') : t('common.errorBoundary.title')}
              </h2>
              <p className="text-[var(--muted-color)] mb-6 text-sm leading-relaxed">
                {isChunk
                  ? t('common.errorBoundary.chunkMessage')
                  : (this.state.message || t('common.errorBoundary.fallbackMessage'))}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {isChunk ? (
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm hover:shadow-lg hover:shadow-primary/25 transition-all"
                  >
                    <RefreshCw size={16} />
                    {t('common.errorBoundary.reload')}
                  </button>
                ) : (
                  <button
                    onClick={() => this.setState({ hasError: false, message: '', isChunkError: false })}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm hover:shadow-lg hover:shadow-primary/25 transition-all"
                  >
                    <RefreshCw size={16} />
                    {t('common.errorBoundary.tryAgain')}
                  </button>
                )}
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-color)] font-semibold text-sm hover:bg-white/5 transition-all"
                >
                  <Home size={16} />
                  {t('common.errorBoundary.goHome')}
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
