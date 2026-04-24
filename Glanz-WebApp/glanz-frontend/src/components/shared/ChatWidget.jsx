/**
 * [MOCK] ChatWidget — AI-powered floating chat assistant.
 * Connects to POST /api/Chatbot/chat.
 * When the backend has a real Anthropic API key configured, replies are AI-generated.
 * Without a key it returns canned FAQ answers (free, no API cost).
 * TODO: Replace "YOUR_ANTHROPIC_API_KEY_HERE" in appsettings.json with a real key to enable AI mode.
 */
import React, { useState, useRef, useEffect } from 'react';
import { chatbotAPI } from '../../api/chatbot';

const WELCOME = "Hi! I'm the Glanz assistant. Ask me about services, pricing, booking, or cancellations.";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'bot', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const data = await chatbotAPI.sendMessage(text);
      setMessages((prev) => [...prev, { role: 'bot', text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'bot', text: 'Sorry, I could not process your request right now. Please try again or contact support@glanz.qa.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        aria-label="Open chat assistant"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 left-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-xl hover:bg-primary/90 transition-all"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 left-6 z-40 w-80 sm:w-96 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{ height: 460, background: 'var(--surface-bg)', border: '1px solid var(--border-color)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary text-white">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white text-xs font-bold">AI</div>
            <div>
              <p className="font-bold text-sm leading-tight">Glanz Assistant</p>
              <p className="text-xs text-white/70">Usually replies instantly</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ background: 'var(--surface-bg)' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'rounded-bl-sm'
                  }`}
                  style={msg.role !== 'user' ? {
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-color)',
                  } : {}}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm px-4 py-2 flex gap-1 items-center"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--muted-color)', animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--muted-color)', animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--muted-color)', animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: 'var(--border-color)', background: 'var(--surface-bg)' }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question…"
              disabled={loading}
              className="flex-1 px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)',
              }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-white hover:bg-primary/90 transition disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
