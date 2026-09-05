'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

export function LandingFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      question: 'What file formats does Aral.ai support?',
      answer:
        'Aral.ai supports PDFs, Microsoft Word (.docx), PowerPoint slide decks (.pptx / PDF exports), EPUB textbooks, and plain text files (.txt). Our document ingestion engine parses formulas, tables, and structured headers automatically.',
    },
    {
      question: 'How does Aral.ai ensure the AI does not hallucinate?',
      answer:
        'Unlike general chatbots that guess when they do not know the answer, Aral.ai uses strict document-grounded retrieval. Every concept explanation, flashcard, and quiz question is anchored to your specific course text with exact page and slide citations.',
    },
    {
      question: 'Is Aral.ai free for students?',
      answer:
        'Yes! We offer a generous free tier for students, researchers, and learners that includes document parsing, automated active recall flashcards, diagnostic mock quizzes, and the Pomodoro focus timer. No credit card is required to sign up.',
    },
    {
      question: 'How do active recall flashcards work in Aral.ai?',
      answer:
        'Instead of simple keyword definitions, Aral.ai extracts core principles, high-yield exam traps, and conceptual relationships into flashcards. It implements spaced repetition intervals (Hard, Good, Easy) so you review questions right before you are likely to forget them.',
    },
    {
      question: 'Can I export my notes and study decks?',
      answer:
        'Yes. You can export your synthesized notes in Markdown, copy flashcard decks, or print your quiz diagnostic breakdowns for offline study and group review.',
    },
    {
      question: 'How is my academic data and privacy protected?',
      answer:
        'Your uploaded documents, quizzes, and personal notes are private to your account. All data is encrypted in transit and at rest using enterprise-grade encryption, and we never sell your academic materials to third-party data brokers.',
    },
  ];

  return (
    <section id="faq" className="py-20 lg:py-28 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Everything you need to know about Aral.ai, our active recall methodology, and document security.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-border bg-card overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-bold text-foreground">
                    {faq.question}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-primary bg-primary/10' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/50 animate-in fade-in duration-200">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still have questions? */}
        <div className="mt-12 text-center text-xs text-muted-foreground">
          Still have a question?{' '}
          <a href="#contact" className="font-bold text-primary hover:underline">
            Reach out to our team
          </a>
          {' '}and we’ll be glad to help!
        </div>
      </div>
    </section>
  );
}
