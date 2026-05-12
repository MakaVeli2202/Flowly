import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getBusiness, saveBusiness } from '../../config/business';
import { settingsAPI } from '../../api/settings';
import { packagesAPI } from '../../api/packages';

const socialButtons = [
  { platform: 'google', url: null, icon: 'https://images.shadcnspace.com/assets/svgs/icon-google.svg' },
  { platform: 'facebook', url: null, icon: 'https://images.shadcnspace.com/assets/svgs/icon-facebook.svg' },
  { platform: 'linkedin', url: null, icon: 'https://images.shadcnspace.com/assets/svgs/icon-linkedin.svg' },
];

function Footer() {
  const { user, isAuthenticated, isAdmin } = useAuth();
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
      myReferrals: 'My Referrals',
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
      myReferrals: 'إحالاتي',
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
      myReferrals: 'Meine Empfehlungen',
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
              .map((svc) => {
                const localized =
                  (normalizedLang === 'ar' ? (svc?.serviceNameAr || svc?.nameAr) : null)
                  || (normalizedLang === 'de' ? (svc?.serviceNameDe || svc?.nameDe) : null)
                  || svc?.serviceName
                  || svc?.name;
                return localized;
              })
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
  }, [lang, normalizedLang]);

  return (
    <footer className="border-t py-12 backdrop-blur-xl themed-nav">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          
<div>
              <div className="mb-0">
                <img src={business.logo || '/GlanzLogo.png'} alt={business.name} className="h-56 w-auto object-contain" />
              </div>
              {business.tagline && (
                <p className="text-[var(--muted-color)]">
                  {business.tagline}
                </p>
              )}
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
                    <li className="relative">
                      <Link to="/referrals" className="text-[var(--muted-color)] hover:text-primary transition block">
                        {ui.myReferrals}
                        {/* Show indicator when referral code is unlocked - if has firstWashCompletedAt OR has any completed bookings */}
                        {(user?.firstWashCompletedAt || user?.totalBookingsCount > 0) && (
                          <span className="absolute -top-1 -right-0 h-2 w-2 bg-green-500 rounded-full" />
                        )}
                      </Link>
                    </li>
                  </>
                )}
                {isAuthenticated && isAdmin && (
                  <>
                    <li><Link to="/admin/bookings" className="text-[var(--muted-color)] hover:text-primary transition">{ui.editBookings}</Link></li>
                    <li className="relative">
                      <Link to="/referrals" className="text-[var(--muted-color)] hover:text-primary transition block">
                        {ui.myReferrals}
                        {/* Show admin their own referral status if applicable */}
                        {(user?.firstWashCompletedAt || user?.totalBookingsCount > 0) && (
                          <span className="absolute -top-1 -right-0 h-2 w-2 bg-green-500 rounded-full" />
                        )}
                      </Link>
                    </li>
                  </>
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
             <div className="flex items-center gap-2 flex-wrap mt-4">
                {socialButtons.map(({ platform, icon }) => {
                  const url = business.socialLinks?.[platform.toLowerCase()];
                  if (!url) return null;
                  return (
                    <a key={platform} href={url} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="outline"
                        type="button"
                        className="rounded-lg hover:scale-120 transition-all duration-300 cursor-pointer"
                      >
                        <img src={icon} alt={`${platform} icon`} className="h-4 w-4" />
                      </Button>
                    </a>
                  );
                })}
              </div>
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
