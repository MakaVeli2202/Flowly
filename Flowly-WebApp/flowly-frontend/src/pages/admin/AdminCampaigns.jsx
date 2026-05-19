import React, { useState } from 'react';
import { crmAPI } from '../../api/crm';
import { Megaphone, Send, Loader, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { aiAPI } from '../../api/ai';

const CHANNELS = ['push', 'sms', 'both'];
const SEGMENTS = ['All', 'VIP', 'At-Risk', 'Active', 'Inactive'];

const UI = {
  en: {
    title: 'Campaigns',
    subtitle: 'Send bulk messages to customer segments via push, SMS, or both.',
    segment: 'Target Segment',
    channel: 'Channel',
    message: 'Message',
    messagePlaceholder: 'Write your campaign message...',
    charCount: 'characters',
    send: 'Send Campaign',
    sending: 'Sending...',
    sent: 'Campaign sent',
    sentDesc: (n) => `${n} message(s) dispatched.`,
    aiGenerate: 'Generate with AI',
    aiGenerating: 'Generating...',
    aiObjective: 'Campaign objective',
    aiObjectivePlaceholder: 'e.g. Promote summer offer to VIP customers',
    lang: 'Language',
    preview: 'Preview',
    error: 'Failed to send campaign.',
    aiError: 'AI generation failed.',
    channelPush: 'Push Notification',
    channelSms: 'SMS',
    channelBoth: 'Push + SMS',
    segAll: 'All customers',
    segVip: 'VIP',
    segAtRisk: 'At-Risk',
    segActive: 'Active',
    segInactive: 'Inactive',
    noteTitle: 'Note',
    note: 'SMS requires Infobip:ApiKey to be configured. Push requires Expo push tokens on customer devices.',
  },
  de: {
    title: 'Kampagnen',
    subtitle: 'Massennachrichten an Kundensegmente per Push, SMS oder beides senden.',
    segment: 'Zielgruppe',
    channel: 'Kanal',
    message: 'Nachricht',
    messagePlaceholder: 'Kampagnennachricht schreiben...',
    charCount: 'Zeichen',
    send: 'Kampagne senden',
    sending: 'Wird gesendet...',
    sent: 'Kampagne gesendet',
    sentDesc: (n) => `${n} Nachricht(en) verschickt.`,
    aiGenerate: 'Mit KI generieren',
    aiGenerating: 'Generierung...',
    aiObjective: 'Kampagnenziel',
    aiObjectivePlaceholder: 'z.B. Sommerangebot für VIP-Kunden bewerben',
    lang: 'Sprache',
    preview: 'Vorschau',
    error: 'Kampagne konnte nicht gesendet werden.',
    aiError: 'KI-Generierung fehlgeschlagen.',
    channelPush: 'Push-Benachrichtigung',
    channelSms: 'SMS',
    channelBoth: 'Push + SMS',
    segAll: 'Alle Kunden',
    segVip: 'VIP',
    segAtRisk: 'Gefährdet',
    segActive: 'Aktiv',
    segInactive: 'Inaktiv',
    noteTitle: 'Hinweis',
    note: 'SMS erfordert Infobip:ApiKey. Push erfordert Expo-Push-Token auf Kundengeräten.',
  },
  ar: {
    title: 'الحملات التسويقية',
    subtitle: 'إرسال رسائل جماعية لشرائح العملاء عبر الإشعارات أو SMS أو كليهما.',
    segment: 'الشريحة المستهدفة',
    channel: 'القناة',
    message: 'الرسالة',
    messagePlaceholder: 'اكتب رسالة الحملة...',
    charCount: 'حرف',
    send: 'إرسال الحملة',
    sending: 'جارٍ الإرسال...',
    sent: 'تم إرسال الحملة',
    sentDesc: (n) => `تم إرسال ${n} رسالة.`,
    aiGenerate: 'توليد بالذكاء الاصطناعي',
    aiGenerating: 'جارٍ التوليد...',
    aiObjective: 'هدف الحملة',
    aiObjectivePlaceholder: 'مثال: الترويج لعرض الصيف لعملاء VIP',
    lang: 'اللغة',
    preview: 'معاينة',
    error: 'فشل إرسال الحملة.',
    aiError: 'فشل توليد الذكاء الاصطناعي.',
    channelPush: 'إشعار فوري',
    channelSms: 'رسالة SMS',
    channelBoth: 'إشعار + SMS',
    segAll: 'جميع العملاء',
    segVip: 'VIP',
    segAtRisk: 'معرّضون للخسارة',
    segActive: 'نشطون',
    segInactive: 'غير نشطين',
    noteTitle: 'ملاحظة',
    note: 'تتطلب رسائل SMS ضبط Infobip:ApiKey. تتطلب الإشعارات رمز Expo على أجهزة العملاء.',
  },
};

const channelLabel = (ui, ch) => ({ push: ui.channelPush, sms: ui.channelSms, both: ui.channelBoth }[ch] || ch);
const segmentLabel = (ui, s) => ({ All: ui.segAll, VIP: ui.segVip, 'At-Risk': ui.segAtRisk, Active: ui.segActive, Inactive: ui.segInactive }[s] || s);

export default function AdminCampaigns() {
  const lang = localStorage.getItem('lang') || 'en';
  const ui = UI[lang] || UI.en;

  const [segment, setSegment] = useState('All');
  const [channel, setChannel] = useState('push');
  const [message, setMessage] = useState('');

  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState(null);
  const [sendError, setSendError] = useState('');

  // AI generation
  const [aiObjective, setAiObjective] = useState('');
  const [aiLang, setAiLang] = useState(lang === 'ar' || lang === 'de' ? lang : 'en');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const generateWithAI = async () => {
    if (!aiObjective.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const data = await aiAPI.generateMarketing(aiObjective.trim(), aiLang);
      setMessage(data.reply || '');
    } catch {
      setAiError(ui.aiError);
    } finally {
      setAiLoading(false);
    }
  };

  const sendCampaign = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSendError('');
    setSentResult(null);
    try {
      const seg = segment === 'All' ? undefined : segment;
      const r = await crmAPI.bulkMessage([], message.trim(), channel, seg);
      setSentResult(r?.sent ?? r);
    } catch (e) {
      setSendError(e?.response?.data?.message || ui.error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--surface-bg)' }}>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-[var(--heading-color)] flex items-center gap-2">
            <Megaphone size={28} className="text-primary" />
            {ui.title}
          </h1>
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

        {/* AI Copy Generator */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 space-y-3">
          <h2 className="text-sm font-bold text-[var(--heading-color)] flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">AI</span>
            {ui.aiGenerate}
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={ui.aiObjectivePlaceholder}
              value={aiObjective}
              onChange={e => setAiObjective(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm"
            />
            <select
              value={aiLang}
              onChange={e => setAiLang(e.target.value)}
              className="px-2 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm"
            >
              <option value="en">EN</option>
              <option value="ar">AR</option>
              <option value="de">DE</option>
            </select>
            <button
              onClick={generateWithAI}
              disabled={aiLoading || !aiObjective.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition disabled:opacity-50 border border-primary/20"
            >
              {aiLoading ? <Loader size={13} className="animate-spin" /> : <span className="text-[11px]">AI</span>}
              {aiLoading ? ui.aiGenerating : ui.aiGenerate}
            </button>
          </div>
          {aiError && <p className="text-red-400 text-xs">{aiError}</p>}
        </div>

        {/* Campaign Composer */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 space-y-4">

          {/* Segment + Channel */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted-color)] mb-1.5 uppercase tracking-wider">
                <Users size={11} className="inline mr-1" />{ui.segment}
              </label>
              <select
                value={segment}
                onChange={e => setSegment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm"
              >
                {SEGMENTS.map(s => (
                  <option key={s} value={s}>{segmentLabel(ui, s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted-color)] mb-1.5 uppercase tracking-wider">
                {ui.channel}
              </label>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm"
              >
                {CHANNELS.map(ch => (
                  <option key={ch} value={ch}>{channelLabel(ui, ch)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted-color)] mb-1.5 uppercase tracking-wider">
              {ui.message}
            </label>
            <textarea
              rows={5}
              placeholder={ui.messagePlaceholder}
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--surface-bg)] text-[var(--text-color)] text-sm resize-none"
            />
            <p className="text-right text-xs text-[var(--muted-color)] mt-0.5">{message.length}/500 {ui.charCount}</p>
          </div>

          {/* Send */}
          <button
            onClick={sendCampaign}
            disabled={sending || !message.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
          >
            {sending ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? ui.sending : ui.send}
          </button>

          {sendError && <p className="text-red-400 text-sm">{sendError}</p>}

          {sentResult !== null && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5 text-sm text-green-400">
              <CheckCircle size={16} />
              <div>
                <span className="font-bold">{ui.sent}</span>
                {' - '}
                {ui.sentDesc(typeof sentResult === 'number' ? sentResult : '?')}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
