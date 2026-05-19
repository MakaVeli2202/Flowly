import React from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Users, Package, Calendar, FileText, ShoppingBag, Car, Star, Settings, Bell, Search, AlertCircle } from 'lucide-react';

const ICONS = {
  inbox: Inbox,
  users: Users,
  package: Package,
  calendar: Calendar,
  file: FileText,
  shopping: ShoppingBag,
  car: Car,
  star: Star,
  settings: Settings,
  bell: Bell,
  search: Search,
  alert: AlertCircle,
  default: Inbox,
};

const SIZES = {
  sm: { icon: 32, container: 'w-12 h-12', text: 'text-sm' },
  md: { icon: 48, container: 'w-16 h-16', text: 'text-base' },
  lg: { icon: 64, container: 'w-24 h-24', text: 'text-lg' },
};

export function EmptyState({ 
  icon = 'inbox', 
  title, 
  description, 
  actionLabel, 
  actionUrl,
  onAction,
  size = 'md',
  className = ''
}) {
  const IconComponent = ICONS[icon] || ICONS.default;
  const sizeConfig = SIZES[size];
  
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
      <div className={`${sizeConfig.container} rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]/50 flex items-center justify-center mb-4`}>
        <IconComponent size={sizeConfig.icon} className="text-[var(--muted-color)]" />
      </div>
      {title && (
        <h3 className={`font-semibold text-[var(--heading-color)] ${sizeConfig.text} mb-2`}>
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-[var(--muted-color)] max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {(actionLabel && (actionUrl || onAction)) && (
        actionUrl ? (
          <Link
            to={actionUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm hover:shadow-lg hover:shadow-primary/25 transition-all"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm hover:shadow-lg hover:shadow-primary/25 transition-all"
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}

export function EmptyTable({ columns = 4, message = 'No data available' }) {
  return (
    <tr>
      <td colSpan={columns} className="py-16">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)]/50 flex items-center justify-center mb-4">
            <Inbox size={32} className="text-[var(--muted-color)]" />
          </div>
          <p className="text-[var(--muted-color)]">{message}</p>
        </div>
      </td>
    </tr>
  );
}

export function EmptyList({ type = 'default', title, description, actionLabel, actionUrl }) {
  const config = {
    default: { icon: 'inbox', title: 'Nothing here yet', description: 'There are no items to display.' },
    bookings: { icon: 'calendar', title: 'No bookings yet', description: 'Book your first service and see it here.' },
    packages: { icon: 'package', title: 'No packages available', description: 'Check back later for available packages.' },
    users: { icon: 'users', title: 'No users found', description: 'Try adjusting your search criteria.' },
    notifications: { icon: 'bell', title: 'All caught up!', description: 'You have no new notifications.' },
    vehicles: { icon: 'car', title: 'No vehicles added', description: 'Add a vehicle to get started.' },
    reviews: { icon: 'star', title: 'No reviews yet', description: 'Reviews will appear here after completion.' },
    search: { icon: 'search', title: 'No results found', description: 'Try different keywords or filters.' },
    settings: { icon: 'settings', title: 'No settings', description: 'Configure your settings here.' },
    error: { icon: 'alert', title: 'Something went wrong', description: 'Please try again later.' },
  };
  
  const content = config[type] || config.default;
  
  return (
    <EmptyState
      icon={content.icon}
      title={title || content.title}
      description={description || content.description}
      actionLabel={actionLabel}
      actionUrl={actionUrl}
      size="lg"
    />
  );
}