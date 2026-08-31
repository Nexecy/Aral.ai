'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Lightbulb, Loader2, Send } from 'lucide-react';
import { ChatMessage } from '@/lib/types';
import { api } from '@/lib/api';
import { Markdown } from '@/lib/markdown';
import { ChatMessageList } from '@/components/study/ChatMessageList';
import { ChatFontSizeMenu } from '@/components/study/ChatFontSizeMenu';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { useEmailGate } from '@/context/AuthContext';
import {
  CHAT_FONT_SIZE_STORAGE_KEY,
  ChatFontSize,
  chatScaleVars,
  getChatTypeScale,
  isChatFontSize
} from '@/lib/chatPreferences';

interface RealtimeChatPanelProps {
  sessionId: string;
  initialMessages: ChatMessage[];
  onNoteActionTriggered?: (actionData: unknown) => void;
}

const SUGGESTED_PROMPTS = [
  'Explain the core mechanism in simple terms',
  'Generate a memorable mnemonic for key terms',
  'What is the difference between active recall and passive review?',
  'Summarize this material for a 5-minute pre-exam cram'
];

export function RealtimeChatPanel({
  sessionId,
  initialMessages
}: RealtimeChatPanelProps) {
  const { allowed: aiAllowed, message: aiLockMessage } = useEmailGate();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>('');

  const [fontSize, setFontSize] = useLocalStorageState<ChatFontSize>(
    CHAT_FONT_SIZE_STORAGE_KEY,
    'default',
    (raw) => (isChatFontSize(raw) ? raw : null)
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scaleStyle = useMemo(
    () => chatScaleVars(getChatTypeScale(fontSize)),
    [fontSize]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const message = (textToSend || inputMessage).trim();
      if (!message || isStreaming || !aiAllowed) return;

      setInputMessage('');

      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        session_id: sessionId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, userMsg]);

      setIsStreaming(true);
      setStreamingContent('');

      await api.streamChat(
        sessionId,
        message,
        (token: string) => setStreamingContent((prev) => prev + token),
        (completedMsg: ChatMessage) => {
          setMessages((prev) => [...prev, completedMsg]);
          setStreamingContent('');
          setIsStreaming(false);
        },
        (err: unknown) => {
          console.error('SSE Chat Error:', err);
          setIsStreaming(false);
        }
      );
    },
    [inputMessage, isStreaming, sessionId, aiAllowed]
  );

  return (
    <div
      style={scaleStyle}
      className="flex flex-col h-[650px] bg-card border border-border rounded-2xl shadow-notion-soft overflow-hidden"
    >
      <div className="p-4 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-foreground truncate">
                Aral AI Real-Time Study Tutor
              </h3>
              <span className="w-2 h-2 rounded-full bg-sticker-green animate-pulse shrink-0" title="Connected" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Trained on your current study session notes & document
            </p>
          </div>
        </div>
        <ChatFontSizeMenu value={fontSize} onChange={setFontSize} />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Lightbulb className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-foreground">Ask anything about your study material</h4>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Clarify confusing sections, test your understanding, or ask for custom practice questions.
            </p>
          </div>
        )}

        <ChatMessageList messages={messages} scrollRef={scrollRef}>
          {isStreaming && streamingContent && (
            <div className="flex items-start gap-2.5 justify-start">
              <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tl-xs p-4 bg-surface-container-low text-foreground border border-primary/30 shadow-notion-soft">
                <Markdown source={streamingContent} variant="chat" />
                <div className="flex items-center gap-1 text-primary font-mono animate-pulse mt-2"
                  style={{ fontSize: 'var(--chat-meta)' }}
                >
                  <span>Streaming response...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </ChatMessageList>
      </div>

      <div className="px-4 py-2 bg-surface-container-low border-t border-border flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-bold text-muted-foreground shrink-0 uppercase tracking-wider">
          Suggested:
        </span>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => void handleSendMessage(prompt)}
            disabled={isStreaming || !aiAllowed}
            className="px-2.5 py-1 rounded-full bg-card hover:bg-muted border border-border text-[11px] text-foreground font-medium whitespace-nowrap transition-colors shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="p-3 bg-card border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={aiAllowed ? 'Ask a question or request a note summary...' : aiLockMessage}
            disabled={isStreaming || !aiAllowed}
            className="flex-1 text-xs bg-surface-container-low p-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim() || isStreaming || !aiAllowed}
            className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary-active disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
