import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicAPI } from '../api/public';
import { ArrowLeft, Clock, RefreshCw } from 'lucide-react';

const formatQar = (n) => `QAR ${Number(n).toLocaleString('en', { minimumFractionDigits: 0 })}`;
const fmtDuration = (min) => min >= 60 ? `${Math.floor(min/60)}h${min%60?` ${min%60}m`:''}` : `${min}m`;

export default function BusinessProfile() {
  const { slug } = useParams();
  const [org, setOrg] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([publicAPI.getOrg(slug), publicAPI.getPackages(slug)])
      .then(([o, p]) => { setOrg(o); setPackages(p); })
      .catch(err => { if (err?.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="flex justify-center py-24">
      <RefreshCw size={22} className="animate-spin text-[var(--color-primary)]" />
    </div>
  );

  if (notFound) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
      <p className="text-xl font-semibold text-[var(--color-text)]">Business not found</p>
      <Link to="/marketplace" className="text-[var(--color-primary)] text-sm underline">Back to marketplace</Link>
    </div>
  );

  const primary = org?.branding?.primaryColor || '#6366f1';
  const secondary = org?.branding?.secondaryColor || '#8b5cf6';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft size={14} /> All businesses
      </Link>

      {/* Hero */}
      <div
        className="rounded-2xl p-8 flex items-center gap-6"
        style={{ background: `linear-gradient(135deg, ${primary}22, ${secondary}33)` }}
      >
        {org?.branding?.logoUrl ? (
          <img src={org.branding.logoUrl} alt={org.name} className="h-20 w-20 object-contain rounded-xl bg-white p-2 shadow" onError={e => e.target.style.display='none'} />
        ) : (
          <div
            className="h-20 w-20 rounded-xl flex items-center justify-center text-white text-3xl font-bold shadow"
            style={{ background: primary }}
          >
            {org?.name?.[0]}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{org?.name}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{org?.industryType?.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* Packages */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Services</h2>
        {packages.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No services listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {packages.map(p => (
              <div key={p.id} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] overflow-hidden flex gap-4 p-4">
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" onError={e => e.target.style.display='none'} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text)] truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{p.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-semibold text-[var(--color-primary)]">{formatQar(p.price)}</span>
                    {p.estimatedDurationMinutes > 0 && (
                      <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-0.5">
                        <Clock size={11} /> {fmtDuration(p.estimatedDurationMinutes)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Book CTA */}
      <div className="text-center py-4">
        <Link
          to="/booking"
          className="btn-primary inline-block px-8 py-3 text-base"
          style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
        >
          Book Now
        </Link>
      </div>
    </div>
  );
}
