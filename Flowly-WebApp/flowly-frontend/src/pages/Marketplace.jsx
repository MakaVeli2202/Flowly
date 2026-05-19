import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicAPI } from '../api/public';
import { Search, MapPin, RefreshCw } from 'lucide-react';

export default function Marketplace() {
  const [orgs, setOrgs] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    publicAPI.listOrgs()
      .then(setOrgs)
      .catch(() => setError('Failed to load businesses.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Find a Business</h1>
        <p className="text-[var(--color-text-muted)]">Detailing studios and auto care services on the Flowly platform.</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search businesses..."
          className="input w-full pl-9"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw size={20} className="animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      {!loading && filtered.length === 0 && !error && (
        <p className="text-center text-[var(--color-text-muted)]">No businesses found.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {filtered.map(org => (
          <Link
            key={org.slug}
            to={`/business/${org.slug}`}
            className="block bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div
              className="h-24 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${org.primaryColor}33, ${org.primaryColor}66)` }}
            >
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="h-14 object-contain" onError={e => e.target.style.display='none'} />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ background: org.primaryColor }}
                >
                  {org.name[0]}
                </div>
              )}
            </div>
            <div className="p-4 space-y-1">
              <p className="font-semibold text-[var(--color-text)]">{org.name}</p>
              <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                <MapPin size={11} /> {org.industryType?.replace(/_/g, ' ')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
