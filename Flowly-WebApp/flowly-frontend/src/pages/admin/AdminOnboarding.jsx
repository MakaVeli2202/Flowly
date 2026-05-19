import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle, Circle, Users, Package, Wrench,
  Clock, Palette, ChevronRight, Rocket,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';

const STEPS = [
  {
    key: 'hasWorkers',
    icon: Users,
    title: 'Add your first staff member',
    description: 'Add the people who will be doing the work.',
    link: '/admin/staff/add',
    linkLabel: 'Add Staff',
  },
  {
    key: 'hasServices',
    icon: Wrench,
    title: 'Create a service',
    description: 'Define the services your business offers.',
    link: '/admin/services',
    linkLabel: 'Manage Services',
  },
  {
    key: 'hasPackages',
    icon: Package,
    title: 'Set up a package',
    description: 'Bundle services into bookable packages.',
    link: '/admin/packages',
    linkLabel: 'Manage Packages',
  },
  {
    key: 'hasBusinessHours',
    icon: Clock,
    title: 'Configure business hours',
    description: 'Set when your business is open for bookings.',
    link: '/admin/settings',
    linkLabel: 'Open Settings',
  },
  {
    key: 'hasBranding',
    icon: Palette,
    title: 'Add your branding',
    description: 'Upload a logo and set your brand colors.',
    link: '/admin/settings',
    linkLabel: 'Brand Settings',
  },
];

export default function AdminOnboarding() {
  const navigate = useNavigate();
  const { onboarding, refreshOnboarding } = useTenant();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshOnboarding?.();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshOnboarding?.();
    setRefreshing(false);
  };

  const allDone = onboarding?.isComplete;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <Rocket className="w-12 h-12 mx-auto text-[var(--brand-primary,#c8a96b)]" />
        <h1 className="text-2xl font-bold">Welcome! Let's set up your business.</h1>
        <p className="text-muted">Complete these steps to start accepting bookings.</p>
      </div>

      {/* Progress bar */}
      {onboarding && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted">
            <span>{onboarding.completedSteps} of {onboarding.totalSteps} steps complete</span>
            <span>{Math.round((onboarding.completedSteps / onboarding.totalSteps) * 100)}%</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--brand-primary,#c8a96b)] rounded-full transition-all duration-500"
              style={{ width: `${(onboarding.completedSteps / onboarding.totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step) => {
          const done = onboarding?.[step.key] ?? false;
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                done ? 'border-green-500/30 bg-green-500/5 opacity-70' : 'border-border bg-surface-card'
              }`}
            >
              {done
                ? <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                : <Circle className="w-6 h-6 text-muted shrink-0" />
              }
              <Icon className="w-5 h-5 text-[var(--brand-primary,#c8a96b)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${done ? 'line-through text-muted' : ''}`}>{step.title}</p>
                <p className="text-sm text-muted">{step.description}</p>
              </div>
              {!done && (
                <Link
                  to={step.link}
                  className="btn btn-sm btn-outline shrink-0 flex items-center gap-1"
                >
                  {step.linkLabel} <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn btn-outline flex-1"
        >
          {refreshing ? 'Checking...' : 'Refresh Progress'}
        </button>
        <button
          onClick={() => navigate('/admin')}
          className="btn btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {allDone ? 'Go to Dashboard' : 'Skip for now'}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {allDone && (
        <div className="text-center p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-500">Setup complete! Your business is ready.</p>
        </div>
      )}
    </div>
  );
}
