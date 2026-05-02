import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getBusiness, saveBusiness } from '../../config/business';
import { settingsAPI } from '../../api/settings';
import { packagesAPI } from '../../api/packages';

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
                <li><Link to="/my-bookings" className="text-[var(--muted-color)] hover:text-primary transition">{ui.myBookings}</Link></li>
              )}
              {isAuthenticated && isAdmin && (
                <li><Link to="/admin/bookings" className="text-[var(--muted-color)] hover:text-primary transition">{ui.editBookings}</Link></li>
              )}
              <li>
                <Link to="/careers" className="text-[var(--muted-color)] hover:text-primary transition flex items-center gap-1.5">
                  <Briefcase size={14} />
                  {ui.openPositions}
                </Link>
              </li>
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
