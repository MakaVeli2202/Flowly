// Careers.jsx — Public job openings page
import React, { useEffect, useState } from 'react';
import { Briefcase, ChevronDown, ChevronUp, MapPin, Clock, Mail } from 'lucide-react';
import { BUSINESS } from '../../config/business';
import { useLanguage } from '../../context/LanguageContext';

const STORAGE_KEY = 'adminJobPositions';

const UI_BY_LANG = {
  en: {
    joinTeam: 'Join the Team',
    openPositions: 'Open Positions',
    intro: (name, location) => `Join ${name} and be part of a passionate team delivering premium car care across ${location}.`,
    noOpenNow: 'No open positions right now',
    noOpenDesc: "We're not actively hiring at the moment, but feel free to send us your CV anyway.",
    speculativeSubject: 'Speculative Application',
    sendSpeculative: 'Send Speculative Application',
    applyNow: 'Apply Now',
    questions: 'Questions? Email us at',
  },
  ar: {
    joinTeam: 'انضم إلى الفريق',
    openPositions: 'الوظائف المتاحة',
    intro: (name, location) => `انضم إلى ${name} وكن جزءا من فريق شغوف يقدم عناية متميزة بالسيارات في ${location}.`,
    noOpenNow: 'لا توجد وظائف متاحة حاليا',
    noOpenDesc: 'لا نقوم بالتوظيف حاليا، ولكن يمكنك إرسال سيرتك الذاتية وسنحتفظ بها.',
    speculativeSubject: 'طلب توظيف استباقي',
    sendSpeculative: 'إرسال طلب توظيف استباقي',
    applyNow: 'قدّم الآن',
    questions: 'للاستفسارات؟ راسلنا على',
  },
  de: {
    joinTeam: 'Werde Teil des Teams',
    openPositions: 'Offene Stellen',
    intro: (name, location) => `Werde Teil von ${name} und arbeite in einem engagierten Team für Premium-Autopflege in ${location}.`,
    noOpenNow: 'Derzeit keine offenen Stellen',
    noOpenDesc: 'Momentan stellen wir nicht aktiv ein, aber sende uns gerne trotzdem deinen Lebenslauf.',
    speculativeSubject: 'Initiativbewerbung',
    sendSpeculative: 'Initiativbewerbung senden',
    applyNow: 'Jetzt bewerben',
    questions: 'Fragen? Schreib uns an',
  },
};

function loadPositions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function Careers() {
  const { lang } = useLanguage();
  const ui = UI_BY_LANG[lang] || UI_BY_LANG.en;
  const [positions, setPositions] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setPositions(loadPositions());

    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY || e.type === 'jobPositionsChanged') {
        setPositions(loadPositions());
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('jobPositionsChanged', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('jobPositionsChanged', handleStorage);
    };
  }, []);

  const open = positions.filter(p => p.isOpen !== false);

  return (
    <div className="min-h-screen py-16 relative"
      style={{ background: 'radial-gradient(circle at 8% 6%, rgba(200,169,107,0.05) 0%, transparent 38%), radial-gradient(circle at 92% 94%, rgba(14,165,160,0.04) 0%, transparent 32%)' }}>
      <div className="container mx-auto px-4 max-w-3xl">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="h-px w-8" style={{ background: 'linear-gradient(90deg,transparent,#c8a96b)' }} />
            <p className="text-[.60rem] font-bold uppercase tracking-[.26em] text-primary">{ui.joinTeam}</p>
            <span className="h-px w-8" style={{ background: 'linear-gradient(90deg,#c8a96b,transparent)' }} />
          </div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(200,169,107,.12)', border: '1px solid rgba(200,169,107,.24)' }}>
              <Briefcase size={18} style={{ color: '#c8a96b' }} />
            </div>
            <h1 className="premium-heading text-4xl md:text-5xl font-bold text-[var(--heading-color)]">{ui.openPositions}</h1>
          </div>
          <p className="text-[var(--muted-color)] max-w-xl mx-auto">
            {ui.intro(BUSINESS.name, BUSINESS.location)}
          </p>
        </div>

        {open.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Briefcase size={48} className="mx-auto mb-4 text-[var(--muted-color)] opacity-40" />
            <p className="text-[var(--heading-color)] font-semibold mb-2">{ui.noOpenNow}</p>
            <p className="text-[var(--muted-color)] text-sm mb-6">
              {ui.noOpenDesc}
            </p>
            <a
              href={`mailto:${BUSINESS.email}?subject=${encodeURIComponent(ui.speculativeSubject)}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: 'rgba(200,169,107,.12)', color: '#c8a96b', border: '1px solid rgba(200,169,107,.3)' }}
            >
              <Mail size={14} />
              {ui.sendSpeculative}
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {open.map((pos, idx) => (
              <div key={pos.id || idx} className="glass-card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: 'linear-gradient(90deg,transparent,#c8a96b 38%,#0ea5a0 62%,transparent)' }} />

                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpanded(expanded === idx ? null : idx)}
                >
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-[var(--heading-color)] text-lg mb-1">{pos.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-color)]">
                        {pos.location && (
                          <span className="flex items-center gap-1"><MapPin size={11} />{pos.location}</span>
                        )}
                        {pos.type && (
                          <span className="flex items-center gap-1"><Clock size={11} />{pos.type}</span>
                        )}
                        {pos.department && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: 'rgba(200,169,107,.10)', color: '#c8a96b' }}>
                            {pos.department}
                          </span>
                        )}
                      </div>
                    </div>
                    {expanded === idx ? <ChevronUp size={18} className="text-[var(--muted-color)] flex-shrink-0 mt-1" /> : <ChevronDown size={18} className="text-[var(--muted-color)] flex-shrink-0 mt-1" />}
                  </div>
                </button>

                {expanded === idx && (
                  <div className="px-5 pb-5 border-t border-[var(--border-color)]/30 pt-4">
                    {pos.description && (
                      <div className="prose-sm text-[var(--text-color)] whitespace-pre-wrap mb-5 leading-relaxed text-sm">
                        {pos.description}
                      </div>
                    )}
                    <a
                      href={`mailto:${BUSINESS.email}?subject=Application for ${encodeURIComponent(pos.title)}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#c8a96b,#0ea5a0)', color: '#fff' }}
                    >
                      <Mail size={14} />
                      {ui.applyNow}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <p className="text-[var(--muted-color)] text-sm">
            {ui.questions}{' '}
            <a href={`mailto:${BUSINESS.email}`} className="text-primary hover:underline">{BUSINESS.email}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
