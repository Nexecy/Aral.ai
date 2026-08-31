'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  Send
} from 'lucide-react';
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

/**
 * A request routed from the document viewer's selection menu.
 * `append` stages the excerpt in the composer; `send` fires it immediately.
 */
export interface TutorContextRequest {
  /** Nonce so repeating the same excerpt still triggers an update. */
  id: number;
  text: string;
  mode: 'append' | 'send';
}

interface WorkspaceChatPanelProps {
  sessionId: string;
  documentTitle: string;
  initialMessages: ChatMessage[];
  contextRequest?: TutorContextRequest | null;
  onClearContextRequest?: () => void;
  /** Increment to pull keyboard focus into the composer. */
  focusToken?: number;
  onMessagesChange?: (messages: ChatMessage[]) => void;
  onDetach?: () => void;
  /** Fills the available height instead of using its own fixed height. */
  fill?: boolean;
  /** Rendered under the composer — used for the docked resize grip. */
  footerSlot?: React.ReactNode;
}

const SUGGESTED_PROMPTS = [
  'Explain the core mechanism in simple terms',
  'Generate a memorable mnemonic for key terms',
  'What is the difference between active recall and passive review?',
  'Summarize this material for a 5-minute pre-exam cram'
];

export function WorkspaceChatPanel({
  sessionId,
  documentTitle,
  initialMessages,
  contextRequest,
  onClearContextRequest,
  focusToken,
  onMessagesChange,
  onDetach,
  fill = false,
  footerSlot
}: WorkspaceChatPanelProps) {
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
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scaleStyle = useMemo(
    () => chatScaleVars(getChatTypeScale(fontSize)),
    [fontSize]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const onMessagesChangeRef = useRef(onMessagesChange);
  onMessagesChangeRef.current = onMessagesChange;
  useEffect(() => {
    onMessagesChangeRef.current?.(messages);
  }, [messages]);

  useEffect(() => {
    if (focusToken === undefined) return;
    inputRef.current?.focus();
  }, [focusToken]);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const message = (textToSend ?? inputMessage).trim();
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

  // Excerpts routed in from the document viewer's selection menu.
  const sendRef = useRef(handleSendMessage);
  sendRef.current = handleSendMessage;
  useEffect(() => {
    const request = contextRequest;
    if (!request || !request.text.trim()) return;

    if (request.mode === 'send') {
      void sendRef.current(
        `Explain this concept from ${documentTitle} in clear, exam-ready terms:\n\n"${request.text}"`
      );
    } else {
      setInputMessage((prev) => {
        const tag = `@context "${request.text}"`;
        return prev.trim() ? `${prev.trim()} ${tag} ` : `${tag} `;
      });
      inputRef.current?.focus();
    }

    onClearContextRequest?.();
    // Keyed on the nonce so the same excerpt can be routed twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextRequest?.id]);

  return (
    <div
      style={scaleStyle}
      className={`bg-surface-container-lowest border border-outline-variant rounded-3xl shadow-notebook-subtle flex flex-col overflow-hidden ${
        fill ? 'h-full' : 'h-[380px] lg:h-[400px]'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-outline-variant flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-xs sm:text-sm text-on-surface truncate">
                AI Tutor Assistant
              </h4>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" title="Connected" />
            </div>
            <div className="text-[10px] text-on-surface-variant flex items-center gap-1 font-medium">
              <FileText className="w-2.5 h-2.5 text-primary shrink-0" />
              <span className="truncate max-w-[180px]">Context: {documentTitle}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <ChatFontSizeMenu value={fontSize} onChange={setFontSize} />
          {onDetach && (
            <button
              onClick={onDetach}
              title="Pop out AI Tutor into a floating window"
              aria-label="Pop out AI Tutor"
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 select-text custom-scrollbar"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="text-center py-6 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center shadow-sm">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h5 className="font-bold text-xs sm:text-sm text-on-surface">
              Ask anything about your document
            </h5>
            <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
              Ask for explanations, exam questions, or custom concept breakdowns.
            </p>
          </div>
        )}

        <ChatMessageList messages={messages} scrollRef={scrollRef}>
          {isStreaming && streamingContent && (
            <div className="flex items-start gap-2.5 justify-start">
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-xs p-3.5 bg-surface-container-low text-on-surface border border-primary/30 shadow-notebook-subtle">
                <Markdown source={streamingContent} variant="chat" />
                <div
                  className="flex items-center gap-1 text-primary font-mono animate-pulse pt-1.5"
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

      {/* Suggested prompts */}
      <div className="px-4 py-2 bg-surface-container-low border-t border-outline-variant flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSendMessage(prompt)}
            disabled={isStreaming || !aiAllowed}
            className="px-3 py-1 rounded-full bg-surface-container hover:bg-surface-container-highest border border-outline-variant/60 text-[11px] text-on-surface font-medium whitespace-nowrap transition-colors shrink-0 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-outline-variant shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                e.currentTarget.blur();
              }
            }}
            placeholder={aiAllowed ? 'Ask AI tutor anything about the document...' : aiLockMessage}
            disabled={isStreaming || !aiAllowed}
            aria-label="Message the AI tutor"
            className="flex-1 text-xs bg-surface-container-low px-4 py-2.5 rounded-xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-on-surface placeholder:text-outline"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim() || isStreaming || !aiAllowed}
            aria-label="Send message"
            className="p-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {footerSlot}
    </div>
  );
}
