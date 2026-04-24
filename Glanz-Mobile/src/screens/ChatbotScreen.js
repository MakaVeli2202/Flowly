/**
 * [MOCK] ChatbotScreen — AI assistant for Glanz mobile app.
 * Connects to POST /api/Chatbot/chat on the backend.
 * When Anthropic:ApiKey is set in appsettings.json, replies are AI-generated (claude-haiku-4-5).
 * Without a key it returns canned FAQ answers — free, no API cost.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { chatbotAPI } from '../api/chatbot';
import { theme } from '../theme/theme';

const WELCOME = "Hi! I'm the Glanz assistant 👋\nAsk me about services, pricing, booking steps, or cancellations.";

const QUICK_PROMPTS = [
  { icon: 'sparkles-outline',   label: 'Services offered'    },
  { icon: 'cash-outline',       label: 'Pricing info'        },
  { icon: 'close-circle-outline',label: 'Cancel a booking'  },
  { icon: 'calendar-outline',   label: 'How to reschedule'   },
];

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <View style={s.typingWrap}>
      <ActivityIndicator size="small" color={theme.colors.primary} style={{ transform: [{ scale: 0.7 }] }} />
      <Text style={s.typingText}>Assistant is typing…</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChatbotScreen() {
  const headerHeight = useHeaderHeight();
  const [messages, setMessages] = useState([{ role: 'bot', text: WELCOME, id: 0 }]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    const userMsg = { role: 'user', text: msg, id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const data = await chatbotAPI.sendMessage(msg);
      setMessages((prev) => [...prev, { role: 'bot', text: data.reply, id: Date.now() + 1 }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'bot',
        text: "Sorry, I couldn't process that. Please try again or contact support@glanz.qa.",
        id: Date.now() + 1,
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const showQuickPrompts = messages.length <= 1 && !loading;

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight + (Platform.OS === 'ios' ? 16 : 0)}
    >

      {/* ── Message list ───────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingTop: headerHeight + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >

        {/* Assistant identity strip — shown at top */}
        <Animated.View entering={FadeIn.duration(400)} style={s.identityStrip}>
          <View style={s.identityAvatar}>
            <Ionicons name="chatbubble-ellipses" size={18} color={theme.colors.ink} />
          </View>
          <View>
            <Text style={s.identityName}>AI Assistant</Text>
            <Text style={s.identityTagline}>Glanz · Powered by Claude</Text>
          </View>
          <View style={s.onlineDot} />
        </Animated.View>

        {/* Messages */}
        {messages.map((msg, i) => (
          <Animated.View
            key={msg.id}
            entering={FadeInUp.duration(280).delay(i === 0 ? 0 : 40)}
            style={[s.row, msg.role === 'user' ? s.rowUser : s.rowBot]}
          >
            {/* Bot avatar */}
            {msg.role === 'bot' && (
              <View style={s.botAvatar}>
                <Ionicons name="chatbubble-ellipses" size={14} color={theme.colors.ink} />
              </View>
            )}

            {/* Bubble */}
            <View style={[
              s.bubble,
              msg.role === 'user' ? s.bubbleUser : s.bubbleBot,
              msg.isError && s.bubbleError,
            ]}>
              <Text style={[s.bubbleText, msg.role === 'user' ? s.bubbleTextUser : s.bubbleTextBot]}>
                {msg.text}
              </Text>
            </View>
          </Animated.View>
        ))}

        {/* Typing indicator */}
        {loading && (
          <Animated.View entering={FadeIn.duration(200)} style={[s.row, s.rowBot]}>
            <View style={s.botAvatar}>
              <Ionicons name="chatbubble-ellipses" size={14} color={theme.colors.ink} />
            </View>
            <View style={[s.bubble, s.bubbleBot]}>
              <TypingDots />
            </View>
          </Animated.View>
        )}

      </ScrollView>

      {/* ── Quick prompts ───────────────────────────────────────── */}
      {showQuickPrompts && (
        <Animated.View entering={FadeInUp.duration(350).delay(200)} style={s.quickSection}>
          <Text style={s.quickLabel}>Quick questions</Text>
          <View style={s.quickGrid}>
            {QUICK_PROMPTS.map((q) => (
              <TouchableOpacity
                key={q.label}
                style={s.quickChip}
                onPress={() => sendMessage(q.label)}
                activeOpacity={0.7}
              >
                <Ionicons name={q.icon} size={14} color={theme.colors.primary} />
                <Text style={s.quickChipText}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* ── Input bar ──────────────────────────────────────────── */}
      <View style={s.inputBar}>
        <TextInput
          ref={inputRef}
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question…"
          placeholderTextColor={theme.colors.textMuted}
          editable={!loading}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage()}
          multiline
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up" size={18} color={theme.colors.ink} />
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 12 },

  // Identity strip
  identityStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 16, backgroundColor: 'rgba(19,27,37,0.8)',
    padding: 12, marginBottom: 18, position: 'relative',
  },
  identityAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  identityName:    { color: theme.colors.text, fontWeight: '800', fontSize: 14 },
  identityTagline: { color: theme.colors.textMuted, fontSize: 11, marginTop: 1 },
  onlineDot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1.5, borderColor: theme.colors.bg,
  },

  // Message rows
  row:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  rowUser: { justifyContent: 'flex-end' },
  rowBot:  { justifyContent: 'flex-start' },

  // Bot avatar
  botAvatar: {
    width: 30, height: 30, borderRadius: 15, flexShrink: 0,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  // Bubbles
  bubble: {
    maxWidth: '78%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: 'rgba(19,27,37,0.9)',
    borderWidth: 1, borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleError: {
    borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(42,10,10,0.8)',
  },
  bubbleText:     { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: theme.colors.ink },
  bubbleTextBot:  { color: theme.colors.text },

  // Typing indicator
  typingWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  typingText: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic' },

  // Quick prompts
  quickSection: { paddingHorizontal: 16, paddingBottom: 10 },
  quickLabel: {
    color: theme.colors.textMuted, fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  quickGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(200,169,107,0.25)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(200,169,107,0.06)',
  },
  quickChipText: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    backgroundColor: 'rgba(13,17,23,0.95)',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    color: theme.colors.text, backgroundColor: theme.colors.inputBg,
    fontSize: 14, maxHeight: 110, lineHeight: 20,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, flexShrink: 0,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
});