import React, { useState } from 'react';
import { reportsAPI } from '../../api/reports';
import { Download, FileText, AlertCircle } from 'lucide-react';
import apiClient from '../../api/axios';

const UI = {
  en: {
    title: 'RKSV Receipts (Austria)',
    subtitle: 'Fiscally compliant receipts for Austrian tax law (Registrierkassenpflicht).',
    month: 'Month',
    load: 'Load Receipts',
    download: 'Download CSV',
    loading: 'Loading...',
    empty: 'No completed + paid bookings found for this month.',
    booking: 'Booking',
    date: 'Date',
    gross: 'Gross (EUR)',
    vat: 'VAT 20%',
    net: 'Net',
    signature: 'Signature Chain',
    noteTitle: 'Important',
    note: 'These receipts use a SHA-256 hash chain. For full RKSV compliance, register your Signature Creation Unit (SCU) with the Austrian Finanzonline portal and replace the signature chain with your registered device output.',
  },
  ar: {
    title: 'إيصالات RKSV (النمسا)',
    subtitle: 'إيصالات متوافقة ضريبياً لقانون الضرائب النمساوي.',
    month: 'الشهر',
    load: 'تحميل الإيصالات',
    download: 'تنزيل CSV',
    loading: 'جارٍ التحميل...',
    empty: 'لا توجد حجوزات مكتملة ومدفوعة لهذا الشهر.',
    booking: 'الحجز',
    date: 'التاريخ',
    gross: 'الإجمالي',
    vat: 'ضريبة القيمة المضافة',
    net: 'الصافي',
    signature: 'سلسلة التوقيع',
    noteTitle: 'ملاحظة',
    note: 'تستخدم هذه الإيصالات سلسلة تجزئة SHA-256.',
  },
  de: {
    title: 'RKSV-Belege (Österreich)',
    subtitle: 'Steuerkonformer Kassenbeleg gemäß österreichischer Registrierkassenpflicht.',
    month: 'Monat',
    load: 'Belege laden',
    download: 'CSV herunterladen',
    loading: 'Laden...',
    empty: 'Keine abgeschlossenen und bezahlten Buchungen für diesen Monat gefunden.',
    booking: 'Buchung',
    date: 'Datum',
    gross: 'Brutto (EUR)',
    vat: 'MwSt. 20%',
    net: 'Netto',
    signature: 'Signaturkette',
    noteTitle: 'Hinweis',
    note: 'Diese Belege verwenden eine SHA-256-Hashkette. Für volle RKSV-Konformität registrieren Sie Ihre Signaturerstellungseinheit (SEE) im Finanzonline-Portal und ersetzen Sie die Signaturkette durch die Ausgabe Ihres registrierten Geräts.',
  },
};

export default function AdminRKSV() {
  const lang = localStorage.getItem('lang') || 'en';
  const ui = UI[lang] || UI.en;

  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [receipts, setReceipts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiClient.get(`/Reports/rksv-receipts?month=${month}`);
      setReceipts(r.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!receipts?.receipts?.length) return;
    const rows = [
      ['BookingNumber', 'Date', 'Gross EUR', 'VAT 20%', 'Net EUR', 'VatRate', 'SignatureChain'],
      ...receipts.receipts.map(r => [
        r.bookingNumber, r.scheduledDate?.slice(0, 10),
        r.grossAmount, r.vatAmount, r.netAmount, r.vatRate, r.signatureChain,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `RKSV-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--surface-bg)' }}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[var(--heading-color)]">{ui.title}</h1>
          <p className="text-sm text-[var(--muted-color)] mt-1">{ui.subtitle}</p>
        </div>

        {/* Notice */}
        <div className="flex gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <AlertCircle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-yellow-400 mb-0.5">{ui.noteTitle}</p>
            <p className="text-xs text-[var(--muted-color)]">{ui.note}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] text-sm" />
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
            <FileText size={14} /> {loading ? ui.loading : ui.load}
          </button>
          {receipts?.receipts?.length > 0 && (
            <button onClick={downloadCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] text-sm font-semibold hover:bg-[var(--surface-bg)] transition">
              <Download size={14} /> {ui.download}
            </button>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Results */}
        {receipts && (
          receipts.receipts?.length === 0 ? (
            <p className="text-[var(--muted-color)] text-sm py-8 text-center">{ui.empty}</p>
          ) : (
            <div className="rounded-xl border border-[var(--border-color)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                    {[ui.booking, ui.date, ui.gross, ui.vat, ui.net, ui.signature].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--muted-color)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receipts.receipts.map(r => (
                    <tr key={r.bookingNumber} className="border-b border-[var(--border-color)] hover:bg-[var(--card-bg)] transition">
                      <td className="px-4 py-3 font-mono text-xs text-primary">{r.bookingNumber}</td>
                      <td className="px-4 py-3 text-[var(--text-color)]">{r.scheduledDate?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-[var(--text-color)]">{Number(r.grossAmount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[var(--muted-color)]">{Number(r.vatAmount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-[var(--text-color)]">{Number(r.netAmount).toFixed(2)}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[var(--muted-color)] max-w-[180px] truncate" title={r.signatureChain}>{r.signatureChain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 text-xs text-[var(--muted-color)] border-t border-[var(--border-color)]">
                {receipts.count} receipts — period {receipts.from?.slice(0, 10)} to {receipts.to?.slice(0, 10)}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
