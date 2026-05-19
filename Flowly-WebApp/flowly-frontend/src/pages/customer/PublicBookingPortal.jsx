import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Clock, DollarSign, ArrowRight, AlertCircle, Building2 } from 'lucide-react';
import { publicAPI } from '../../api/public';
import { useAuth } from '../../context/AuthContext';

function PackageCard({ pkg, orgSlug, currency, onBook }) {
  const durationHours = Math.floor(pkg.estimatedDurationMinutes / 60);
  const durationMins  = pkg.estimatedDurationMinutes % 60;
  const durationLabel = durationHours > 0
    ? `${durationHours}h${durationMins > 0 ? ` ${durationMins}m` : ''}`
    : `${durationMins}m`;

  return (
    <div className="bg-surface-card border border-border rounded-2xl overflow-hidden hover:border-[var(--portal-primary,#c8a96b)]/60 transition-colors group">
      {pkg.imageUrl && (
        <img src={pkg.imageUrl} alt={pkg.name} className="w-full h-40 object-cover" />
      )}
      <div className="p-5 space-y-3">
        <h3 className="font-bold text-lg">{pkg.name}</h3>
        {pkg.description && <p className="text-muted text-sm line-clamp-2">{pkg.description}</p>}

        <div className="flex items-center gap-4 text-sm text-muted">
          {pkg.estimatedDurationMinutes > 0 && (
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{durationLabel}</span>
          )}
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <DollarSign className="w-3.5 h-3.5" />
            {pkg.price} {currency}
          </span>
        </div>

        <button
          onClick={() => onBook(pkg)}
          className="w-full py-2 rounded-lg bg-[var(--portal-primary,#c8a96b)] text-black font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1 mt-1"
        >
          Book Now <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function PublicBookingPortal() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [org, setOrg] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      publicAPI.getOrg(slug),
      publicAPI.getPackages(slug),
    ]).then(([orgData, pkgs]) => {
      setOrg(orgData);
      setPackages(pkgs);

      // Apply org brand colors to portal scope
      if (orgData.branding?.primaryColor) {
        document.documentElement.style.setProperty('--portal-primary', orgData.branding.primaryColor);
      }
    }).catch(() => {
      setNotFound(true);
    }).finally(() => {
      setLoading(false);
    });

    return () => {
      document.documentElement.style.removeProperty('--portal-primary');
    };
  }, [slug]);

  const handleBook = (pkg) => {
    if (!user) {
      navigate('/login', { state: { from: `/book/${slug}`, message: `Sign in to book ${pkg.name} at ${org?.name}` } });
      return;
    }
    // Navigate to standard booking page with package pre-selected
    navigate('/booking', { state: { selectedPackage: pkg, orgSlug: slug } });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-muted mx-auto" />
          <h1 className="text-2xl font-bold">Business Not Found</h1>
          <p className="text-muted">The link you followed may be outdated or incorrect.</p>
          <Link to="/" className="btn btn-outline">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div
        className="py-16 px-6 text-center"
        style={{
          background: org?.branding?.primaryColor
            ? `linear-gradient(135deg, ${org.branding.primaryColor}20, transparent)`
            : undefined,
        }}
      >
        {org?.branding?.logoUrl ? (
          <img src={org.branding.logoUrl} alt={org.name} className="h-16 mx-auto mb-4 object-contain" />
        ) : (
          <Building2 className="w-12 h-12 mx-auto mb-4 text-[var(--portal-primary,#c8a96b)]" />
        )}
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{org?.name}</h1>
        <p className="text-muted">Book an appointment online</p>
      </div>

      {/* Package grid */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        {packages.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p>No services available for booking at this time.</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-6">Our Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  orgSlug={slug}
                  currency={org?.defaultCurrency || 'QAR'}
                  onBook={handleBook}
                />
              ))}
            </div>
          </>
        )}

        {!user && (
          <p className="text-center text-sm text-muted mt-10">
            Already have an account?{' '}
            <Link to={`/login?from=/book/${slug}`} className="text-[var(--portal-primary,#c8a96b)] hover:underline">Sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
