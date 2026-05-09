import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { referralAPI } from '../../api/referral';
import { Copy, Share2, Gift, Users, CheckCircle, Clock, Award, ArrowLeft } from 'lucide-react';

export default function Referrals() {
  const { user, isAuthenticated } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadReferrals();
  }, [isAuthenticated, navigate]);

  const loadReferrals = async () => {
    try {
      const data = await referralAPI.getMyReferrals();
      setReferralData(data);
    } catch (err) {
      console.error('Load referrals error:', err);
      setError('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!referralData?.referralCode) return;
    try {
      await navigator.clipboard.writeText(referralData.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const shareCode = () => {
    const code = referralData?.referralCode;
    if (!code) return;
    
    const text = `Use my referral code ${code} for exclusive discounts on Glanz car detailing services!`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Glanz Referral',
        text: text,
        url: window.location.origin + '/book'
      });
    } else {
      copyCode();
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Pending': 'bg-yellow-500/20 text-yellow-500',
      'Active': 'bg-blue-500/20 text-blue-500',
      'Rewarded': 'bg-green-500/20 text-green-500',
      'Expired': 'bg-gray-500/20 text-gray-500'
    };
    return styles[status] || 'bg-gray-500/20 text-gray-500';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface-bg)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--cta-color)' }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: 'var(--surface-bg)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-[var(--card-bg)]">
            <ArrowLeft size={24} style={{ color: 'var(--text-color)' }} />
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>
            {lang === 'ar' ? 'الإحالة' : 'Referrals'}
          </h1>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/20 text-red-500 mb-4">{error}</div>
        )}

        {/* Your Code Card */}
        <div className="p-6 rounded-2xl mb-6" style={{ 
          background: 'linear-gradient(135deg, var(--cta-color) 0%, #9a7b4f 100%)',
          color: 'white'
        }}>
          <div className="flex items-center gap-2 mb-4">
            <Gift size={24} />
            <span className="font-semibold">{lang === 'ar' ? 'كود الإحالة الخاص بك' : 'Your Referral Code'}</span>
          </div>
          
          <div className="text-center mb-6">
            <div className="text-4xl font-bold tracking-wider mb-2">
              {referralData?.referralCode || '...'}
            </div>
            <p className="text-sm opacity-80">
              {lang === 'ar' 
                ? 'شارك هذا الكود مع أصدقائك واحصل على نقاط عند إتمام أول حجز' 
                : 'Share this code with friends and earn points after their first booking'}
            </p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={copyCode}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/20 hover:bg-white/30 transition"
            >
              <Copy size={18} />
              {copied ? (lang === 'ar' ? 'تم!' : 'Copied!') : (lang === 'ar' ? 'نسخ' : 'Copy')}
            </button>
            <button 
              onClick={shareCode}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-[var(--cta-color)] font-semibold hover:bg-white/90 transition"
            >
              <Share2 size={18} />
              {lang === 'ar' ? 'مشاركة' : 'Share'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users size={20} style={{ color: 'var(--cta-color)' }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>{referralData?.totalReferrals || 0}</div>
            <div className="text-xs" style={{ color: 'var(--muted-color)' }}>{lang === 'ar' ? 'إجمالي الإحالات' : 'Total'}</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock size={20} style={{ color: '#f59e0b' }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>{referralData?.pendingReferrals || 0}</div>
            <div className="text-xs" style={{ color: 'var(--muted-color)' }}>{lang === 'ar' ? 'قيد الانتظار' : 'Pending'}</div>
          </div>
          <div className="p-4 rounded-xl text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Award size={20} style={{ color: '#22c55e' }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>{referralData?.rewardedReferrals || 0}</div>
            <div className="text-xs" style={{ color: 'var(--muted-color)' }}>{lang === 'ar' ? 'مكافأة' : 'Rewarded'}</div>
          </div>
        </div>

        {/* Points Earned */}
        <div className="p-4 rounded-xl mb-6 flex items-center justify-between" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
          <div>
            <div className="text-sm" style={{ color: 'var(--muted-color)' }}>{lang === 'ar' ? 'النقاط المكتسبة' : 'Points Earned'}</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--cta-color)' }}>
              {referralData?.referralPoints || 0} QAR
            </div>
          </div>
          <Award size={32} style={{ color: 'var(--cta-color)' }} />
        </div>

        {/* Referrals List */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--heading-color)' }}>
            {lang === 'ar' ? 'الأصدقاء المحالون' : 'Referred Friends'}
          </h2>
          
          {(!referralData?.referrals || referralData.referrals.length === 0) ? (
            <div className="p-8 text-center rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <Users size={48} className="mx-auto mb-4" style={{ color: 'var(--muted-color)' }} />
              <p style={{ color: 'var(--muted-color)' }}>
                {lang === 'ar' 
                  ? 'لم تحيل أي أصدقاء بعد. شارك كودك وابدأ!' 
                  : 'No referrals yet. Share your code to get started!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {referralData.referrals.map(ref => (
                <div key={ref.id} className="p-4 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium" style={{ color: 'var(--heading-color)' }}>
                      {ref.referredUserName}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(ref.status)}`}>
                      {ref.status === 'Rewarded' ? <CheckCircle size={12} className="inline mr-1" /> : null}
                      {ref.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--muted-color)' }}>
                    <span>{ref.referredUserPhone}</span>
                    <span>•</span>
                    <span>{formatDate(ref.createdAt)}</span>
                    {ref.rewardAmount > 0 && (
                      <>
                        <span>•</span>
                        <span style={{ color: '#22c55e' }}>+{ref.rewardAmount} QAR</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="mt-8 p-4 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
          <h3 className="font-semibold mb-3" style={{ color: 'var(--heading-color)' }}>
            {lang === 'ar' ? 'كيف يعمل؟' : 'How it works'}
          </h3>
          <ol className="space-y-2 text-sm" style={{ color: 'var(--muted-color)' }}>
            <li className="flex gap-2">
              <span className="font-bold" style={{ color: 'var(--cta-color)' }}>1.</span>
              {lang === 'ar' ? 'شارك كود الإحالة مع أصدقائك' : 'Share your referral code with friends'}
            </li>
            <li className="flex gap-2">
              <span className="font-bold" style={{ color: 'var(--cta-color)' }}>2.</span>
              {lang === 'ar' ? 'يسجل صديقك ويطبق الكود عند الحجز' : 'Friend signs up and applies code when booking'}
            </li>
            <li className="flex gap-2">
              <span className="font-bold" style={{ color: 'var(--cta-color)' }}>3.</span>
              {lang === 'ar' ? 'بعد أول حجز مكتمل لصديقك، تحصل على 50 نقطة' : 'After their first completed booking, you earn 50 QAR'}
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}