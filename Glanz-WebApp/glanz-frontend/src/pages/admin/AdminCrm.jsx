import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmAPI } from '../../api/crm';
import { useLanguage } from '../../context/LanguageContext';
import {
  Users, TrendingUp, AlertTriangle, Star, DollarSign, 
  Calendar, MessageSquare, CheckCircle, XCircle,
  ChevronRight, Search, Tag, User, Phone, Mail,
  Filter, RefreshCw, MessageCircle, HelpCircle, ArrowRight,
  Crown, Car, Clock, TrendingDown, UserPlus, AlertCircle, Building,
  Target, Plus, Edit, Trash2
} from 'lucide-react';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'QAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  }).format(amount || 0);
};

const formatDate = (date) => {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
};

const getSegmentColor = (segment) => {
  const colors = {
    'VIP': '#c8a96b',
    'At-Risk': '#ef4444',
    'New': '#22c55e',
    'Loyal': '#0ea5e0',
    'Fleet': '#8b5cf6',
    'Inactive': '#6b7280',
    'Regular': '#3b82f6'
  };
  return colors[segment] || '#3b82f6';
};

const SEGMENT_INFO = {
  'VIP': {
    color: '#c8a96b',
    icon: Crown,
    description: 'High-value customers who have spent 5,000+ QAR or marked as VIP manually.',
    action: 'Offer exclusive deals, priority booking, dedicated worker assignment.'
  },
  'At-Risk': {
    color: '#ef4444',
    icon: AlertTriangle,
    description: 'Customers who haven\'t booked in 60+ days. They need attention!',
    action: 'Send special offers, call to understand concerns, offer discounts.'
  },
  'New': {
    color: '#22c55e',
    icon: UserPlus,
    description: 'Customers who joined in the last 30 days.',
    action: 'Welcome them, ensure they have a great first experience.'
  },
  'Regular': {
    color: '#3b82f6',
    icon: Users,
    description: 'Active customers who book occasionally.',
    action: 'Encourage more frequent bookings with loyalty offers.'
  },
  'Fleet': {
    color: '#8b5cf6',
    icon: Car,
    description: 'Commercial customers with multiple vehicles (tagged manually).',
    action: 'Offer bulk pricing, dedicated account manager, monthly invoicing.'
  },
  'Inactive': {
    color: '#6b7280',
    icon: Clock,
    description: 'Customers who haven\'t booked in 60+ days.',
    action: 'Re-engage with special comeback offers.'
  },
  'Loyal': {
    color: '#0ea5e0',
    icon: Star,
    description: 'Customers with 10+ completed bookings.',
    action: 'Reward loyalty with exclusive perks.'
  }
};

const QUICK_TAGS = [
  { label: 'VIP', color: '#c8a96b', icon: Crown },
  { label: 'Fleet', color: '#8b5cf6', icon: Car },
  { label: 'Commercial', color: '#f59e0b', icon: Building },
  { label: 'Preferred', color: '#0ea5e0', icon: Star },
];

const UI_BY_LANG = {
  en: {
    title: 'CRM Dashboard',
    subtitle: 'Manage customers, segments, and feedback',
    showGuide: 'Show Guide',
    hideGuide: 'Hide Guide',
    segmentGuide: 'Segment Guide - What Each Means & What To Do',
    quickActions: 'Quick Actions:',
    loading: 'Loading CRM data...',
    overview: 'Overview',
    customers: 'Customers',
    leads: 'Leads',
    feedback: 'Feedback',
    totalCustomers: 'Total Customers',
    activeThisMonth: 'Active (This Month)',
    atRisk: 'At Risk',
    noBooking60Days: "Haven't booked in 60+ days",
    vip: 'VIP',
    highValueCustomers: 'High-value customers',
    newLabel: 'New',
    last30Days: 'Last 30 days',
    revenueOverview: 'Revenue Overview',
    totalRevenueAllTime: 'Total Revenue (All Time)',
    averageCustomerValue: 'Average Customer Value',
    atRiskNeedAction: 'At-Risk Customers - Need Action!',
    lastLabel: 'Last',
    daysAgo: 'days ago',
    sendOffer: 'Send Offer',
    noAtRiskCustomers: 'No at-risk customers!',
    topSpenders: 'Top Spenders',
    bookings: 'Bookings',
    totalSpent: 'Total Spent',
    segment: 'Segment',
    actions: 'Actions',
    editTag: 'Edit / Tag',
    searchCustomers: 'Search customers...',
    selected: 'selected',
    contact: 'Contact',
    lastBooking: 'Last Booking',
    never: 'Never',
    allStatus: 'All Status',
    allSources: 'All Sources',
    addLead: 'Add Lead',
    leadSources: 'Lead Sources',
    noLeadsYet: 'No leads yet. Leads come from external sources like Facebook Lead Ads, Google LSA, or manual entry.',
    edit: 'Edit',
    delete: 'Delete',
    totalLeads: 'Total Leads',
    booked: 'Booked',
    lost: 'Lost',
    totalFeedback: 'Total Feedback',
    complaints: 'Complaints',
    unresolved: 'Unresolved',
    anonymous: 'Anonymous',
    booking: 'Booking',
    worker: 'Worker',
    resolved: 'Resolved',
    markResolved: 'Mark Resolved',
    noFeedbackYet: 'No feedback yet',
    editCustomer: 'Edit Customer',
    quickTagsToggle: 'Quick Tags (click to toggle)',
    customTags: 'Custom Tags (comma separated)',
    notesInternal: 'Notes (internal)',
    notesPlaceholder: 'Add internal notes about this customer...',
    totalBookings: 'Total Bookings',
    currentSegment: 'Current Segment',
    cancel: 'Cancel',
    saveChanges: 'Save Changes',
    editLead: 'Edit Lead',
    addNewLead: 'Add New Lead',
    nameRequired: 'Name *',
    phoneRequired: 'Phone *',
    email: 'Email',
    source: 'Source',
    status: 'Status',
    notes: 'Notes',
    save: 'Save',
    quickAction1: 'Select customers -> Use the checkbox to select multiple customers',
    quickAction2: 'Quick Tag -> Click VIP, Fleet, or Commercial buttons to tag selected customers',
    quickAction3: 'Add Custom Tag -> Type a tag and click the tag icon to apply',
    quickAction4: 'Edit Customer -> Click the edit icon to add notes or manually set tags'
  },
  ar: {
    title: 'لوحة CRM',
    subtitle: 'إدارة العملاء والتصنيفات والملاحظات',
    showGuide: 'إظهار الدليل',
    hideGuide: 'إخفاء الدليل',
    segmentGuide: 'دليل التصنيفات - ماذا تعني وماذا تفعل',
    quickActions: 'إجراءات سريعة:',
    loading: 'جارٍ تحميل بيانات CRM...',
    overview: 'نظرة عامة',
    customers: 'العملاء',
    leads: 'العملاء المحتملون',
    feedback: 'الملاحظات',
    totalCustomers: 'إجمالي العملاء',
    activeThisMonth: 'النشطون هذا الشهر',
    atRisk: 'معرضون للخطر',
    noBooking60Days: 'لم يحجزوا منذ 60+ يومًا',
    vip: 'كبار العملاء',
    highValueCustomers: 'عملاء ذوو قيمة عالية',
    newLabel: 'جديد',
    last30Days: 'آخر 30 يومًا',
    revenueOverview: 'نظرة عامة على الإيرادات',
    totalRevenueAllTime: 'إجمالي الإيراد (كل الوقت)',
    averageCustomerValue: 'متوسط قيمة العميل',
    atRiskNeedAction: 'عملاء معرضون للخطر - يحتاجون إجراء!',
    lastLabel: 'آخر',
    daysAgo: 'منذ أيام',
    sendOffer: 'إرسال عرض',
    noAtRiskCustomers: 'لا يوجد عملاء معرضون للخطر!',
    topSpenders: 'أعلى العملاء إنفاقًا',
    bookings: 'الحجوزات',
    totalSpent: 'إجمالي الإنفاق',
    segment: 'التصنيف',
    actions: 'الإجراءات',
    editTag: 'تعديل / وسم',
    searchCustomers: 'ابحث عن العملاء...',
    selected: 'محدد',
    contact: 'التواصل',
    lastBooking: 'آخر حجز',
    never: 'أبدًا',
    allStatus: 'كل الحالات',
    allSources: 'كل المصادر',
    addLead: 'إضافة عميل محتمل',
    leadSources: 'مصادر العملاء المحتملين',
    noLeadsYet: 'لا يوجد عملاء محتملون بعد. تأتي العملاء المحتملون من مصادر خارجية أو إدخال يدوي.',
    edit: 'تعديل',
    delete: 'حذف',
    totalLeads: 'إجمالي العملاء المحتملين',
    booked: 'محجوز',
    lost: 'مفقود',
    totalFeedback: 'إجمالي الملاحظات',
    complaints: 'الشكاوى',
    unresolved: 'غير محلول',
    anonymous: 'مجهول',
    booking: 'الحجز',
    worker: 'العامل',
    resolved: 'تم الحل',
    markResolved: 'تحديد كمحلول',
    noFeedbackYet: 'لا توجد ملاحظات بعد',
    editCustomer: 'تعديل العميل',
    quickTagsToggle: 'وسوم سريعة (انقر للتبديل)',
    customTags: 'وسوم مخصصة (مفصولة بفواصل)',
    notesInternal: 'ملاحظات داخلية',
    notesPlaceholder: 'أضف ملاحظات داخلية عن هذا العميل...',
    totalBookings: 'إجمالي الحجوزات',
    currentSegment: 'التصنيف الحالي',
    cancel: 'إلغاء',
    saveChanges: 'حفظ التغييرات',
    editLead: 'تعديل عميل محتمل',
    addNewLead: 'إضافة عميل محتمل جديد',
    nameRequired: 'الاسم *',
    phoneRequired: 'الهاتف *',
    email: 'البريد الإلكتروني',
    source: 'المصدر',
    status: 'الحالة',
    notes: 'ملاحظات',
    save: 'حفظ',
    quickAction1: 'اختيار العملاء -> استخدم مربع الاختيار لتحديد عدة عملاء',
    quickAction2: 'وسم سريع -> انقر ازرار VIP او Fleet او Commercial لوسم العملاء المحددين',
    quickAction3: 'إضافة وسم مخصص -> اكتب الوسم ثم انقر ايقونة الوسم للتطبيق',
    quickAction4: 'تعديل العميل -> انقر ايقونة التعديل لإضافة ملاحظات او تحديد الوسوم يدويًا'
  },
  de: {
    title: 'CRM-Dashboard',
    subtitle: 'Kunden, Segmente und Feedback verwalten',
    showGuide: 'Leitfaden anzeigen',
    hideGuide: 'Leitfaden ausblenden',
    segmentGuide: 'Segment-Leitfaden - Bedeutung und Aktionen',
    quickActions: 'Schnellaktionen:',
    loading: 'CRM-Daten werden geladen...',
    overview: 'Ubersicht',
    customers: 'Kunden',
    leads: 'Leads',
    feedback: 'Feedback',
    totalCustomers: 'Kunden gesamt',
    activeThisMonth: 'Aktiv (diesen Monat)',
    atRisk: 'Gefahrdet',
    noBooking60Days: 'Seit 60+ Tagen keine Buchung',
    vip: 'VIP',
    highValueCustomers: 'Wertvolle Kunden',
    newLabel: 'Neu',
    last30Days: 'Letzte 30 Tage',
    revenueOverview: 'Umsatzubersicht',
    totalRevenueAllTime: 'Gesamtumsatz (alle Zeit)',
    averageCustomerValue: 'Durchschnittlicher Kundenwert',
    atRiskNeedAction: 'Gefahrdete Kunden - Handlungsbedarf!',
    lastLabel: 'Zuletzt',
    daysAgo: 'Tage her',
    sendOffer: 'Angebot senden',
    noAtRiskCustomers: 'Keine gefahrdeten Kunden!',
    topSpenders: 'Top-Kunden nach Ausgaben',
    bookings: 'Buchungen',
    totalSpent: 'Gesamtausgaben',
    segment: 'Segment',
    actions: 'Aktionen',
    editTag: 'Bearbeiten / Tag',
    searchCustomers: 'Kunden suchen...',
    selected: 'ausgewahlt',
    contact: 'Kontakt',
    lastBooking: 'Letzte Buchung',
    never: 'Nie',
    allStatus: 'Alle Status',
    allSources: 'Alle Quellen',
    addLead: 'Lead hinzufugen',
    leadSources: 'Lead-Quellen',
    noLeadsYet: 'Noch keine Leads. Leads kommen aus externen Quellen oder manueller Eingabe.',
    edit: 'Bearbeiten',
    delete: 'Loschen',
    totalLeads: 'Leads gesamt',
    booked: 'Gebucht',
    lost: 'Verloren',
    totalFeedback: 'Feedback gesamt',
    complaints: 'Beschwerden',
    unresolved: 'Ungelost',
    anonymous: 'Anonym',
    booking: 'Buchung',
    worker: 'Mitarbeiter',
    resolved: 'Gelost',
    markResolved: 'Als gelost markieren',
    noFeedbackYet: 'Noch kein Feedback',
    editCustomer: 'Kunde bearbeiten',
    quickTagsToggle: 'Schnell-Tags (zum Umschalten klicken)',
    customTags: 'Benutzerdefinierte Tags (kommagetrennt)',
    notesInternal: 'Notizen (intern)',
    notesPlaceholder: 'Interne Notizen zu diesem Kunden hinzufugen...',
    totalBookings: 'Buchungen gesamt',
    currentSegment: 'Aktuelles Segment',
    cancel: 'Abbrechen',
    saveChanges: 'Anderungen speichern',
    editLead: 'Lead bearbeiten',
    addNewLead: 'Neuen Lead hinzufugen',
    nameRequired: 'Name *',
    phoneRequired: 'Telefon *',
    email: 'E-Mail',
    source: 'Quelle',
    status: 'Status',
    notes: 'Notizen',
    save: 'Speichern',
    quickAction1: 'Kunden auswahlen -> Mit der Checkbox mehrere Kunden auswahlen',
    quickAction2: 'Schnell-Tag -> Klicke VIP-, Fleet- oder Commercial-Buttons fur ausgewahlte Kunden',
    quickAction3: 'Benutzerdefinierten Tag hinzufugen -> Tag eingeben und auf das Tag-Symbol klicken',
    quickAction4: 'Kunde bearbeiten -> Auf das Bearbeiten-Symbol klicken, um Notizen oder Tags zu setzen'
  },
};

export default function AdminCrm() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const localeKey = String(lang || '').startsWith('ar') ? 'ar' : String(lang || '').startsWith('de') ? 'de' : 'en';
  const ui = UI_BY_LANG[localeKey] || UI_BY_LANG.en;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ tags: '', notes: '' });
  const [showHelp, setShowHelp] = useState(false);
  const [leads, setLeads] = useState([]);
  const [leadStats, setLeadStats] = useState(null);
  const [leadFilter, setLeadFilter] = useState({ status: '', source: '' });
  const [editingLead, setEditingLead] = useState(null);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', email: '', notes: '', source: 'Other', status: 'New' });

  useEffect(() => {
    loadData();
  }, [activeTab, selectedSegment]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const data = await crmAPI.getDashboard();
        setStats(data);
      } else if (activeTab === 'customers') {
        const data = await crmAPI.getCustomers(selectedSegment);
        setCustomers(data);
      } else if (activeTab === 'leads') {
        const [leadsData, statsData] = await Promise.all([
          crmAPI.getLeads(leadFilter),
          crmAPI.getLeadStats()
        ]);
        setLeads(leadsData);
        setLeadStats(statsData);
      } else if (activeTab === 'feedback') {
        const data = await crmAPI.getAllFeedback();
        setFeedback(data);
      }
    } catch (err) {
      console.error('CRM load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update lead form when editingLead changes
  useEffect(() => {
    if (editingLead && editingLead.id) {
      setLeadForm({
        name: editingLead.name || '',
        phone: editingLead.phone || '',
        email: editingLead.email || '',
        notes: editingLead.notes || '',
        source: editingLead.source || 'Other',
        status: editingLead.status || 'New'
      });
    } else if (editingLead === null) {
      setLeadForm({ name: '', phone: '', email: '', notes: '', source: 'Other', status: 'New' });
    }
  }, [editingLead]);

  const handleBulkTag = async (tag, remove = false) => {
    if (selectedCustomers.length === 0) return;
    try {
      await crmAPI.bulkUpdateTags(selectedCustomers, tag, remove);
      setSelectedCustomers([]);
      loadData();
    } catch (err) {
      console.error('Bulk tag error:', err);
    }
  };

  const openCustomerEdit = (customer) => {
    setEditingCustomer(customer);
    setCustomerForm({ 
      tags: customer.tags || '', 
      notes: customer.notes || '' 
    });
  };

  const saveCustomerEdit = async () => {
    try {
      await crmAPI.updateCustomer(editingCustomer.id, {
        tags: customerForm.tags,
        notes: customerForm.notes
      });
      setEditingCustomer(null);
      loadData();
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  const resolveFeedback = async (id, note) => {
    try {
      await crmAPI.resolveFeedback(id, note);
      loadData();
    } catch (err) {
      console.error('Resolve error:', err);
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm('Delete this lead?')) return;
    try {
      await crmAPI.deleteLead(id);
      loadData();
    } catch (err) {
      console.error('Delete lead error:', err);
    }
  };

  const handleSaveLead = async () => {
    try {
      if (editingLead?.id) {
        await crmAPI.updateLead(editingLead.id, leadForm);
      } else {
        await crmAPI.createLead(leadForm);
      }
      setEditingLead(null);
      setLeadForm({ name: '', phone: '', email: '', notes: '', source: 'Other', status: 'New' });
      loadData();
    } catch (err) {
      console.error('Save lead error:', err);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: 'dashboard', label: ui.overview, icon: TrendingUp },
    { id: 'customers', label: ui.customers, icon: Users },
    { id: 'leads', label: ui.leads, icon: Target },
    { id: 'feedback', label: ui.feedback, icon: MessageCircle },
  ];

  return (
    <div className="p-6 min-h-screen" style={{ background: 'var(--surface-bg)' }}>
      <style>{`
        .stat-card { 
          background: var(--card-bg); 
          border: 1px solid var(--border-color); 
          border-radius: 16px; 
          padding: 20px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .stat-card:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        .segment-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .help-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
        }
      `}</style>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>
            {ui.title}
          </h1>
          <p style={{ color: 'var(--muted-color)' }}>{ui.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
          >
            <HelpCircle size={18} />
            {showHelp ? ui.hideGuide : ui.showGuide}
          </button>
          <button 
            onClick={loadData}
            className="p-2 rounded-lg hover:bg-[var(--card-bg)]"
            style={{ color: 'var(--muted-color)' }}
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(200,169,107,0.1)', border: '1px solid rgba(200,169,107,0.3)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--heading-color)' }}>📚 {ui.segmentGuide}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(SEGMENT_INFO).map(([segment, info]) => {
              const Icon = info.icon;
              return (
                <div key={segment} className="help-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                      style={{ background: info.color + '20', color: info.color }}
                    >
                      <Icon size={12} /> {segment}
                    </span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: 'var(--muted-color)' }}>{info.description}</p>
                  <p className="text-xs font-medium" style={{ color: 'var(--cta-color)' }}>→ {info.action}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--surface-bg)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--heading-color)' }}>💡 {ui.quickActions}</p>
            <ul className="text-xs mt-2 space-y-1" style={{ color: 'var(--muted-color)' }}>
              <li>• {ui.quickAction1}</li>
              <li>• {ui.quickAction2}</li>
              <li>• {ui.quickAction3}</li>
              <li>• {ui.quickAction4}</li>
            </ul>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-[var(--cta-color)] text-white' 
                : 'bg-[var(--card-bg)] hover:bg-[var(--cta-soft-bg)]'
            }`}
            style={{ 
              color: activeTab === tab.id ? 'white' : 'var(--text-color)',
              border: '1px solid var(--border-color)'
            }}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: 'var(--muted-color)' }}>
          {ui.loading}
        </div>
      ) : activeTab === 'dashboard' && stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--muted-color)' }}>{ui.totalCustomers}</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--heading-color)' }}>{stats.totalCustomers}</p>
                </div>
                <div className="p-3 rounded-full bg-[var(--cta-color)] bg-opacity-10">
                  <Users size={24} style={{ color: 'var(--cta-color)' }} />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--muted-color)' }}>{ui.activeThisMonth}</p>
                  <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>{stats.activeThisMonth}</p>
                </div>
                <div className="p-3 rounded-full bg-green-500 bg-opacity-10">
                  <CheckCircle size={24} className="text-green-500" />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--muted-color)' }}>⚠️ {ui.atRisk}</p>
                  <p className="text-3xl font-bold" style={{ color: '#ef4444' }}>{stats.atRiskCustomers}</p>
                </div>
                <div className="p-3 rounded-full bg-red-500 bg-opacity-10">
                  <AlertTriangle size={24} className="text-red-500" />
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--muted-color)' }}>{ui.noBooking60Days}</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--muted-color)' }}>⭐ {ui.vip}</p>
                  <p className="text-3xl font-bold" style={{ color: '#c8a96b' }}>{stats.vipCustomers}</p>
                </div>
                <div className="p-3 rounded-full bg-yellow-500 bg-opacity-10">
                  <Crown size={24} style={{ color: '#c8a96b' }} />
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--muted-color)' }}>{ui.highValueCustomers}</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--muted-color)' }}>🆕 {ui.newLabel}</p>
                  <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>{stats.newCustomers}</p>
                </div>
                <div className="p-3 rounded-full bg-green-500 bg-opacity-10">
                  <UserPlus size={24} className="text-green-500" />
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--muted-color)' }}>{ui.last30Days}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--heading-color)' }}>
                💰 {ui.revenueOverview}
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--surface-bg)' }}>
                  <span style={{ color: 'var(--muted-color)' }}>{ui.totalRevenueAllTime}</span>
                  <span className="font-bold text-xl" style={{ color: 'var(--heading-color)' }}>
                    {formatCurrency(stats.totalRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--surface-bg)' }}>
                  <span style={{ color: 'var(--muted-color)' }}>{ui.averageCustomerValue}</span>
                  <span className="font-semibold" style={{ color: 'var(--text-color)' }}>
                    {formatCurrency(stats.averageCustomerValue)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--heading-color)' }}>
                ⚠️ {ui.atRiskNeedAction}
              </h3>
              <div className="space-y-3">
                {stats.recentAtRisk?.slice(0, 5).map(c => (
                  <div 
                    key={c.id} 
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-red-500 hover:bg-opacity-5"
                    onClick={() => { setActiveTab('customers'); setSelectedSegment('At-Risk'); }}
                  >
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-color)' }}>{c.name}</p>
                      <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.lastLabel}: {formatDate(c.lastBookedDate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: '#ef4444' }}>{c.daysSinceLastBooking} {ui.daysAgo}</p>
                      <button 
                        className="text-xs mt-1 px-2 py-1 rounded bg-[var(--cta-color)] text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCustomerEdit(c);
                        }}
                      >
                        {ui.sendOffer}
                      </button>
                    </div>
                  </div>
                ))}
                {(!stats.recentAtRisk || stats.recentAtRisk.length === 0) && (
                  <p className="text-center py-4" style={{ color: 'var(--muted-color)' }}>🎉 {ui.noAtRiskCustomers}</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--heading-color)' }}>
              🏆 Top Spenders
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-color)' }}>{ui.customers}</th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-color)' }}>{ui.bookings}</th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-color)' }}>{ui.totalSpent}</th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-color)' }}>{ui.segment}</th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--muted-color)' }}>{ui.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topSpenders?.map((c, idx) => (
                    <tr 
                      key={c.id} 
                      className="cursor-pointer hover:bg-[var(--surface-bg)]"
                      style={{ borderBottom: '1px solid var(--border-color)' }}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : idx + 1 === 3 ? '🥉' : '👤'}</span>
                          <div>
                            <p className="font-medium" style={{ color: 'var(--text-color)' }}>{c.name}</p>
                            <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-color)' }}>{c.totalBookings}</td>
                      <td className="py-3 px-4 font-bold" style={{ color: 'var(--heading-color)' }}>
                        {formatCurrency(c.totalSpent)}
                      </td>
                      <td className="py-3 px-4">
                        <span 
                          className="segment-badge"
                          style={{ 
                            background: getSegmentColor(c.segment) + '20',
                            color: getSegmentColor(c.segment)
                          }}
                        >
                          {c.segment}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openCustomerEdit(c)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: 'var(--surface-bg)', color: 'var(--text-color)' }}
                        >
                          {ui.editTag}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'customers' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              {['All', 'VIP', 'At-Risk', 'New', 'Active', 'Inactive'].map(seg => (
                <button
                  key={seg}
                  onClick={() => setSelectedSegment(seg)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedSegment === seg 
                      ? 'bg-[var(--cta-color)] text-white' 
                      : 'bg-[var(--card-bg)]'
                  }`}
                  style={{ 
                    color: selectedSegment === seg ? 'white' : 'var(--text-color)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  {seg}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-color)' }} />
                <input
                  type="text"
                  placeholder={ui.searchCustomers}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-lg"
                  style={{ 
                    background: 'var(--card-bg)', 
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-color)'
                  }}
                />
              </div>

              {selectedCustomers.length > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                  <span className="text-sm" style={{ color: 'var(--muted-color)' }}>
                    {selectedCustomers.length} {ui.selected}
                  </span>
                  <div className="flex gap-1">
                    {QUICK_TAGS.map(tag => (
                      <button
                        key={tag.label}
                        onClick={() => handleBulkTag(tag.label)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                        style={{ background: tag.color + '20', color: tag.color }}
                      >
                        <tag.icon size={12} />
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--surface-bg)' }}>
                  <th className="w-10 py-4 px-4">
                    <input 
                      type="checkbox"
                      checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                      onChange={(e) => setSelectedCustomers(e.target.checked ? filteredCustomers.map(c => c.id) : [])}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left py-4 px-4" style={{ color: 'var(--muted-color)' }}>{ui.customers}</th>
                  <th className="text-left py-4 px-4" style={{ color: 'var(--muted-color)' }}>{ui.contact}</th>
                  <th className="text-left py-4 px-4" style={{ color: 'var(--muted-color)' }}>{ui.bookings}</th>
                  <th className="text-left py-4 px-4" style={{ color: 'var(--muted-color)' }}>{ui.totalSpent}</th>
                  <th className="text-left py-4 px-4" style={{ color: 'var(--muted-color)' }}>{ui.lastBooking}</th>
                  <th className="text-left py-4 px-4" style={{ color: 'var(--muted-color)' }}>{ui.segment}</th>
                  <th className="text-left py-4 px-4" style={{ color: 'var(--muted-color)' }}>{ui.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-[var(--surface-bg)]" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td className="py-3 px-4">
                      <input 
                        type="checkbox"
                        checked={selectedCustomers.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCustomers([...selectedCustomers, c.id]);
                          } else {
                            setSelectedCustomers(selectedCustomers.filter(id => id !== c.id));
                          }
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium" style={{ color: 'var(--text-color)' }}>{c.name}</p>
                      {c.tags && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {c.tags.split(',').map((t, i) => (
                            <span 
                              key={i} 
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{ 
                                background: getSegmentColor(t.trim()) + '20',
                                color: getSegmentColor(t.trim())
                              }}
                            >
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm" style={{ color: 'var(--text-color)' }}>{c.email}</p>
                      {c.phone && <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{c.phone}</p>}
                    </td>
                    <td className="py-3 px-4" style={{ color: 'var(--text-color)' }}>{c.totalBookings}</td>
                    <td className="py-3 px-4 font-bold" style={{ color: 'var(--heading-color)' }}>
                      {formatCurrency(c.totalSpent)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm" style={{ color: 'var(--text-color)' }}>
                        {c.lastBookedDate ? formatDate(c.lastBookedDate) : ui.never}
                      </p>
                      {c.daysSinceLastBooking > 0 && (
                        <p className="text-xs" style={{ color: c.daysSinceLastBooking > 60 ? '#ef4444' : 'var(--muted-color)' }}>
                          {c.daysSinceLastBooking} {ui.daysAgo}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span 
                        className="segment-badge"
                        style={{ 
                          background: getSegmentColor(c.segment) + '20',
                          color: getSegmentColor(c.segment)
                        }}
                      >
                        {c.segment}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => openCustomerEdit(c)}
                        className="p-2 rounded-lg hover:bg-[var(--surface-bg)]"
                        style={{ color: 'var(--muted-color)' }}
                      >
                        <Tag size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'leads' ? (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="p-4 rounded-xl flex-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.totalLeads}</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>{leadStats?.total || 0}</p>
            </div>
            <div className="p-4 rounded-xl flex-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.newLabel}</p>
              <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{leadStats?.new || 0}</p>
            </div>
            <div className="p-4 rounded-xl flex-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.booked}</p>
              <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{leadStats?.booked || 0}</p>
            </div>
            <div className="p-4 rounded-xl flex-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.lost}</p>
              <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>{leadStats?.lost || 0}</p>
            </div>
          </div>

          <div className="flex gap-4 items-center flex-wrap">
            <select 
              value={leadFilter.status}
              onChange={(e) => setLeadFilter({ ...leadFilter, status: e.target.value })}
              className="px-4 py-2 rounded-lg border"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
            >
              <option value="">{ui.allStatus}</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Interested">Interested</option>
              <option value="Booked">Booked</option>
              <option value="Lost">Lost</option>
            </select>
            <select 
              value={leadFilter.source}
              onChange={(e) => setLeadFilter({ ...leadFilter, source: e.target.value })}
              className="px-4 py-2 rounded-lg border"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
            >
              <option value="">{ui.allSources}</option>
              <option value="Direct">Direct</option>
              <option value="GoogleSearch">Google Search</option>
              <option value="GoogleMaps">Google Maps</option>
              <option value="GoogleLSA">Google LSA</option>
              <option value="Facebook">Facebook</option>
              <option value="Instagram">Instagram</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Referral">Referral</option>
            </select>
            <button 
              onClick={() => setEditingLead({})}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
              style={{ background: 'var(--cta-color)', color: 'white' }}
            >
              <Plus size={18} /> {ui.addLead}
            </button>
          </div>

          {leadStats?.sourceBreakdown && leadStats.sourceBreakdown.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--muted-color)' }}>{ui.leadSources}</p>
              <div className="flex flex-wrap gap-2">
                {leadStats.sourceBreakdown.map(s => (
                  <span key={s.source} className="px-3 py-1 rounded-full text-sm" style={{ background: 'var(--cta-soft-bg)', color: 'var(--text-color)' }}>
                    {s.source}: <b>{s.count}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {leads.length === 0 ? (
              <div className="p-8 text-center rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                <Target size={48} className="mx-auto mb-4" style={{ color: 'var(--muted-color)' }} />
                <p style={{ color: 'var(--muted-color)' }}>{ui.noLeadsYet}</p>
              </div>
            ) : (
              leads.map(lead => (
                <div key={lead.id} className="p-4 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold" style={{ color: 'var(--heading-color)' }}>{lead.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          lead.status === 'New' ? 'bg-green-500/20 text-green-500' :
                          lead.status === 'Contacted' ? 'bg-blue-500/20 text-blue-500' :
                          lead.status === 'Interested' ? 'bg-yellow-500/20 text-yellow-500' :
                          lead.status === 'Booked' ? 'bg-primary/20 text-primary' :
                          'bg-gray-500/20 text-gray-500'
                        }`}>
                          {lead.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--muted-color)' }}>
                        <span className="flex items-center gap-1"><Phone size={14} /> {lead.phone}</span>
                        {lead.email && <span className="flex items-center gap-1"><Mail size={14} /> {lead.email}</span>}
                        <span className="px-2 py-0.5 rounded bg-[var(--cta-soft-bg)] text-xs">{lead.source}</span>
                      </div>
                      {lead.sourceDetails && (
                        <p className="text-xs mt-1" style={{ color: 'var(--muted-color)' }}>{lead.sourceDetails}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingLead(lead)}
                        className="p-2 rounded-lg hover:bg-[var(--cta-soft-bg)]"
                        title={ui.edit}
                      >
                        <Edit size={16} style={{ color: 'var(--muted-color)' }} />
                      </button>
                      <button 
                        onClick={() => handleDeleteLead(lead.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10"
                        title={ui.delete}
                      >
                        <Trash2 size={16} style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'feedback' ? (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="p-4 rounded-xl flex-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.totalFeedback}</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--heading-color)' }}>{feedback.length}</p>
            </div>
            <div className="p-4 rounded-xl flex-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.complaints}</p>
              <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>
                {feedback.filter(f => f.type === 'Complaint').length}
              </p>
            </div>
            <div className="p-4 rounded-xl flex-1" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.unresolved}</p>
              <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
                {feedback.filter(f => f.type === 'Complaint' && !f.isResolved).length}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {feedback.map(f => (
              <div 
                key={f.id} 
                className="p-4 rounded-xl"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span 
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ 
                          background: f.type === 'Complaint' ? '#ef444420' : '#22c55e20',
                          color: f.type === 'Complaint' ? '#ef4444' : '#22c55e'
                        }}
                      >
                        {f.type}
                      </span>
                      {f.isAnonymous && (
                        <span className="text-xs" style={{ color: 'var(--muted-color)' }}>{ui.anonymous}</span>
                      )}
                      {f.rating > 0 && (
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(i => (
                            <Star 
                              key={i} 
                              size={14} 
                              className={i <= f.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'} 
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="font-medium" style={{ color: 'var(--text-color)' }}>
                      {f.isAnonymous ? ui.anonymous : f.userName || f.userId}
                    </p>
                    {f.bookingNumber && (
                      <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.booking}: {f.bookingNumber}</p>
                    )}
                    {f.workerName && (
                      <p className="text-sm" style={{ color: 'var(--muted-color)' }}>{ui.worker}: {f.workerName}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm" style={{ color: 'var(--muted-color)' }}>
                      {formatDate(f.createdAt)}
                    </p>
                    {f.isResolved ? (
                      <span className="text-xs text-green-500">✓ {ui.resolved}</span>
                    ) : (
                      <button
                        onClick={() => resolveFeedback(f.id, 'Resolved via CRM')}
                        className="text-xs px-2 py-1 rounded bg-[var(--cta-color)] text-white mt-2"
                      >
                        {ui.markResolved}
                      </button>
                    )}
                  </div>
                </div>
                {f.comment && (
                  <p className="mt-3 p-3 rounded-lg" style={{ background: 'var(--surface-bg)', color: 'var(--text-color)' }}>
                    "{f.comment}"
                  </p>
                )}
              </div>
            ))}
            {feedback.length === 0 && (
              <p className="text-center py-8" style={{ color: 'var(--muted-color)' }}>{ui.noFeedbackYet}</p>
            )}
          </div>
        </div>
      ) : null}

      {editingCustomer && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--heading-color)' }}>
              {ui.editCustomer}: {editingCustomer.name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-color)' }}>
                  {ui.quickTagsToggle}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {QUICK_TAGS.map(tag => {
                    const isActive = editingCustomer.tags?.includes(tag.label);
                    return (
                      <button
                        key={tag.label}
                        onClick={() => {
                          const currentTags = editingCustomer.tags ? editingCustomer.tags.split(',').map(t => t.trim()) : [];
                          const newTags = isActive 
                            ? currentTags.filter(t => t !== tag.label)
                            : [...currentTags, tag.label];
                          setEditingCustomer({ ...editingCustomer, tags: newTags.join(', ') });
                          setCustomerForm({ ...customerForm, tags: newTags.join(', ') });
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          isActive ? 'text-white' : ''
                        }`}
                        style={{ 
                          background: isActive ? tag.color : tag.color + '20',
                          color: isActive ? 'white' : tag.color
                        }}
                      >
                        <tag.icon size={14} /> {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-color)' }}>
                  {ui.customTags}
                </label>
                <input
                  type="text"
                  value={customerForm.tags}
                  onChange={(e) => setCustomerForm({ ...customerForm, tags: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg"
                  style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
                  placeholder="VIP, Fleet, Commercial"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-color)' }}>
                  {ui.notesInternal}
                </label>
                <textarea
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg h-32"
                  style={{ background: 'var(--surface-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
                  placeholder={ui.notesPlaceholder}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs" style={{ color: 'var(--muted-color)' }}>{ui.totalSpent}</p>
                  <p className="font-semibold" style={{ color: 'var(--heading-color)' }}>
                    {formatCurrency(editingCustomer.totalSpent)}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--muted-color)' }}>{ui.totalBookings}</p>
                  <p className="font-semibold" style={{ color: 'var(--heading-color)' }}>
                    {editingCustomer.totalBookings}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--muted-color)' }}>{ui.lastBooking}</p>
                  <p className="font-semibold" style={{ color: 'var(--heading-color)' }}>
                    {editingCustomer.lastBookedDate ? formatDate(editingCustomer.lastBookedDate) : ui.never}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--muted-color)' }}>{ui.currentSegment}</p>
                  <span 
                    className="segment-badge"
                    style={{ 
                      background: getSegmentColor(editingCustomer.segment) + '20',
                      color: getSegmentColor(editingCustomer.segment)
                    }}
                  >
                    {editingCustomer.segment}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingCustomer(null)}
                className="flex-1 py-2 rounded-lg"
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
              >
                {ui.cancel}
              </button>
              <button
                onClick={saveCustomerEdit}
                className="flex-1 py-2 rounded-lg bg-[var(--cta-color)] text-white font-medium"
              >
                {ui.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLead !== null && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--heading-color)' }}>
              {editingLead.id ? ui.editLead : ui.addNewLead}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-color)' }}>{ui.nameRequired}</label>
                <input 
                  type="text" 
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-color)' }}>{ui.phoneRequired}</label>
                <input 
                  type="tel" 
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-color)' }}>{ui.email}</label>
                <input 
                  type="email" 
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-color)' }}>{ui.source}</label>
                <select 
                  value={leadForm.source}
                  onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                >
                  <option value="Direct">Direct</option>
                  <option value="GoogleSearch">Google Search</option>
                  <option value="GoogleMaps">Google Maps</option>
                  <option value="GoogleLSA">Google Local Services</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Referral">Referral</option>
                  <option value="Returning">Returning Customer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-color)' }}>{ui.status}</label>
                <select 
                  value={leadForm.status}
                  onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Interested">Interested</option>
                  <option value="Booked">Booked</option>
                  <option value="Lost">Lost</option>
                  <option value="Junk">Junk</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-color)' }}>{ui.notes}</label>
                <textarea 
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setEditingLead(null); setLeadForm({ name: '', phone: '', email: '', notes: '', source: 'Other', status: 'New' }); }}
                className="flex-1 py-2 rounded-lg"
                style={{ border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
              >
                {ui.cancel}
              </button>
              <button
                onClick={handleSaveLead}
                className="flex-1 py-2 rounded-lg bg-[var(--cta-color)] text-white font-medium"
                disabled={!leadForm.name || !leadForm.phone}
              >
                {ui.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}