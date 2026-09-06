'use client';

import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, Sparkles, HelpCircle, AlertCircle, Loader2 } from 'lucide-react';

import { api } from '@/lib/api';

const WEB3FORMS_ACCESS_KEY =
  process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY || 'b9829b92-ee07-4020-9a2e-dae85955121f';

export function LandingContact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('General Inquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();

    if (!cleanName || !cleanEmail || !cleanMessage) return;

    setSubmitting(true);
    setErrorMessage(null);

    // 1. First Attempt: Backend API (Branded HTML + Student Auto-Responder)
    try {
      const result = await api.submitContact({
        name: cleanName,
        email: cleanEmail,
        topic,
        message: cleanMessage,
        platform: typeof window !== 'undefined' && (window as any).Capacitor ? 'Mobile App' : 'Web Client',
      });

      if (result && result.ok) {
        setSubmitted(true);
        setMessage('');
        setSubmitting(false);
        return;
      }
    } catch (backendErr) {
      console.warn('Backend contact route unreachable, falling back to Web3Forms...', backendErr);
    }

    // 2. Fallback: Web3Forms direct delivery
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          name: cleanName,
          email: cleanEmail,
          replyto: cleanEmail,
          subject: `[Aral.ai Contact] ${topic}: from ${cleanName}`,
          topic,
          message: cleanMessage,
          from_name: 'Aral.ai Contact Form',
          botcheck: '',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitted(true);
        setMessage('');
      } else {
        setErrorMessage(
          data.message || 'Unable to deliver message right now. Please try again or email us directly.'
        );
      }
    } catch {
      setErrorMessage(
        'A network connection error occurred while sending your message. Please verify your connection or email aral.ai.app@gmail.com directly.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-12 lg:py-16 bg-gradient-to-b from-surface-container-low/20 via-surface-container-low/40 to-surface-container-low/20 border-t border-border/50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-9">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider">
            <Mail className="w-3.5 h-3.5" />
            <span>Connect with Us</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Contact the Aral.ai Team
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Have a question, feedback, or need assistance? We’d love to hear from you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-start">
          {/* Left Column: Direct Contact Details & Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 sm:p-7 rounded-2xl bg-card border border-border shadow-notion-soft space-y-5">
              <h3 className="text-lg font-bold text-foreground">
                Get Direct Support
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Whether you’ve encountered an issue, have an idea for a feature, or want to share feedback, reach out directly.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Support & Inquiries Email</div>
                    <a
                      href="mailto:aral.ai.app@gmail.com"
                      className="text-sm font-bold text-foreground hover:text-primary transition-colors break-all"
                    >
                      aral.ai.app@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-sticker-purple/10 text-sticker-purple flex items-center justify-center shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Response Commitment</div>
                    <div className="text-xs font-semibold text-foreground">Within 24 business hours</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Student-First Mission</span>
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aral.ai is constantly evolving based on student feedback. If you suggest a feature that improves active recall for everyone, our team implements it rapidly.
              </p>
            </div>
          </div>

          {/* Right Column: Contact & Message Form */}
          <div className="lg:col-span-7">
            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-notion-soft">
              {submitted ? (
                <div className="py-12 text-center space-y-4 animate-in fade-in duration-300">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Message Sent Successfully!</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Thank you for reaching out. We&apos;ve received your message and sent a copy to our support inbox. A member of the Aral.ai team will follow up with you at <strong className="text-foreground">{email}</strong> shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setMessage('');
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    Send another note
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input type="checkbox" name="botcheck" className="hidden" style={{ display: 'none' }} />

                  <div>
                    <h3 className="text-lg font-bold text-foreground">Send Us a Direct Message</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submissions are routed directly to <span className="font-semibold text-foreground">aral.ai.app@gmail.com</span>.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed animate-in fade-in duration-200">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span>{errorMessage}</span>
                        <div className="mt-1">
                          <a
                            href="mailto:aral.ai.app@gmail.com"
                            className="underline font-semibold hover:opacity-80"
                          >
                            Send email directly to aral.ai.app@gmail.com &rarr;
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="contact-name" className="text-xs font-bold text-foreground">
                        Your Name
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        disabled={submitting}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Chen"
                        className="w-full text-xs sm:text-sm bg-surface-container-low px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground disabled:opacity-60"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="contact-email" className="text-xs font-bold text-foreground">
                        Email Address
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        disabled={submitting}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@university.edu"
                        className="w-full text-xs sm:text-sm bg-surface-container-low px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="contact-topic" className="text-xs font-bold text-foreground">
                      Inquiry Topic
                    </label>
                    <select
                      id="contact-topic"
                      value={topic}
                      disabled={submitting}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full text-xs sm:text-sm bg-surface-container-low px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground disabled:opacity-60"
                    >
                      <option value="General Inquiry">General Question</option>
                      <option value="Feature Suggestion">Feature Request / Feedback</option>
                      <option value="Technical Support">Technical Support / Bug Report</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="contact-message" className="text-xs font-bold text-foreground">
                      Your Message
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      required
                      disabled={submitting}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us how we can assist you..."
                      className="w-full text-xs sm:text-sm bg-surface-container-low px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground resize-none disabled:opacity-60"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending message to team…</span>
                      </>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

