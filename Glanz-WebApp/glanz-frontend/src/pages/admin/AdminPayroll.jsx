import React, { useState, useEffect, useRef } from 'react';
import { authAPI } from '../../api/auth';
import AppModal from '../../components/shared/AppModal';
import { useToast } from '../../components/shared/Toast';
import {
  DollarSign, Check, Clock, FileText, Download, Wallet,
  AlertCircle, Users, CheckCircle,
} from 'lucide-react';
import { getBusiness } from '../../config/business';
import { useLanguage } from '../../context/LanguageContext';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const UI_BY_LANG = {
  en: {
    subtitle: 'Monthly salary overview and payment tracking for all active workers.',
    totalPayroll: 'Total Payroll',
    jobsDone: 'Jobs Done',
    revenue: 'Revenue',
    paid: 'Paid',
    periodDesc: (month, year) => `${month} ${year} - click Pay Slip to view or download individual payslips.`,
    noData: 'No payroll data for this period.',
    noDataHint: 'Workers with completed bookings in this month will appear here.',
    worker: 'Worker',
    salary: 'Salary',
    jobs: 'Jobs',
    status: 'Status',
    paySlip: 'Pay Slip',
    notSet: 'Not set',
    markPaid: 'Mark Paid',
    salaryUnset: 'Salary unset',
    total: 'Total',
    paidSuffix: 'paid',
  },
  ar: {
    subtitle: 'Ù†Ø¸Ø±Ø© Ø¹Ø§Ù…Ø© Ø´Ù‡Ø±ÙŠØ© Ø¹Ù„Ù‰ Ø§Ù„Ø±ÙˆØ§ØªØ¨ ÙˆØªØªØ¨Ø¹ Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª Ù„Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¹Ø§Ù…Ù„ÙŠÙ† Ø§Ù„Ù†Ø´Ø·ÙŠÙ†.',
    totalPayroll: 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø±ÙˆØ§ØªØ¨',
    jobsDone: 'Ø§Ù„Ù…Ù‡Ø§Ù… Ø§Ù„Ù…Ù†Ø¬Ø²Ø©',
    revenue: 'Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª',
    paid: 'Ù…Ø¯ÙÙˆØ¹',
    periodDesc: (month, year) => `${month} ${year} - Ø§Ø¶ØºØ· Ø¹Ù„Ù‰ ÙƒØ´Ù Ø§Ù„Ø±Ø§ØªØ¨ Ù„Ù„Ø¹Ø±Ø¶ Ø£Ùˆ Ø§Ù„ØªØ­Ù…ÙŠÙ„.`,
    noData: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ø±ÙˆØ§ØªØ¨ Ù„Ù‡Ø°Ù‡ Ø§Ù„ÙØªØ±Ø©.',
    noDataHint: 'Ø³ÙŠØ¸Ù‡Ø± Ø§Ù„Ø¹Ø§Ù…Ù„ÙˆÙ† Ø§Ù„Ø°ÙŠÙ† Ù„Ø¯ÙŠÙ‡Ù… Ø­Ø¬ÙˆØ²Ø§Øª Ù…ÙƒØªÙ…Ù„Ø© Ø®Ù„Ø§Ù„ Ù‡Ø°Ø§ Ø§Ù„Ø´Ù‡Ø± Ù‡Ù†Ø§.',
    worker: 'Ø§Ù„Ø¹Ø§Ù…Ù„',
    salary: 'Ø§Ù„Ø±Ø§ØªØ¨',
    jobs: 'Ø§Ù„Ù…Ù‡Ø§Ù…',
    status: 'Ø§Ù„Ø­Ø§Ù„Ø©',
    paySlip: 'ÙƒØ´Ù Ø§Ù„Ø±Ø§ØªØ¨',
    notSet: 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯',
    markPaid: 'ØªØ­Ø¯ÙŠØ¯ ÙƒÙ…Ø¯ÙÙˆØ¹',
    salaryUnset: 'Ø§Ù„Ø±Ø§ØªØ¨ ØºÙŠØ± Ù…Ø­Ø¯Ø¯',
    total: 'Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ',
    paidSuffix: 'Ù…Ø¯ÙÙˆØ¹',
  },
  de: {
    subtitle: 'Monatliche Gehaltsubersicht und Zahlungsverfolgung fur alle aktiven Mitarbeiter.',
    totalPayroll: 'Gesamtlohn',
    jobsDone: 'Erledigte Auftrage',
    revenue: 'Umsatz',
    paid: 'Bezahlt',
    periodDesc: (month, year) => `${month} ${year} - klicken Sie auf Gehaltszettel zum Anzeigen oder Herunterladen.`,
    noData: 'Keine Lohndaten fur diesen Zeitraum.',
    noDataHint: 'Mitarbeiter mit abgeschlossenen Buchungen in diesem Monat erscheinen hier.',
    worker: 'Mitarbeiter',
    salary: 'Gehalt',
    jobs: 'Auftrage',
    status: 'Status',
    paySlip: 'Gehaltszettel',
    notSet: 'Nicht gesetzt',
    markPaid: 'Als bezahlt markieren',
    salaryUnset: 'Gehalt nicht gesetzt',
    total: 'Gesamt',
    paidSuffix: 'bezahlt',
  },
};


function PrismaticCursorOrb() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let mx = window.innerWidth/2, my = window.innerHeight/2, cx = mx, cy = my, rafId;
    const onMove = e => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx-cx)*.07; cy += (my-cy)*.07;
      const hue = (mx/window.innerWidth)*360;
      el.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      el.style.background = `conic-gradient(from ${hue}deg,rgba(255,0,80,.09),rgba(255,160,0,.07),rgba(255,255,0,.06),rgba(0,255,100,.07),rgba(0,160,255,.09),rgba(160,0,255,.07),rgba(255,0,80,.09))`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive:true });
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('mousemove', onMove); };
  }, []);
  return <div ref={ref} className="prism-cursor-blob" style={{ width:480, height:480, top:'-240px', left:'-240px' }} />;
}

export default function AdminPayroll() {
  const toast = useToast();
  const { t, lang } = useLanguage();
  const localeKey = String(lang || '').startsWith('ar') ? 'ar' : String(lang || '').startsWith('de') ? 'de' : 'en';
  const ui = UI_BY_LANG[localeKey] || UI_BY_LANG.en;
  const business = getBusiness();
  const [payroll,        setPayroll]        = useState([]);
  const [payrollMonth,   setPayrollMonth]   = useState(new Date().getMonth() + 1);
  const [payrollYear,    setPayrollYear]    = useState(new Date().getFullYear());
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollMarking, setPayrollMarking] = useState(null);
  const [detailsModal,   setDetailsModal]   = useState({ open:false, worker:null });
  const closeDetailsModal = () => setDetailsModal({ open:false, worker:null });

  useEffect(() => {
    authAPI.checkPayrollDue()
      .then(result => {
        if (result.hasUnpaid && result.unpaidCount > 0 && new Date().getDate() >= 25) {
          toast.error(`Payroll due: ${result.unpaidCount} worker(s) unpaid (QAR ${result.totalAmount?.toLocaleString()}). Please pay before end of month.`, { duration: 8000 });
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPayroll = async () => {
    try {
      setPayrollLoading(true);
      const data = await authAPI.getPayrollSummary(payrollMonth, payrollYear);
      setPayroll(data || []);
    } catch { setPayroll([]); }
    finally { setPayrollLoading(false); }
  };

  useEffect(() => { fetchPayroll(); }, [payrollMonth, payrollYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkPaid = async (worker) => {
    try {
      setPayrollMarking(worker.workerId);
      await authAPI.markWorkerPaid(worker.workerId, payrollMonth, payrollYear);
      toast.success('Payment recorded!');
      await fetchPayroll();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to record payment');
    } finally {
      setPayrollMarking(null);
    }
  };

  const totalSalary  = payroll.reduce((s,p) => s + (p.monthlySalary ?? 0), 0);
  const totalJobs    = payroll.reduce((s,p) => s + p.jobsCompleted, 0);
  const totalRevenue = payroll.reduce((s,p) => s + (p.totalRevenue ?? 0), 0);
  const paidCount    = payroll.filter(p => p.isPaid).length;

  return (
    <>
      <PrismaticCursorOrb />

      <div className="min-h-screen py-10 relative"
        style={{ background:'radial-gradient(circle at 7% 6%,rgba(200,169,107,.05) 0%,transparent 38%),radial-gradient(circle at 93% 92%,rgba(14,165,160,.04) 0%,transparent 32%)' }}>
        <div className="absolute top-0 right-0 w-80 h-64 rounded-full pointer-events-none"
          style={{ background:'conic-gradient(from 55deg,rgba(200,169,107,.06),rgba(14,165,160,.04),rgba(200,169,107,.06))', filter:'blur(85px)', animation:'spectrum-float 20s ease-in-out infinite' }} />

        <div className="container mx-auto px-4 max-w-4xl relative z-10 space-y-6">

          {/* â”€â”€ Header â”€â”€ */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="h-px w-7" style={{ background:'linear-gradient(90deg,transparent,#c8a96b)' }} />
              <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">{t('adminPanel')}</p>
              <span className="h-px w-7" style={{ background:'linear-gradient(90deg,#c8a96b,transparent)' }} />
            </div>
            <div className="flex items-center gap-3 mb-1.5">
               <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
                 <DollarSign size={16} style={{ color:'#c8a96b' }} />
               </div>
               <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{t('payroll')}</h1>
            </div>
            <p className="text-sm text-[var(--muted-color)] ml-12">{ui.subtitle}</p>
          </div>

          {/* â”€â”€ Stats row â”€â”€ */}
          {payroll.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label:ui.totalPayroll,  value:`QAR ${totalSalary.toLocaleString()}`,  color:'#c8a96b' },
                { label:ui.jobsDone,      value:totalJobs,                               color:'#6366f1' },
                { label:ui.revenue,       value:`QAR ${totalRevenue.toLocaleString()}`,  color:'#22c55e' },
                { label:ui.paid,          value:`${paidCount}/${payroll.length}`,        color: paidCount === payroll.length ? '#22c55e' : '#fbbf24' },
              ].map(s => (
                <div key={s.label} className="glass-card p-4 card-stagger">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)] mb-1">{s.label}</p>
                  <p className="font-black text-lg" style={{ color:s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* â”€â”€ Payroll Table card â”€â”€ */}
          <div className="glass-card relative overflow-hidden card-stagger">
            <div className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background:'linear-gradient(90deg,transparent,#c8a96b 38%,#10b981 62%,transparent)' }} />
            <div className="absolute top-0 left-0 w-[3px] h-full"
              style={{ background:'linear-gradient(180deg,#c8a96b 0%,#c8a96b44 60%,transparent 100%)' }} />
            <div className="prism-ray" style={{ left:'70%', width:'14%', animation:'prism-ray-sweep 22s ease-in-out 2s infinite' }} />

            <div className="p-7">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                       style={{ background:'rgba(200,169,107,.12)', border:'1px solid rgba(200,169,107,.24)' }}>
                       <Users size={14} style={{ color:'#c8a96b' }} />
                     </div>
                     <h2 className="premium-heading text-xl font-bold text-[var(--heading-color)]">{t('payrollSummary')}</h2>
                   </div>
                <div className="flex items-center gap-2">
                  <select value={payrollMonth} onChange={e => setPayrollMonth(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-xs font-bold focus:outline-none">
                    {MONTHS_SHORT.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <input type="number" min={2020} max={2099} value={payrollYear}
                    onChange={e => setPayrollYear(Number(e.target.value))}
                    className="w-20 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-xs font-bold focus:outline-none" />
                </div>
              </div>
                <p className="text-sm text-[var(--muted-color)] mb-5 ml-11">{ui.periodDesc(MONTHS[payrollMonth-1], payrollYear)}</p>
              <div className="mb-5"><div className="spectrum-line" /></div>

              {payrollLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
                </div>
              ) : payroll.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-[var(--muted-color)] text-sm">{ui.noData}</p>
                  <p className="text-[var(--muted-color)] text-xs mt-1">{ui.noDataHint}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)]">
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{ui.worker}</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{ui.salary}</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{ui.jobs}</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{ui.revenue}</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{ui.status}</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{ui.paySlip}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {payroll.map(p => (
                        <tr key={p.workerId} className="hover:bg-white/[.015] transition">
                          <td className="px-3 py-3 font-bold text-[var(--heading-color)]">{p.workerName}</td>
                          <td className="px-3 py-3 font-black text-primary">
                            {p.monthlySalary != null
                              ? `QAR ${p.monthlySalary.toLocaleString()}`
                              : <span className="text-[var(--muted-color)] font-normal italic text-xs">{ui.notSet}</span>}
                          </td>
                          <td className="px-3 py-3 text-[var(--text-color)]">{p.jobsCompleted}</td>
                          <td className="px-3 py-3 text-green-400 font-bold">
                            QAR {(p.revenueGenerated ?? 0).toLocaleString()}
                            {p.totalTips > 0 && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#fb923c' }}>+{p.totalTips} tips</span>}
                          </td>
                          <td className="px-3 py-3">
                            {p.isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                                style={{ background:'rgba(34,197,94,.10)', border:'1px solid rgba(34,197,94,.28)', color:'#22c55e' }}>
                                <Check size={10} /> Paid
                              </span>
                            ) : p.monthlySalary != null ? (
                              <button
                                disabled={payrollMarking === p.workerId}
                                onClick={() => handleMarkPaid(p)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition hover:opacity-80 disabled:opacity-50"
                                style={{ background:'rgba(245,158,11,.10)', borderColor:'rgba(245,158,11,.28)', color:'#fbbf24' }}>
                                {payrollMarking === p.workerId ? 'â€¦' : <><Clock size={10} /> {ui.markPaid}</>}
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold"
                                style={{ background:'rgba(148,163,184,.10)', border:'1px solid rgba(148,163,184,.28)', color:'#94a3b8' }}>
                                {ui.salaryUnset}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <button
                              onClick={() => setDetailsModal({ open:true, worker:p })}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition hover:bg-white/5"
                              style={{ borderColor:'rgba(200,169,107,.40)', color:'#c8a96b' }}>
                              <FileText size={10} /> {ui.paySlip}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[var(--border-color)]">
                          <td className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-color)]">{ui.total}</td>
                        <td className="px-3 py-3 font-black text-primary">QAR {totalSalary.toLocaleString()}</td>
                        <td className="px-3 py-3 font-bold text-[var(--text-color)]">{totalJobs}</td>
                        <td className="px-3 py-3 font-bold text-green-400">QAR {totalRevenue.toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <span className="text-[10px] font-bold" style={{ color: paidCount === payroll.length ? '#22c55e' : '#fbbf24' }}>
                            {paidCount}/{payroll.length} {ui.paidSuffix}
                          </span>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* â”€â”€ Pay Slip Modal â”€â”€ */}
      <AppModal isOpen={detailsModal.open} title="Pay Slip" message="" variant="info" onClose={closeDetailsModal}>
        {detailsModal.worker && (() => {
          const worker = detailsModal.worker;
          const companyName = business.name || 'Flowly';
          const companyAddress = business.location || '';
          const companyPhone = business.phone || '';
          const companyEmail = business.email || '';
          const footerText = '';
          const payPeriod = `${MONTHS[payrollMonth-1]} ${payrollYear}`;
          const status = worker.isPaid ? 'PAID' : 'UNPAID';
          const statusColor = worker.isPaid ? '#22c55e' : '#fbbf24';
          const statusBg    = worker.isPaid ? 'rgba(34,197,94,.10)' : 'rgba(251,191,36,.10)';

          const htmlSlip = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pay Slip - ${worker.workerName}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#333;padding:20px}.payslip{max-width:600px;margin:0 auto;border:2px solid #c8a96b}.header{background:#c8a96b;color:white;padding:20px;text-align:center}.header h1{font-size:24px;margin-bottom:5px}.header p{font-size:14px;opacity:.9}.company-info{background:#f9f9f9;padding:15px 20px;border-bottom:1px solid #ddd}.company-info p{margin:2px 0;font-size:11px;color:#666}table{width:100%;border-collapse:collapse}th,td{padding:10px 15px;text-align:left;border-bottom:1px solid #eee}th{background:#f5f5f5;font-weight:bold;font-size:10px;text-transform:uppercase;color:#666}.number{text-align:right}.label-col{width:70%}.value-col{width:30%}.summary{background:${statusBg};padding:20px;text-align:center}.summary .amount{font-size:24px;font-weight:bold;color:#c8a96b}.summary .status{font-size:14px;font-weight:bold;color:${statusColor}}.footer{background:#f9f9f9;padding:15px 20px;font-size:10px;color:#999;text-align:center;border-top:1px solid #ddd}.status-badge{display:inline-block;padding:4px 12px;border-radius:12px;font-weight:bold;font-size:11px;background:${statusBg};color:${statusColor}}</style>
</head><body><div class="payslip"><div class="header"><h1>${companyName}</h1><p>PAYSLIP</p></div>
<div class="company-info"><p><strong>Address:</strong> ${companyAddress||'Qatar'}</p><p><strong>Phone:</strong> ${companyPhone||'+974XXXXXXXX'}</p><p><strong>Email:</strong> ${companyEmail||'info@flowly.qa'}</p></div>
<table><thead><tr><th colspan="2">Employee Information</th></tr></thead><tbody>
<tr><td class="label-col"><strong>Employee Name</strong></td><td class="value-col">${worker.workerName}</td></tr>
<tr><td class="label-col"><strong>Role</strong></td><td class="value-col">Detailer</td></tr>
<tr><td class="label-col"><strong>Pay Period</strong></td><td class="value-col">${payPeriod}</td></tr>
<tr><td class="label-col"><strong>Payment Status</strong></td><td class="value-col"><span class="status-badge">${status}</span></td></tr>
</tbody></table>
<table><thead><tr><th colspan="2">Salary Breakdown</th></tr></thead><tbody>
<tr><td class="label-col">Monthly Salary</td><td class="value-col number">QAR ${(worker.monthlySalary||0).toLocaleString()}</td></tr>
<tr><td class="label-col">Jobs Completed</td><td class="value-col number">${worker.jobsCompleted||0}</td></tr>
<tr><td class="label-col">Revenue Generated</td><td class="value-col number">QAR ${(worker.totalRevenue||0).toLocaleString()}</td></tr>
</tbody></table>
<div class="summary"><div class="amount">QAR ${(worker.monthlySalary||0).toLocaleString()}</div><div class="status">${status}</div>${worker.isPaid&&worker.paidAt?`<div style="font-size:10px;color:#666;margin-top:5px;">Paid on: ${new Date(worker.paidAt).toLocaleDateString()}</div>`:''}</div>
<div class="footer"><p>${footerText||'This is a system-generated payslip and does not require signature.'}</p><p style="margin-top:5px;">Generated: ${new Date().toLocaleString()}</p></div>
</div></body></html>`.trim();

          const printPdf = () => {
            const w = window.open('','_blank');
            if (w) { w.document.write(htmlSlip); w.document.close(); w.print(); }
          };
          const downloadTxt = () => {
            const txt = `========================================\n              PAYSLIP\n========================================\nCompany: ${companyName}\n${companyAddress?'Address: '+companyAddress+'\n':''}${companyPhone?'Phone: '+companyPhone+'\n':''}${companyEmail?'Email: '+companyEmail+'\n':''}========================================\n\nEMPLOYEE INFORMATION\n----------------------------------------\nEmployee Name    : ${worker.workerName}\nRole             : Detailer\nPay Period       : ${payPeriod}\nPayment Status   : ${status}\n${worker.isPaid&&worker.paidAt?'Paid On          : '+new Date(worker.paidAt).toLocaleDateString()+'\n':''}\nSALARY BREAKDOWN\n----------------------------------------\nMonthly Salary   : QAR ${(worker.monthlySalary||0).toLocaleString()}\nJobs Completed   : ${worker.jobsCompleted||0}\nRevenue Gen.     : QAR ${(worker.totalRevenue||0).toLocaleString()}\n\n----------------------------------------\nNET SALARY       : QAR ${(worker.monthlySalary||0).toLocaleString()}\nSTATUS           : ${status}\n========================================\n\n${footerText||'This is a system-generated payslip and does not require signature.'}\nGenerated: ${new Date().toLocaleString()}\n========================================`.trim();
            const blob = new Blob([txt], { type:'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `PaySlip_${worker.workerName?.replace(/\s+/g,'_')}_${payrollMonth}_${payrollYear}.txt`;
            a.click(); URL.revokeObjectURL(url);
          };

          return (
            <div className="text-sm space-y-4">
              <div className="rounded-lg border overflow-hidden" style={{ borderColor:'rgba(200,169,107,.3)' }}>
                <div className="px-4 py-3 text-center" style={{ background:'#c8a96b' }}>
                  <p className="font-black text-lg text-white">{companyName}</p>
                  <p className="text-xs text-white/90">PAYSLIP</p>
                </div>
                <div className="px-4 py-2 text-xs" style={{ background:'rgba(200,169,107,.08)', borderBottom:'1px solid rgba(200,169,107,.2)' }}>
                  <p className="text-[var(--muted-color)]">{companyAddress||'Qatar'} Â· {companyPhone||'+974XXXXXXXX'} Â· {companyEmail||'info@flowly.qa'}</p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background:'rgba(200,169,107,.05)' }}>
                      <th colSpan={2} className="px-4 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--muted-color)]">Employee Information</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    <tr><td className="px-4 py-2 text-[var(--muted-color)]">Employee Name</td><td className="px-4 py-2 font-medium text-right">{worker.workerName}</td></tr>
                    <tr><td className="px-4 py-2 text-[var(--muted-color)]">Role</td><td className="px-4 py-2 font-medium text-right">Detailer</td></tr>
                    <tr><td className="px-4 py-2 text-[var(--muted-color)]">Pay Period</td><td className="px-4 py-2 font-medium text-right">{MONTHS_SHORT[payrollMonth-1]} {payrollYear}</td></tr>
                    <tr><td className="px-4 py-2 text-[var(--muted-color)]">Payment Status</td>
                      <td className="px-4 py-2 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:statusBg, color:statusColor }}>{status}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background:'rgba(200,169,107,.05)' }}>
                      <th colSpan={2} className="px-4 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-[var(--muted-color)]">Salary Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    <tr><td className="px-4 py-2 text-[var(--muted-color)]">Monthly Salary</td><td className="px-4 py-2 font-black text-primary text-right">QAR {(worker.monthlySalary||0).toLocaleString()}</td></tr>
                    <tr><td className="px-4 py-2 text-[var(--muted-color)]">Jobs Completed</td><td className="px-4 py-2 font-medium text-right">{worker.jobsCompleted||0}</td></tr>
                    <tr><td className="px-4 py-2 text-[var(--muted-color)]">Revenue Generated</td><td className="px-4 py-2 font-bold text-green-500 text-right">QAR {(worker.totalRevenue||0).toLocaleString()}</td></tr>
                  </tbody>
                </table>
                <div className="px-4 py-4 text-center" style={{ background:statusBg }}>
                  <p className="font-black text-2xl text-primary">QAR {(worker.monthlySalary||0).toLocaleString()}</p>
                  <p className="text-sm font-bold" style={{ color:statusColor }}>{status}</p>
                  {worker.isPaid && worker.paidAt && <p className="text-xs text-[var(--muted-color)] mt-1">Paid on: {new Date(worker.paidAt).toLocaleDateString()}</p>}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={printPdf} className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition flex items-center justify-center gap-2">
                  <FileText size={14} /> Print / PDF
                </button>
                <button onClick={downloadTxt} className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition flex items-center justify-center gap-2">
                  <Download size={14} /> Download TXT
                </button>
              </div>

              {!worker.isPaid && worker.monthlySalary != null && (
                <button onClick={async () => {
                  await handleMarkPaid(worker);
                  closeDetailsModal();
                }} className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition flex items-center justify-center gap-2">
                  <Wallet size={14} /> Pay Now
                </button>
              )}
              <button onClick={closeDetailsModal} className="w-full py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-[var(--text-color)] hover:bg-white/5 transition">
                Close
              </button>
            </div>
          );
        })()}
      </AppModal>
    </>
  );
}
