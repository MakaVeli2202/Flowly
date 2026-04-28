import './src/i18n/i18n';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { StripeProvider } from '@stripe/stripe-react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PackagesProvider } from './src/context/PackagesContext';
import { FeaturesProvider } from './src/context/FeaturesContext';
import { SettingsProvider } from './src/context/SettingsContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import { theme } from './src/theme/theme';
import { configureForegroundNotifications, setupAndroidChannel } from './src/utils/pushNotifications';

// Configure foreground notification display (banner + sound)
configureForegroundNotifications();
// Ensure Android channel has sound + vibration before any notification arrives
setupAndroidChannel();

// ─── Loading splash ────────────────────────────────────────────────────────────
// Shown while AuthContext resolves the stored token on cold start.
// Matches the LoginScreen logo mark so the transition feels seamless.
function LoadingScreen() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={ls.root}>
      <View style={ls.logoRing}>
        <Ionicons name="water" size={28} color={theme.colors.primary} />
      </View>
      <Text style={ls.wordmark}>
        GetIt<Text style={ls.wordmarkAccent}>Cleaned</Text>
      </Text>
      <ActivityIndicator
        size="small"
        color={theme.colors.primary}
        style={ls.spinner}
      />
    </Animated.View>
  );
}

const ls = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
    gap: 14,
  },
  logoRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(200,169,107,0.12)',
    borderWidth: 2, borderColor: 'rgba(200,169,107,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  wordmark: {
    color: theme.colors.text,
    fontSize: 22, fontWeight: '900', letterSpacing: 0.3,
  },
  wordmarkAccent: { color: theme.colors.primary },
  spinner: { marginTop: 8 },
});

// ─── Root ──────────────────────────────────────────────────────────────────────

function Root() {
  const { loading, isAdmin, isWorker } = useAuth();
  const navigationRef = useRef(null);

  // Handle notification tap — deep-link to the relevant screen
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data      = response.notification.request.content.data;
      const type      = data?.type ?? null;
      const bookingId = data?.bookingId ?? null;
      const nav       = navigationRef.current;
      if (!nav) return;

      if (isAdmin) {
        nav.navigate('All Jobs', bookingId ? { openBookingId: bookingId } : {});
      } else if (isWorker) {
        nav.navigate('Today Work', bookingId ? { openBookingId: bookingId } : {});
      } else {
        // Loyalty reward notifications go straight to My Bookings (rewards tab)
        if (type === 'LoyaltyReward') {
          nav.navigate('Main', { screen: 'My Bookings' });
        } else {
          nav.navigate('Main', {
            screen: 'My Bookings',
            params: bookingId ? { openBookingId: bookingId } : {},
          });
        }
      }
    });
    return () => sub.remove();
  }, [isAdmin, isWorker]);

  if (loading) return <LoadingScreen />;
  return <AppNavigator navigationRef={navigationRef} />;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {/*
          StripeProvider must wrap everything that may call useStripe().
          publishableKey is '' when EXPO_PUBLIC_STRIPE_KEY is not set — safe,
          because the payments feature flag defaults to false and no Stripe
          methods are called until the flag is explicitly enabled.
        */}
        <StripeProvider
          publishableKey={process.env.EXPO_PUBLIC_STRIPE_KEY ?? ''}
          merchantIdentifier="merchant.com.glanz"
          urlScheme="glanz"
        >
          <ErrorBoundary>
            <AuthProvider>
              <FeaturesProvider>
                <SettingsProvider>
                  <PackagesProvider>
                    <Root />
                  </PackagesProvider>
                </SettingsProvider>
              </FeaturesProvider>
            </AuthProvider>
          </ErrorBoundary>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}