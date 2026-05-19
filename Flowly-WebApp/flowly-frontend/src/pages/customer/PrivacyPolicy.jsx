import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const UI_BY_LANG = {
  en: {
    policy: 'Privacy Policy',
    commitment: 'Our Privacy Commitment',
    intro: 'At Flowly, we respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our services, or interact with us.',
    collectTitle: 'Information We Collect',
    collectBody: 'We may collect personal information such as your name, email address, phone number, address, payment information, and vehicle details when you book our services, create an account, or contact us.',
    useTitle: 'How We Use Your Information',
    useBody: 'We use your information to provide and improve our services, process payments, communicate with you about bookings, send promotional offers (with your consent), and comply with legal obligations.',
    shareTitle: 'Sharing Your Information',
    shareBody: 'We do not sell your personal information. We may share data with trusted third-party service providers (payment processors, mapping services) solely to operate our platform, and as required by law.',
    securityTitle: 'Data Security',
    securityBody: 'We implement reasonable security measures to protect your data from unauthorized access, alteration, disclosure, or destruction.',
    rightsTitle: 'Your Rights',
    rightsBody: 'You have the right to access, correct, or delete your personal data, and to opt-out of marketing communications. Contact us at privacy@flowly.qa to exercise these rights.',
    changesTitle: 'Changes to This Policy',
    changesBody: 'We may update this privacy policy from time to time. The updated version will be posted on this page with an effective date.',
    goHome: 'Go Home',
  },
  ar: {
    policy: 'سياسة الخصوصية',
    commitment: 'التزامنا بالخصوصية',
    intro: 'في Flowly نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه السياسة كيف نجمع معلوماتك ونستخدمها ونفصح عنها ونحميها عند زيارة موقعنا أو استخدام خدماتنا أو التواصل معنا.',
    collectTitle: 'المعلومات التي نجمعها',
    collectBody: 'قد نجمع معلومات شخصية مثل الاسم والبريد الإلكتروني ورقم الهاتف والعنوان ومعلومات الدفع وتفاصيل السيارة عند حجز الخدمات أو إنشاء حساب أو التواصل معنا.',
    useTitle: 'كيف نستخدم معلوماتك',
    useBody: 'نستخدم معلوماتك لتقديم خدماتنا وتحسينها ومعالجة المدفوعات والتواصل معك بشأن الحجوزات وإرسال العروض الترويجية بموافقتك والامتثال للالتزامات القانونية.',
    shareTitle: 'مشاركة معلوماتك',
    shareBody: 'نحن لا نبيع معلوماتك الشخصية. قد نشارك البيانات مع مزودي خدمات موثوقين من جهات خارجية فقط لتشغيل منصتنا، أو حسبما يقتضيه القانون.',
    securityTitle: 'أمن البيانات',
    securityBody: 'نطبق إجراءات أمنية معقولة لحماية بياناتك من الوصول غير المصرح به أو التعديل أو الإفصاح أو الإتلاف.',
    rightsTitle: 'حقوقك',
    rightsBody: 'لك الحق في الوصول إلى بياناتك الشخصية أو تصحيحها أو حذفها، وإلغاء الاشتراك في الرسائل التسويقية. تواصل معنا عبر privacy@flowly.qa لممارسة هذه الحقوق.',
    changesTitle: 'التغييرات على هذه السياسة',
    changesBody: 'قد نقوم بتحديث هذه السياسة من وقت لآخر، وسيتم نشر النسخة المحدثة في هذه الصفحة مع تاريخ السريان.',
    goHome: 'العودة للرئيسية',
  },
  de: {
    policy: 'Datenschutzerklarung',
    commitment: 'Unser Datenschutzversprechen',
    intro: 'Bei Flowly respektieren wir Ihre Privatsphare und schutzen Ihre personenbezogenen Daten. Diese Datenschutzerklarung beschreibt, wie wir Informationen erheben, verwenden, weitergeben und schutzen, wenn Sie unsere Website besuchen oder unsere Dienste nutzen.',
    collectTitle: 'Welche Daten wir erfassen',
    collectBody: 'Wir konnen personenbezogene Daten wie Name, E-Mail-Adresse, Telefonnummer, Adresse, Zahlungsinformationen und Fahrzeugdetails erfassen, wenn Sie unsere Dienste buchen, ein Konto erstellen oder uns kontaktieren.',
    useTitle: 'Wie wir Ihre Daten nutzen',
    useBody: 'Wir verwenden Ihre Daten, um unsere Dienste bereitzustellen und zu verbessern, Zahlungen zu verarbeiten, mit Ihnen uber Buchungen zu kommunizieren, Werbeangebote mit Ihrer Zustimmung zu senden und gesetzliche Pflichten zu erfullen.',
    shareTitle: 'Weitergabe Ihrer Daten',
    shareBody: 'Wir verkaufen Ihre personenbezogenen Daten nicht. Wir konnen Daten nur mit vertrauenswurdigen Drittanbietern teilen, um unsere Plattform zu betreiben, oder wenn dies gesetzlich erforderlich ist.',
    securityTitle: 'Datensicherheit',
    securityBody: 'Wir setzen angemessene SicherheitsmaBnahmen ein, um Ihre Daten vor unbefugtem Zugriff, Anderung, Offenlegung oder Zerstorung zu schutzen.',
    rightsTitle: 'Ihre Rechte',
    rightsBody: 'Sie haben das Recht auf Auskunft, Berichtigung oder Loschung Ihrer personenbezogenen Daten sowie auf Widerspruch gegen Marketingkommunikation. Kontakt: privacy@flowly.qa.',
    changesTitle: 'Anderungen an dieser Richtlinie',
    changesBody: 'Wir konnen diese Datenschutzerklarung gelegentlich aktualisieren. Die aktualisierte Version wird auf dieser Seite mit einem Gultigkeitsdatum veroffentlicht.',
    goHome: 'Zur Startseite',
  },
};

const PrivacyPolicy = () => {
  const { lang } = useLanguage();
  const ui = UI_BY_LANG[lang] || UI_BY_LANG.en;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute top-10 left-1/4 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'rgba(200,169,107,0.07)', filter: 'blur(80px)' }} />
      <div className="absolute bottom-10 right-1/4 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'rgba(14,165,160,0.06)', filter: 'blur(70px)' }} />
      <div className="relative z-10 glass-card prism-glass p-12 md:p-16 max-w-md w-full mx-auto overflow-hidden">
        <div className="absolute top-0 left-[10%] right-[10%] h-[1.5px]"
          style={{ background: 'linear-gradient(90deg,transparent,#c8a96b 40%,#0ea5a0 60%,transparent)' }} />
        <div className="prism-ray" style={{ left: '20%', width: '25%', animation: 'prism-ray-sweep 14s ease-in-out 2s infinite' }} />
        <p className="premium-heading font-black text-primary mb-2 leading-none" style={{ fontSize: '4rem' }}>{ui.policy}</p>
        <div className="spectrum-line mb-6" />
        <h1 className="premium-heading text-2xl font-bold text-[var(--heading-color)] mb-3">{ui.commitment}</h1>
        <p className="text-[var(--muted-color)] mb-6 text-sm leading-relaxed">
          {ui.intro}
        </p>
        
        <div className="space-y-4 text-left w-full">
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">{ui.collectTitle}</h2>
          <p className="text-[var(--muted-color)] mb-2">{ui.collectBody}</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">{ui.useTitle}</h2>
          <p className="text-[var(--muted-color)] mb-2">{ui.useBody}</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">{ui.shareTitle}</h2>
          <p className="text-[var(--muted-color)] mb-2">{ui.shareBody}</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">{ui.securityTitle}</h2>
          <p className="text-[var(--muted-color)] mb-2">{ui.securityBody}</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">{ui.rightsTitle}</h2>
          <p className="text-[var(--muted-color)] mb-2">{ui.rightsBody}</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">{ui.changesTitle}</h2>
          <p className="text-[var(--muted-color)] mb-2">{ui.changesBody}</p>
        </div>
        
        <Link to="/" className="btn-chrome inline-flex mt-8">
          {ui.goHome} <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
};

export default PrivacyPolicy;