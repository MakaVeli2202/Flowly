import React, { useEffect, useState } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, AppState, Dimensions,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';
import { notificationsAPI } from '../api/notifications';
import { subscribeToNotifications, startNotificationConnection } from '../api/signalr';
import { API_BASE_URL } from '../config/api';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminJobsScreen from '../screens/AdminJobsScreen';
import CreateWorkerScreen from '../screens/CreateWorkerScreen';
import WorkerManagementScreen from '../screens/WorkerManagementScreen';
import HomeScreen from '../screens/HomeScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PackagesScreen from '../screens/PackagesScreen';
import SubscriptionPlansScreen from '../screens/SubscriptionPlansScreen';
import BookingScreen from '../screens/BookingScreen';
import MyBookingsScreen from '../screens/MyBookingsScreen';
import BookingConfirmationScreen from '../screens/BookingConfirmationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WorkerSalesScreen from '../screens/WorkerSalesScreen';
import ChatbotScreen from '../screens/ChatbotScreen';
import AdminProductsScreen from '../screens/AdminProductsScreen';
import AdminServicesScreen from '../screens/AdminServicesScreen';
import AdminPackagesScreen from '../screens/AdminPackagesScreen';
import AdminOffersScreen from '../screens/AdminOffersScreen';
import AdminReportsScreen from '../screens/AdminReportsScreen';
import AdminSubscriptionsScreen from '../screens/AdminSubscriptionsScreen';
import AdminSystemSettingsScreen from '../screens/AdminSystemSettingsScreen';
import SubscriptionBookingScreen from '../screens/SubscriptionBookingScreen';
import MySubscriptionScreen from '../screens/MySubscriptionScreen';
import SubscriptionCheckoutScreen from '../screens/SubscriptionCheckoutScreen';

const Stack  = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const { width } = Dimensions.get('window');

// ── Start fully transparent — each screen fills it in via useScrollHeader ──────
const SHARED_HEADER_OPTIONS = {
  headerTransparent:   true,
  headerBlurEffect:    'dark',
  headerStyle:         { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerTintColor:     theme.colors.text,
  headerTitleStyle:    { fontWeight: '800', color: theme.colors.text },
};

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary:    theme.colors.primary,
    background: theme.colors.bg,
    card:       'transparent',
    text:       theme.colors.text,
    border:     'transparent',
  },
};

const ADMIN_DRAWER_ITEMS = [
  { name: 'Admin Home',          icon: 'grid-outline',          iconFilled: 'grid',          label: 'Dashboard'        },
  { name: 'Today Jobs',          icon: 'radio-outline',         iconFilled: 'radio',         label: "Today's Dispatch" },
  { name: 'All Jobs',            icon: 'briefcase-outline',     iconFilled: 'briefcase',     label: 'All Jobs'         },
  { name: 'Admin Reports',       icon: 'bar-chart-outline',     iconFilled: 'bar-chart',     label: 'Reports'          },
  { name: 'Admin Products',      icon: 'cube-outline',          iconFilled: 'cube',          label: 'Products'         },
  { name: 'Admin Services',      icon: 'construct-outline',     iconFilled: 'construct',     label: 'Services'         },
  { name: 'Admin Packages',      icon: 'layers-outline',        iconFilled: 'layers',        label: 'Packages'         },
  { name: 'Admin Offers',        icon: 'ticket-outline',        iconFilled: 'ticket',        label: 'Offers'           },
  { name: 'Admin Subscriptions', icon: 'repeat-outline',        iconFilled: 'repeat',        label: 'Subscriptions'    },
  { name: 'Worker Management',   icon: 'people-outline',        iconFilled: 'people',        label: 'Workers'          },
  { name: 'Create Worker',       icon: 'person-add-outline',    iconFilled: 'person-add',    label: 'Add Worker'       },
  { name: 'Admin Notifications', icon: 'notifications-outline', iconFilled: 'notifications', label: 'Notifications'    },
  { name: 'System Settings',     icon: 'settings-outline',      iconFilled: 'settings',      label: 'System Settings'  },
];

const DRAWER_ITEMS = [
  { name: 'Home',          icon: 'home-outline',                iconFilled: 'home',               label: 'Home'         },
  { name: 'Notifications', icon: 'notifications-outline',       iconFilled: 'notifications',       label: 'Notifications'},
  { name: 'Packages',      icon: 'cube-outline',                iconFilled: 'cube',                label: 'Packages'     },
  { name: 'Subscriptions', icon: 'repeat-outline',              iconFilled: 'repeat',              label: 'Subscriptions'},
  { name: 'Booking',       icon: 'calendar-outline',            iconFilled: 'calendar',            label: 'Book Now'     },
  { name: 'My Bookings',   icon: 'list-outline',                iconFilled: 'list',                label: 'My Bookings'  },
  { name: 'Assistant',     icon: 'chatbubble-ellipses-outline', iconFilled: 'chatbubble-ellipses', label: 'AI Assistant' },
  { name: 'Profile',       icon: 'person-circle-outline',       iconFilled: 'person-circle',       label: 'Profile'      },
];

function resolveAvatarUrl(value) {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const origin = API_BASE_URL.endsWith('/api') ? API_BASE_URL.slice(0, -4) : API_BASE_URL;
  return `${origin}${value.startsWith('/') ? value : `/${value}`}`;
}

function AdminDrawerContent({ state, navigation }) {
  const { user, logout } = useAuth();
  const avatarUrl = resolveAvatarUrl(user?.profileImageUrl);
  const fullName  = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const initials  = (
    (user?.firstName?.[0] || 'A').toUpperCase() +
    (user?.lastName?.[0]  || '').toUpperCase()
  );

  return (
    <View style={d.root}>
      <View style={d.header}>
        <TouchableOpacity style={d.closeBtn} onPress={() => navigation.closeDrawer()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <View style={d.avatarRing}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={d.avatar} /> : (
            <View style={d.avatarFallback}><Text style={d.initials}>{initials}</Text></View>
          )}
        </View>
        <Text style={d.name} numberOfLines={1}>{fullName || 'Admin'}</Text>
        <Text style={d.email} numberOfLines={1}>{user?.email || ''}</Text>
        <View style={[d.statusBadge, { backgroundColor: 'rgba(200,169,107,0.12)', borderColor: 'rgba(200,169,107,0.22)' }]}>
          <View style={[d.statusDot, { backgroundColor: theme.colors.primary }]} />
          <Text style={[d.statusText, { color: theme.colors.primary }]}>Admin</Text>
        </View>
      </View>
      <View style={d.headerSep} />
      <DrawerContentScrollView style={d.scroll} contentContainerStyle={d.scrollInner} showsVerticalScrollIndicator={false}>
        <Text style={d.groupLabel}>Admin Panel</Text>
        {ADMIN_DRAWER_ITEMS.map((item) => {
          const focused = state.routeNames[state.index] === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[d.item, focused && d.itemActive]}
              onPress={() => { navigation.navigate(item.name); navigation.closeDrawer(); }}
              activeOpacity={0.6}
            >
              {focused && <View style={d.activeBar} />}
              <View style={[d.iconBox, focused && d.iconBoxActive]}>
                <Ionicons name={focused ? item.iconFilled : item.icon} size={18} color={focused ? theme.colors.primary : theme.colors.textMuted} />
              </View>
              <Text style={[d.itemLabel, focused && d.itemLabelActive]}>{item.label}</Text>
              {focused && <Ionicons name="chevron-forward" size={13} color={theme.colors.primary} style={{ opacity: 0.45 }} />}
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>
      <View style={d.footer}>
        <View style={d.footerSep} />
        <TouchableOpacity style={d.logoutBtn} onPress={() => { logout(); navigation.closeDrawer(); }} activeOpacity={0.65}>
          <View style={d.logoutIconBox}><Ionicons name="log-out-outline" size={16} color="#FCA5A5" /></View>
          <Text style={d.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AdminDrawer() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const count = await notificationsAPI.getUnreadCount();
        if (isMounted) setUnreadCount(Number(count || 0));
      } catch { if (isMounted) setUnreadCount(0); }
    };
    load();
    const interval  = setInterval(load, 30000);
    const appSub    = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    const unsubNotif = subscribeToNotifications(() => load());
    return () => {
      isMounted = false;
      clearInterval(interval);
      appSub.remove();
      unsubNotif();
    };
  }, []);

  return (
    <Drawer.Navigator
      drawerContent={(props) => <AdminDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerTransparent:       true,
        headerBlurEffect:        'dark',
        headerStyle:             { backgroundColor: 'transparent' },
        headerShadowVisible:     false,
        headerTintColor:         theme.colors.text,
        headerTitleStyle:        { fontWeight: '800', color: theme.colors.text, fontSize: 17 },
        headerLeft:              () => null,
        headerRight:             () => (
          <View style={d.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate('Admin Notifications')}
              style={d.headerIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
              {unreadCount > 0 && (
                <View style={d.headerBadge}>
                  <Text style={d.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.toggleDrawer()} style={d.hamburger} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="menu" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        ),
        drawerPosition:          'right',
        drawerStyle:             { backgroundColor: theme.colors.panel, width: Math.min(width * 0.8, 300) },
        drawerActiveTintColor:   theme.colors.primary,
        drawerInactiveTintColor: theme.colors.textMuted,
        swipeEdgeWidth:          40,
        sceneContainerStyle:     { backgroundColor: theme.colors.bg },
      })}
    >
      <Drawer.Screen name="Admin Home" component={AdminDashboardScreen} options={{ headerShown: false }} />
    </Drawer.Navigator>
  );
}

function CustomerDrawerContent({ state, navigation, unreadCount }) {
  const { user, logout } = useAuth();
  const avatarUrl = resolveAvatarUrl(user?.profileImageUrl);
  const fullName  = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const initials  = (
    (user?.firstName?.[0] || 'U').toUpperCase() +
    (user?.lastName?.[0]  || '').toUpperCase()
  );

  return (
    <View style={d.root}>
      <View style={d.header}>
        <TouchableOpacity
          style={d.closeBtn}
          onPress={() => navigation.closeDrawer()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <View style={d.avatarRing}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={d.avatar} />
          ) : (
            <View style={d.avatarFallback}>
              <Text style={d.initials}>{initials}</Text>
            </View>
          )}
        </View>
        <Text style={d.name} numberOfLines={1}>{fullName || 'User'}</Text>
        <Text style={d.email} numberOfLines={1}>{user?.email || ''}</Text>
        <View style={d.statusBadge}>
          <View style={d.statusDot} />
          <Text style={d.statusText}>Active</Text>
        </View>
      </View>

      <View style={d.headerSep} />

      <DrawerContentScrollView
        style={d.scroll}
        contentContainerStyle={d.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={d.groupLabel}>Navigation</Text>
        {DRAWER_ITEMS.map((item) => {
          const focused       = state.routeNames[state.index] === item.name;
          const hasNotifBadge = item.name === 'Notifications' && unreadCount > 0;
          return (
            <TouchableOpacity
              key={item.name}
              style={[d.item, focused && d.itemActive]}
              onPress={() => { navigation.navigate(item.name); navigation.closeDrawer(); }}
              activeOpacity={0.6}
            >
              {focused && <View style={d.activeBar} />}
              <View style={[d.iconBox, focused && d.iconBoxActive]}>
                <Ionicons
                  name={focused ? item.iconFilled : item.icon}
                  size={18}
                  color={focused ? theme.colors.primary : theme.colors.textMuted}
                />
              </View>
              <Text style={[d.itemLabel, focused && d.itemLabelActive]}>{item.label}</Text>
              {hasNotifBadge && (
                <View style={d.badge}>
                  <Text style={d.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
              {focused && !hasNotifBadge && (
                <Ionicons name="chevron-forward" size={13} color={theme.colors.primary} style={{ opacity: 0.45 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>

      <View style={d.footer}>
        <View style={d.footerSep} />
        <TouchableOpacity
          style={d.logoutBtn}
          onPress={() => { logout(); navigation.closeDrawer(); }}
          activeOpacity={0.65}
        >
          <View style={d.logoutIconBox}>
            <Ionicons name="log-out-outline" size={16} color="#FCA5A5" />
          </View>
          <Text style={d.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CustomerDrawer() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const count = await notificationsAPI.getUnreadCount();
        if (isMounted) setUnreadCount(Number(count || 0));
      } catch {
        if (isMounted) setUnreadCount(0);
      }
    };
    load();
    const interval   = setInterval(load, 30000);
    const appSub     = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    const unsubNotif = subscribeToNotifications(() => load());

    return () => {
      isMounted = false;
      clearInterval(interval);
      appSub.remove();
      unsubNotif();
    };
  }, []);

  return (
    <Drawer.Navigator
      drawerContent={(props) => (
        <CustomerDrawerContent {...props} unreadCount={unreadCount} />
      )}
      screenOptions={({ navigation }) => ({
        // ── Starts transparent, useScrollHeader fills it per screen ──
        headerTransparent:   true,
        headerBlurEffect:    'dark',
        headerStyle:         { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTintColor:     theme.colors.text,
        headerTitleStyle:    { fontWeight: '800', color: theme.colors.text, fontSize: 17 },
        headerLeft:          () => null,
        headerRight:         () => (
          <View style={d.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={d.headerIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
              {unreadCount > 0 && (
                <View style={d.headerBadge}>
                  <Text style={d.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.toggleDrawer()}
              style={d.hamburger}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="menu" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        ),
        drawerPosition:          'right',
        drawerStyle: {
          backgroundColor: theme.colors.panel,
          width: Math.min(width * 0.8, 300),
        },
        drawerActiveTintColor:   theme.colors.primary,
        drawerInactiveTintColor: theme.colors.textMuted,
        swipeEdgeWidth:          40,
        sceneContainerStyle:     { backgroundColor: theme.colors.bg },
      })}
    >
      <Drawer.Screen name="Home"          component={HomeScreen}          options={{ title: 'Home'         }} />
      <Drawer.Screen name="Packages"      component={PackagesScreen}      options={{ title: 'Packages'     }} />
      <Drawer.Screen name="Subscriptions" component={SubscriptionPlansScreen} options={{ title: 'Subscriptions' }} />
      <Drawer.Screen name="Booking"       component={BookingScreen}       options={{ title: 'Book Now'     }} />
      <Drawer.Screen name="My Bookings"   component={MyBookingsScreen}    options={{ title: 'My Bookings'  }} />
      <Drawer.Screen name="Assistant"     component={ChatbotScreen}       options={{ title: 'AI Assistant' }} />
      <Drawer.Screen name="Profile"       component={ProfileScreen}       options={{ title: 'Profile'      }} />
    </Drawer.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={SHARED_HEADER_OPTIONS}>
      <Stack.Screen name="Login"    component={LoginScreen}    options={{ headerShown: false }}       />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
    </Stack.Navigator>
  );
}

function CustomerStack() {
  return (
    <Stack.Navigator screenOptions={SHARED_HEADER_OPTIONS}>
      <Stack.Screen name="Main"                    component={CustomerDrawer}            options={{ headerShown: false }}     />
      <Stack.Screen name="Notifications"           component={NotificationsScreen}       options={{ title: 'Notifications', headerRight: () => null }} />
      <Stack.Screen name="Booking Confirmation"     component={BookingConfirmationScreen} options={{ title: 'Confirmation' }} />
      <Stack.Screen name="SubscriptionBooking"    component={SubscriptionBookingScreen}  options={{ title: 'Book Session' }} />
      <Stack.Screen name="MySubscription"         component={MySubscriptionScreen}       options={{ title: 'My Subscription' }} />
      <Stack.Screen name="SubscriptionCheckout"    component={SubscriptionCheckoutScreen} options={{ title: 'Checkout' }} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const count = await notificationsAPI.getUnreadCount();
        if (isMounted) setUnreadCount(Number(count || 0));
      } catch { if (isMounted) setUnreadCount(0); }
    };
    load();
    const interval = setInterval(load, 30000);
    const appSub   = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    let conn = null;
    startNotificationConnection()
      .then((c) => { if (!c) return; conn = c; c.on('ReceiveNotification', () => load()); })
      .catch(() => {});
    return () => {
      isMounted = false;
      clearInterval(interval);
      appSub.remove();
      if (conn) conn.off('ReceiveNotification');
    };
  }, []);

  return (
    <Stack.Navigator screenOptions={({ navigation }) => ({
      ...SHARED_HEADER_OPTIONS,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Admin Notifications')}
          style={d.headerIconBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
          {unreadCount > 0 && (
            <View style={d.headerBadge}>
              <Text style={d.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      ),
    })}>
      <Stack.Screen name="Main"                 component={AdminDrawer}               options={{ headerShown: false }}                                        />
      <Stack.Screen name="Create Booking"       component={BookingScreen}             options={{ title: 'Create Booking' }}                                   />
      <Stack.Screen name="Today Jobs"           component={AdminJobsScreen}           initialParams={{ mode: 'today' }} options={{ title: "Today's Jobs" }}   />
      <Stack.Screen name="All Jobs"             component={AdminJobsScreen}           initialParams={{ mode: 'all' }}   options={{ title: 'All Jobs' }}        />
      <Stack.Screen name="Booking Confirmation" component={BookingConfirmationScreen} options={{ title: 'Confirmation' }}                                      />
      <Stack.Screen name="Admin Notifications"  component={NotificationsScreen}       options={{ title: 'Notifications', headerRight: () => null }}            />
      <Stack.Screen name="Create Worker"        component={CreateWorkerScreen}        options={{ title: 'Create Worker' }}                                     />
      <Stack.Screen name="Worker Management"    component={WorkerManagementScreen}    options={{ title: 'Worker Management' }}                                 />
      <Stack.Screen name="Admin Products"      component={AdminProductsScreen}       options={{ title: 'Products' }}                                          />
      <Stack.Screen name="Admin Services"      component={AdminServicesScreen}       options={{ title: 'Services' }}                                          />
      <Stack.Screen name="Admin Packages"      component={AdminPackagesScreen}       options={{ title: 'Packages' }}                                          />
      <Stack.Screen name="Admin Offers"        component={AdminOffersScreen}         options={{ title: 'Offers & Discounts' }}                                />
      <Stack.Screen name="Admin Reports"       component={AdminReportsScreen}        options={{ title: 'Reports' }}                                           />
      <Stack.Screen name="Admin Subscriptions" component={AdminSubscriptionsScreen}  options={{ title: 'Subscriptions' }}                                     />
      <Stack.Screen name="System Settings"     component={AdminSystemSettingsScreen} options={{ title: 'System Settings' }}                                   />
    </Stack.Navigator>
  );
}

function WorkerStack() {
  return (
    <Stack.Navigator screenOptions={SHARED_HEADER_OPTIONS}>
      <Stack.Screen name="Today Work"     component={AdminJobsScreen}   initialParams={{ mode: 'today', roleMode: 'worker' }} options={{ headerShown: false }} />
      <Stack.Screen name="Worker Profile" component={ProfileScreen}     options={{ title: 'Profile'   }} />
      <Stack.Screen name="Sales Kit"      component={WorkerSalesScreen} options={{ title: 'Sales Kit' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator({ navigationRef }) {
  const { isAuthenticated, isAdmin, isWorker } = useAuth();
  return (
    <NavigationContainer theme={navTheme} ref={navigationRef}>
      {isAuthenticated
        ? isAdmin
          ? <AdminStack />
          : isWorker
            ? <WorkerStack />
            : <CustomerStack />
        : <AuthStack />}
    </NavigationContainer>
  );
}

const d = StyleSheet.create({
  root:    { flex: 1, backgroundColor: theme.colors.panel },
  header: {
    alignItems: 'center', paddingTop: 56,
    paddingBottom: 22, paddingHorizontal: 20, position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: 18, right: 16,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarRing: {
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 2, borderColor: theme.colors.primary,
    overflow: 'hidden', marginBottom: 12,
  },
  avatar:         { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1, backgroundColor: 'rgba(200,169,107,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  initials:  { color: theme.colors.primary, fontSize: 22, fontWeight: '800' },
  name:      { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  email:     { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 10 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
  },
  statusDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981' },
  statusText: { color: '#10B981', fontSize: 10, fontWeight: '700' },
  headerSep:  { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  scroll:      { flex: 1 },
  scrollInner: { paddingTop: 18, paddingBottom: 8 },
  groupLabel: {
    color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1.4,
    paddingHorizontal: 22, marginBottom: 8,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 10, paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 14, marginBottom: 2, position: 'relative', overflow: 'hidden',
  },
  itemActive:      { backgroundColor: 'rgba(200,169,107,0.11)' },
  activeBar: {
    position: 'absolute', left: 0, top: 9, bottom: 9,
    width: 3, borderRadius: 2, backgroundColor: theme.colors.primary,
  },
  iconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBoxActive:   { backgroundColor: 'rgba(200,169,107,0.18)' },
  itemLabel:       { flex: 1, color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  itemLabelActive: { color: '#fff', fontWeight: '700' },
  badge: {
    minWidth: 19, height: 19, borderRadius: 10, backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText:    { color: '#fff', fontSize: 10, fontWeight: '800' },
  footer:       { paddingBottom: 32 },
  footerSep:    { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 10 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 10, paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 14, backgroundColor: 'rgba(252,165,165,0.07)',
    borderWidth: 1, borderColor: 'rgba(252,165,165,0.14)',
  },
  logoutIconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(252,165,165,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { color: '#FCA5A5', fontWeight: '700', fontSize: 14 },
  hamburger: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(200,169,107,0.08)',
  },
  headerRight: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 14,
  },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(200,169,107,0.08)',
  },
  headerBadge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});