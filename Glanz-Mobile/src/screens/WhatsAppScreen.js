import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { theme } from '../theme/theme';
import { API_BASE_URL } from '../config/api';
import apiClient from '../api/apiClient';

const G = (a) => `rgba(200,169,107,${a})`;

export default function WhatsAppScreen({ navigation }) {
  const headerHeight = useHeaderHeight();
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWhatsAppNumber();
  }, []);

  const fetchWhatsAppNumber = async () => {
    try {
      const response = await apiClient.get('/public/whatsapp-business');
      if (response.data?.whatsappBusinessNumber) {
        // Clean the number - remove any non-numeric characters except +
        const cleanNumber = response.data.whatsappBusinessNumber.replace(/[^\d+]/g, '');
        setWhatsappNumber(cleanNumber);
      }
    } catch (error) {
      console.log('Error fetching WhatsApp number:', error);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = async () => {
    if (!whatsappNumber) return;

    // Format: https://wa.me/NUMBER?text=MESSAGE
    const message = encodeURIComponent('Hello! I need help with my car cleaning booking.');
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to regular URL if WhatsApp not installed
        const webUrl = `https://web.whatsapp.com/send?phone=${whatsappNumber}&text=${message}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.log('Error opening WhatsApp:', error);
    }
  };

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: headerHeight }]}>
      <LinearGradient
        colors={['transparent', G(0.3), 'transparent']}
        style={s.gradient}
      />

      <View style={s.content}>
        <View style={s.iconContainer}>
          <Ionicons name="logo-whatsapp" size={80} color="#25D366" />
        </View>

        <Text style={s.title}>Contact Us on WhatsApp</Text>
        <Text style={s.subtitle}>
          Get instant support for your booking questions
        </Text>

        {!whatsappNumber ? (
          <View style={s.noNumberContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.colors.textMuted} />
            <Text style={s.noNumberText}>
              WhatsApp support is not configured yet.{'\n'}
              Please check back later or call us directly.
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={s.button} onPress={openWhatsApp} activeOpacity={0.8}>
            <LinearGradient
              colors={['#25D366', '#20BD5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.buttonGradient}
            >
              <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
              <Text style={s.buttonText}>Open WhatsApp</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={s.infoBox}>
          <Text style={s.infoTitle}>Quick Help Available:</Text>
          <Text style={s.infoText}>• Book a new cleaning appointment</Text>
          <Text style={s.infoText}>• Modify or cancel existing bookings</Text>
          <Text style={s.infoText}>• Questions about our packages</Text>
          <Text style={s.infoText}>• Subscription inquiries</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 30,
  },
  noNumberContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noNumberText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  button: {
    marginBottom: 30,
    borderRadius: 30,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  infoBox: {
    backgroundColor: theme.colors.panel,
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
});