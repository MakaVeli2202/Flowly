import React, { useState } from 'react';
import { aiAPI } from '../../api/ai';
import { Brain, TrendingUp, Megaphone, ShoppingCart, Loader, AlertCircle } from 'lucide-react';

const TABS = [
  { key: 'insights',  label: 'Business Insights', icon: TrendingUp },
  { key: 'crm',       label: 'CRM Assistant',     icon: Brain },
  { key: 'marketing', label: 'Marketing Copy',    icon: Megaphone },
  { key: 'upsell',    label: 'Upsell Suggestions',icon: ShoppingCart },
];

function ResultBox({ text }) {
  if (!text) return null;
  return (
    <div className="mt-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] whitespace-pre-wrap text-sm text-[var(--color-text)] leading-relaxed">
      {text}
    </div>
  );
}

export default function AdminAI() {
  const [tab, setTab] = useState('insights');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  // CRM
  const [customerId, setCustomerId] = useState('');
  // Marketing
  const [objective, setObjective] = useState('');
  const [language, setLanguage] = useState('en');
  // Upsell
  const [bookingId, setBookingId] = useState('');

  const call = async (fn) => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const data = await fn();
      setResult(data.reply || JSON.stringify(data));
    } catch (e) {
      setError(e?.response?.data?.message || 'Request failed. Check API key configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleInsights    = () => call(() => aiAPI.getInsights());
  const handleCrm         = () => customerId && call(() => aiAPI.crmAssist(Number(customerId)));
  const handleMarketing   = () => objective && call(() => aiAPI.generateMarketing(objective, language));
  const handleUpsell      = () => bookingId && call(() => aiAPI.upsellSuggestions(Number(bookingId)));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6 flex items-center gap-2">
        <Brain size={24} className="text-[var(--color-primary)]" />
        AI Assistant
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setResult(''); setError(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-6">

        {tab === 'insights' && (
          <div>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Generates a 30-day business performance digest with anomaly detection and recommended actions.
            </p>
            <button onClick={handleInsights} disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <Loader size={16} className="animate-spin" /> : <TrendingUp size={16} />}
              Generate Insights
            </button>
          </div>
        )}

        {tab === 'crm' && (
          <div>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Enter a customer ID to get AI-powered next action suggestions for that customer.
            </p>
            <div className="flex gap-3">
              <input
                type="number"
                placeholder="Customer ID"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="input flex-1"
              />
              <button onClick={handleCrm} disabled={loading || !customerId} className="btn-primary flex items-center gap-2">
                {loading ? <Loader size={16} className="animate-spin" /> : <Brain size={16} />}
                Analyse
              </button>
            </div>
          </div>
        )}

        {tab === 'marketing' && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              Describe your campaign objective and choose a language to generate copy.
            </p>
            <input
              type="text"
              placeholder="e.g. Promote our new ceramic coating package to VIP customers"
              value={objective}
              onChange={e => setObjective(e.target.value)}
              className="input w-full"
            />
            <select value={language} onChange={e => setLanguage(e.target.value)} className="input w-full">
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="de">German</option>
            </select>
            <button onClick={handleMarketing} disabled={loading || !objective} className="btn-primary flex items-center gap-2">
              {loading ? <Loader size={16} className="animate-spin" /> : <Megaphone size={16} />}
              Generate Copy
            </button>
          </div>
        )}

        {tab === 'upsell' && (
          <div>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Enter a booking ID to get upsell and add-on suggestions based on the current booking.
            </p>
            <div className="flex gap-3">
              <input
                type="number"
                placeholder="Booking ID"
                value={bookingId}
                onChange={e => setBookingId(e.target.value)}
                className="input flex-1"
              />
              <button onClick={handleUpsell} disabled={loading || !bookingId} className="btn-primary flex items-center gap-2">
                {loading ? <Loader size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                Get Suggestions
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 text-red-500 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <ResultBox text={result} />
      </div>
    </div>
  );
}
