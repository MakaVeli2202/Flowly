import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Package, Tag, Gift, Percent, ArrowRight, Check, AlertCircle, RefreshCw, Sparkles, Clock, Calendar } from 'lucide-react';
import { offersAPI } from '../../api/offers';
import { packagesAPI } from '../../api/packages';
import { Skeleton } from '../../components/shared/Skeleton';
import { EmptyState } from '../../components/shared/EmptyState';
import { useLanguage } from '../../context/LanguageContext';
import { formatQAR } from '../../utils/currency';

export default function WorkerSales() {
  const { t: _t } = useLanguage();
  const [offers, setOffers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [offersData, packagesData] = await Promise.all([
        offersAPI.getAll(),
        packagesAPI.getAll(),
      ]);
      setOffers(offersData || []);
      setPackages(packagesData || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load sales material.');
    } finally { setLoading(false); }
  };

  const activeOffers = useMemo(() => {
    const now = new Date();
    return offers.filter(o => {
      if (!o.isActive) return false;
      if (o.startsAt && new Date(o.startsAt) > now) return false;
      if (o.endsAt && new Date(o.endsAt) < now) return false;
      return true;
    });
  }, [offers]);

  if (loading) {
    return (
      <div className="min-h-screen py-10" style={{ background: 'var(--surface-bg)' }}>
        <div className="container mx-auto px-4">
          <Skeleton variant="text" className="w-32 h-8 mb-6" />
          <div className="space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} variant="card" className="h-40" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--surface-bg)' }}>
        <EmptyState icon="alert" title="Failed to load" description={error} actionLabel="Try Again" onAction={load} />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10" style={{ background: 'var(--surface-bg)' }}>
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Sales Kit</p>
            <span className="h-px w-7" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--heading-color)]">Sales Kit</h1>
          <p className="text-[var(--muted-color)] mt-1 max-w-md">
            Show this to customers during a visit to introduce services, upgrades, and active offers.
          </p>
          <div className="h-px mt-4" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b,#0ea5a0,transparent)' }} />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-amber-400" />
              <h2 className="text-lg font-bold text-[var(--heading-color)]">Packages</h2>
              <span className="ml-auto text-xs text-[var(--muted-color)]">{packages.filter(p => p.isActive).length} active</span>
            </div>
            <div className="space-y-3">
              {packages.filter(p => p.isActive).slice(0, 5).map(pkg => (
                <div key={pkg.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-bg)]">
                  <div>
                    <h3 className="font-semibold text-[var(--text-color)]">{pkg.name}</h3>
                    <p className="text-sm text-[var(--muted-color)]">{pkg.tier} • {pkg.duration} min</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatQAR(pkg.price)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/packages" className="mt-4 flex items-center justify-center gap-2 p-3 rounded-lg border border-[var(--border-color)] text-[var(--muted-color)] hover:bg-white/5">
              View All Packages <ArrowRight size={14} />
            </Link>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Tag size={18} className="text-purple-400" />
              <h2 className="text-lg font-bold text-[var(--heading-color)]">Active Offers</h2>
              <span className="ml-auto text-xs text-[var(--muted-color)]">{activeOffers.length} active</span>
            </div>
            {activeOffers.length === 0 ? (
              <p className="text-[var(--muted-color)] text-sm py-4">No active offers at the moment.</p>
            ) : (
              <div className="space-y-3">
                {activeOffers.slice(0, 5).map(offer => (
                  <div key={offer.id} className="p-3 rounded-lg bg-[var(--surface-bg)]">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[var(--text-color)]">{offer.title}</h3>
                      {offer.discountPercent && (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">
                          {offer.discountPercent}% OFF
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--muted-color)] mt-1">{offer.description}</p>
                    {(offer.startsAt || offer.endsAt) && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--muted-color)]">
                        {offer.startsAt && <span>From: {new Date(offer.startsAt).toLocaleDateString()}</span>}
                        {offer.endsAt && <span>Until: {new Date(offer.endsAt).toLocaleDateString()}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}