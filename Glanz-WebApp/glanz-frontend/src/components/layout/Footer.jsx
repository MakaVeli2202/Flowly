import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getBusiness, saveBusiness } from '../../config/business';
import { settingsAPI } from '../../api/settings';
import { packagesAPI } from '../../api/packages';

const socialIcons = {
  facebook: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  twitter: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
    </svg>
  ),
  instagram: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  ),
  linkedin: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  youtube: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
};

function Footer() {
  const { isAuthenticated, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const [business, setBusiness] = useState(getBusiness());
  const [footerServices, setFooterServices] = useState([]);

  const labelsByLang = {
    en: {
      quickLinks: 'Quick Links',
      home: 'Home',
      packages: 'Packages',
      plans: 'Plans',
      createBooking: 'Create Booking',
      bookNow: 'Book Now',
      myBookings: 'My Bookings',
      editBookings: 'Edit Bookings',
      openPositions: 'Open Positions',
      services: 'Services',
      contact: 'Contact',
      allRightsReserved: 'All rights reserved.',
    },
    ar: {
      quickLinks: 'روابط سريعة',
      home: 'الرئيسية',
      packages: 'الباقات',
      plans: 'الخطط',
      createBooking: 'إنشاء حجز',
      bookNow: 'احجز الآن',
      myBookings: 'حجوزاتي',
      editBookings: 'تعديل الحجوزات',
      openPositions: 'الوظائف المتاحة',
      services: 'الخدمات',
      contact: 'تواصل معنا',
      allRightsReserved: 'جميع الحقوق محفوظة.',
    },
    de: {
      quickLinks: 'Schnelllinks',
      home: 'Startseite',
      packages: 'Pakete',
      plans: 'Plaene',
      createBooking: 'Buchung erstellen',
      bookNow: 'Jetzt buchen',
      myBookings: 'Meine Buchungen',
      editBookings: 'Buchungen bearbeiten',
      openPositions: 'Offene Stellen',
      services: 'Services',
      contact: 'Kontakt',
      allRightsReserved: 'Alle Rechte vorbehalten.',
    },
  };

  const normalizedLang = (lang || 'en').toLowerCase().split('-')[0];
  const ui = labelsByLang[normalizedLang] || labelsByLang.en;
  const bookingLinkLabel = isAdmin ? ui.createBooking : ui.bookNow;

  useEffect(() => {
    settingsAPI.getSystemSettings()
      .then(data => {
        if (data?.businessConfig) {
          const merged = saveBusiness(data.businessConfig);
          setBusiness(merged);
        }
      })
      .catch(() => {});

    const handleConfigChange = () => setBusiness(getBusiness());
    window.addEventListener('businessConfigChanged', handleConfigChange);
    return () => window.removeEventListener('businessConfigChanged', handleConfigChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    packagesAPI.getAll(lang)
      .then((data) => {
        if (cancelled) return;
        const uniqueNames = Array.from(
          new Set(
            (Array.isArray(data) ? data : [])
              .flatMap((pkg) => pkg?.services || [])
              .map((svc) => svc?.serviceName || svc?.name)
              .filter(Boolean)
          )
        );
        setFooterServices(uniqueNames.slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setFooterServices([]);
      });

    return () => {
      cancelled = true;
    };
  }, [lang]);

  return (
    <footer className="border-t py-12 backdrop-blur-xl themed-nav">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          
          <div>
            <div className="mb-4">
              <img src="/Glanz-Logo.png" alt={business.name} className="h-12 w-auto object-contain" />
            </div>
            <p className="text-[var(--muted-color)]">
              {business.tagline}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">{ui.quickLinks}</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-[var(--muted-color)] hover:text-primary transition">{ui.home}</Link></li>
              <li><Link to="/packages" className="text-[var(--muted-color)] hover:text-primary transition">{ui.packages}</Link></li>
              <li><Link to="/plans" className="text-[var(--muted-color)] hover:text-primary transition">{ui.plans}</Link></li>
              <li><Link to="/booking" className="text-[var(--muted-color)] hover:text-primary transition">{bookingLinkLabel}</Link></li>
              {isAuthenticated && !isAdmin && (
                <>
                  <li><Link to="/my-bookings" className="text-[var(--muted-color)] hover:text-primary transition">{ui.myBookings}</Link></li>
                  <li><Link to="/referrals" className="text-[var(--muted-color)] hover:text-primary transition">{ui.referrals || 'Referrals'}</Link></li>
                </>
              )}
              {isAuthenticated && isAdmin && (
                <li><Link to="/admin/bookings" className="text-[var(--muted-color)] hover:text-primary transition">{ui.editBookings}</Link></li>
              )}
              {!isAdmin && (
                <li>
                  <Link to="/careers" className="text-[var(--muted-color)] hover:text-primary transition flex items-center gap-1.5">
                    <Briefcase size={14} />
                    {ui.openPositions}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">{ui.services}</h3>
            <ul className="space-y-2 text-[var(--muted-color)]">
              {(footerServices.length > 0 ? footerServices : ['-','-','-','-']).map((service, idx) => (
                <li key={`${service}-${idx}`}>{service}</li>
              ))}
            </ul>
          </div>

             <div>
             <h3 className="text-lg font-semibold mb-4">{ui.contact}</h3>
             <ul className="space-y-2">
               <li className="flex items-center gap-2 text-[var(--muted-color)]">
                 <Phone size={16} />
                 {business.phone}
               </li>
               <li className="flex items-center gap-2 text-[var(--muted-color)]">
                 <Mail size={16} />
                 {business.email}
               </li>
               <li className="flex items-center gap-2 text-[var(--muted-color)]">
                 <MapPin size={16} />
                 {business.location}
               </li>
             </ul>
             {business.socialLinks && Object.entries(business.socialLinks).some(([_, url]) => url) && (
                <div className="flex gap-3 mt-4">
                  {Object.entries(business.socialLinks).map(([platform, url]) => {
                    if (!url) return null;
                    const icon = socialIcons[platform.toLowerCase()];
                    return (
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-full border border-[var(--border-color)] flex items-center justify-center text-[var(--muted-color)] hover:text-primary hover:border-primary hover:bg-[var(--card-bg)] transition-colors"
                        aria-label={platform}
                      >
                        {icon || platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </a>
                    );
                  })}
                </div>
              )}
           </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-[var(--muted-color)]" style={{ borderColor: 'var(--border-color)' }}>
          <p>&copy; {new Date().getFullYear()} {business.name}. {ui.allRightsReserved}</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
