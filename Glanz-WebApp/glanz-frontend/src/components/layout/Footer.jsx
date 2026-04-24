import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BUSINESS } from '../../config/business';

function Footer() {
  const { isAuthenticated, isAdmin } = useAuth();
  const bookingLinkLabel = isAdmin ? 'Create Booking' : 'Book Now';

  return (
    <footer className="border-t py-12 backdrop-blur-xl themed-nav">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          
          <div>
            <div className="mb-4">
              <img src="/Glanz-Logo.png" alt={BUSINESS.name} className="h-12 w-auto object-contain" />
            </div>
            <p className="text-[var(--muted-color)]">
              {BUSINESS.tagline}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/" className="text-[var(--muted-color)] hover:text-primary transition">Home</Link></li>
              <li><Link to="/packages" className="text-[var(--muted-color)] hover:text-primary transition">Packages</Link></li>
              <li><Link to="/plans" className="text-[var(--muted-color)] hover:text-primary transition">Plans</Link></li>
              <li><Link to="/booking" className="text-[var(--muted-color)] hover:text-primary transition">{bookingLinkLabel}</Link></li>
              {isAuthenticated && !isAdmin && (
                <li><Link to="/my-bookings" className="text-[var(--muted-color)] hover:text-primary transition">My Bookings</Link></li>
              )}
              {isAuthenticated && isAdmin && (
                <li><Link to="/admin/bookings" className="text-[var(--muted-color)] hover:text-primary transition">Edit Bookings</Link></li>
              )}
              <li>
                <Link to="/careers" className="text-[var(--muted-color)] hover:text-primary transition flex items-center gap-1.5">
                  <Briefcase size={14} />
                  Open Positions
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Services</h3>
            <ul className="space-y-2 text-[var(--muted-color)]">
              <li>Exterior Detailing</li>
              <li>Interior Detailing</li>
              <li>Paint Protection</li>
              <li>Ceramic Coating</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-[var(--muted-color)]">
                <Phone size={16} />
                {BUSINESS.phone}
              </li>
              <li className="flex items-center gap-2 text-[var(--muted-color)]">
                <Mail size={16} />
                {BUSINESS.email}
              </li>
              <li className="flex items-center gap-2 text-[var(--muted-color)]">
                <MapPin size={16} />
                {BUSINESS.location}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-[var(--muted-color)]" style={{ borderColor: 'var(--border-color)' }}>
          <p>&copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
