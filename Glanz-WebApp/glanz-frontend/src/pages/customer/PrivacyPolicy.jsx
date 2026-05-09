import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const PrivacyPolicy = () => {
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
        <p className="premium-heading font-black text-primary mb-2 leading-none" style={{ fontSize: '4rem' }}>Privacy Policy</p>
        <div className="spectrum-line mb-6" />
        <h1 className="premium-heading text-2xl font-bold text-[var(--heading-color)] mb-3">Our Privacy Commitment</h1>
        <p className="text-[var(--muted-color)] mb-6 text-sm leading-relaxed">
          At Glanz, we respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our services, or interact with us.
        </p>
        
        <div className="space-y-4 text-left w-full">
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">Information We Collect</h2>
          <p className="text-[var(--muted-color)] mb-2">We may collect personal information such as your name, email address, phone number, address, payment information, and vehicle details when you book our services, create an account, or contact us.</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">How We Use Your Information</h2>
          <p className="text-[var(--muted-color)] mb-2">We use your information to provide and improve our services, process payments, communicate with you about bookings, send promotional offers (with your consent), and comply with legal obligations.</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">Sharing Your Information</h2>
          <p className="text-[var(--muted-color)] mb-2">We do not sell your personal information. We may share data with trusted third-party service providers (payment processors, mapping services) solely to operate our platform, and as required by law.</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">Data Security</h2>
          <p className="text-[var(--muted-color)] mb-2">We implement reasonable security measures to protect your data from unauthorized access, alteration, disclosure, or destruction.</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">Your Rights</h2>
          <p className="text-[var(--muted-color)] mb-2">You have the right to access, correct, or delete your personal data, and to opt-out of marketing communications. Contact us at privacy@glanz.com to exercise these rights.</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">Cookies & Tracking</h2>
          <p className="text-[var(--muted-color)] mb-2">Our website uses cookies to enhance user experience, analyze traffic, and remember preferences. You can manage cookie preferences through your browser settings.</p>
          
          <h2 className="text-lg font-semibold text-[var(--heading-color)] mb-2">Changes to This Policy</h2>
          <p className="text-[var(--muted-color)] mb-2">We may update this privacy policy from time to time. The updated version will be posted on this page with an effective date.</p>
        </div>
        
        <Link to="/" className="premium-btn inline-flex mt-8">
          Go Home <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
};

export default PrivacyPolicy;