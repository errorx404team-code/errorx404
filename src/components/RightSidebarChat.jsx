import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, X, Sparkles, MessageCircle } from 'lucide-react';

export default function RightSidebarChat({ isOpen, onClose, onOpen, activeRoutine, conversion }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      message_text: "Hi! I'm your AI Modernization Copilot powered by Gemini.\n\nAsk me anything about your MUMPS code, business rules, or the converted output.",
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim() || isLoading) return;

    const userText = inputQuestion.trim();
    setInputQuestion('');
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', message_text: userText }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userText, routine_id: activeRoutine?.id })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { id: data.id, role: 'assistant', message_text: data.message_text }]);
        if (!isOpen) setUnread(n => n + 1);
      } else {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', message_text: 'Sorry, something went wrong. Please try again.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', message_text: 'Backend unreachable — check the server is running.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'Explain the business rules in this routine',
    'What MUMPS globals are accessed?',
    'Summarise the converted code',
    'Are there any edge cases to watch?',
  ];

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={isOpen ? onClose : onOpen}
        aria-label="Toggle AI Copilot"
        style={{ bottom: '2rem', right: '1.5rem' }}
        className="fixed z-50 group"
      >
        {/* Outer pulse ring */}
        {!isOpen && (
          <span
            className="absolute inset-0 rounded-full bg-gh-purple opacity-30 animate-ping"
            style={{ animationDuration: '2.5s' }}
          />
        )}

        <div
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
            isOpen
              ? 'bg-gh-surface border-2 border-gh-border rotate-0 scale-95'
              : 'bg-gradient-to-br from-[#7c3aed] to-[#a855f7] hover:scale-110 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)]'
          }`}
        >
          {isOpen ? (
            <X size={20} className="text-gh-textMuted" strokeWidth={2} />
          ) : (
            <Sparkles size={22} className="text-white" strokeWidth={1.75} />
          )}

          {/* Unread badge */}
          {!isOpen && unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gh-red text-white text-[10px] font-bold flex items-center justify-center border-2 border-gh-bg">
              {unread}
            </span>
          )}
        </div>

        {/* Tooltip on hover (only when closed) */}
        {!isOpen && (
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1 bg-gh-canvas border border-gh-border text-gh-text text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-panel">
            AI Copilot
          </span>
        )}
      </button>

      {/* ── Chat panel ── */}
      {isOpen && (
        <div
          className="fixed z-40 flex flex-col bg-gh-canvas border border-gh-border rounded-2xl shadow-modal overflow-hidden"
          style={{
            bottom: '6.5rem',
            right: '1.5rem',
            width: '360px',
            height: '520px',
            animation: 'chatSlideUp 0.22s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gh-border flex items-center justify-between shrink-0"
               style={{ background: 'linear-gradient(135deg, #1a1035 0%, #161b22 100%)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7] flex items-center justify-center shadow-sm">
                <Sparkles size={15} className="text-white" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gh-text">AI Copilot</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gh-green" />
                  <p className="text-[10px] text-gh-textSubtle">Gemini · Live AI</p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-gh-textSubtle hover:text-gh-text transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Context strip */}
          {activeRoutine && (
            <div className="px-3 py-1.5 bg-gh-surface2 border-b border-gh-border text-[10px] font-mono flex items-center gap-1.5 shrink-0">
              <MessageCircle size={10} className="text-gh-accent shrink-0" />
              <span className="text-gh-textSubtle">Context:</span>
              <span className="text-gh-accent">{activeRoutine.name}.m</span>
              {conversion && (
                <span className="ml-auto text-gh-green flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-gh-green" />
                  converted
                </span>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#7c3aed]/20 to-[#a855f7]/20 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={12} className="text-purple-400" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-[11px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-gh-accentEmphasis text-white rounded-br-sm'
                      : 'bg-gh-surface border border-gh-border text-gh-text rounded-bl-sm whitespace-pre-wrap'
                  }`}
                >
                  {m.message_text}
                </div>
                {m.role === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-gh-surface border border-gh-border text-gh-textMuted flex items-center justify-center shrink-0 mt-0.5">
                    <User size={12} />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#7c3aed]/20 to-[#a855f7]/20 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-purple-400" />
                </div>
                <div className="bg-gh-surface border border-gh-border rounded-xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts — shown only on first load */}
          {messages.length <= 1 && !isLoading && (
            <div className="px-3 pb-2 grid grid-cols-2 gap-1.5 shrink-0">
              {quickPrompts.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInputQuestion(q); inputRef.current?.focus(); }}
                  className="text-left text-[10px] px-2.5 py-2 bg-gh-surface hover:bg-gh-surface2 border border-gh-border rounded-lg text-gh-textMuted hover:text-gh-text transition-colors leading-snug"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-gh-border bg-gh-bg flex gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputQuestion}
              onChange={e => setInputQuestion(e.target.value)}
              placeholder="Ask about this code…"
              className="flex-1 bg-gh-surface border border-gh-border rounded-xl px-3 py-2 text-xs text-gh-text focus:outline-none focus:border-gh-accent focus:ring-1 focus:ring-gh-accent/20 transition-all placeholder:text-gh-textSubtle"
            />
            <button
              type="submit"
              disabled={isLoading || !inputQuestion.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </>
  );
}
