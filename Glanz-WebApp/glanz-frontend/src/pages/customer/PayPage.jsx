import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { paymentLinkAPI } from '../../api/paymentLink';
import { formatQAR } from '../../utils/currency';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

export default function PayPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    paymentLinkAPI.getByToken(token)
      .then(d => setData(d))
      .catch(() => setError('Payment link not found or expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--muted-color)] text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={22} className="text-red-400" />
          </div>
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (data?.alreadyPaid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={22} className="text-green-400" />
          </div>
          <p className="text-green-400 font-semibold text-lg mb-1">Already Paid</p>
          <p className="text-[var(--muted-color)] text-sm">Booking #{data.bookingNumber} has been paid.</p>
        </div>
      </div>
    );
  }

  const items = data?.items || [];
  const addOns = data?.addOns || [];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-bg)] overflow-hidden shadow-lg">
          {/* Header */}
          <div className="px-6 py-5 border-b border-[var(--border-color)] bg-white/[0.02]">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">Invoice</p>
            <h1 className="text-xl font-bold text-[var(--heading-color)]">#{data?.bookingNumber}</h1>
          </div>

          {/* Customer + Schedule */}
          <div className="px-6 py-4 border-b border-[var(--border-color)] space-y-1">
            <p className="text-sm font-semibold text-[var(--text-color)]">{data?.customerName}</p>
            <div className="flex items-center gap-2 text-[var(--muted-color)] text-xs">
              <Clock size={12} />
              <span>
                {data?.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : ''}{data?.timeSlot ? ` · ${data.timeSlot}` : ''}
              </span>
            </div>
          </div>

          {/* Line items */}
          <div className="px-6 py-4 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-[var(--text-color)]">{item.name}{item.qty > 1 ? ` x${item.qty}` : ''}</span>
                <span className="font-semibold text-[var(--heading-color)]">{formatQAR(item.price * item.qty)}</span>
              </div>
            ))}
            {addOns.map((a, i) => (
              <div key={`addon-${i}`} className="flex justify-between text-sm">
                <span className="text-[var(--muted-color)] italic">{a.name}</span>
                <span className="font-semibold text-[var(--muted-color)]">{formatQAR(a.price)}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="px-6 py-4 border-t border-[var(--border-color)] flex justify-between items-center">
            <span className="text-sm font-bold uppercase tracking-widest text-[var(--muted-color)]">Total</span>
            <span className="text-xl font-bold text-[var(--heading-color)]">{formatQAR(data?.totalAmount)}</span>
          </div>

          {/* Info notice */}
          <div className="px-6 pb-6">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400">
              Please pay this amount at the time of service. Contact us if you have any questions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
