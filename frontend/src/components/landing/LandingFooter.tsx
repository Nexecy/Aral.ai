'use client';

import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Heart, Sparkles, Mail } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card/60 backdrop-blur-sm text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
          {/* Brand Info */}
          <div className="md:col-span-5 space-y-4">
            <Link href="/" className="inline-block focus:outline-none">
              <BrandLogo size={36} wordmarkClassName="text-xl font-extrabold" />
            </Link>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
              Aral.ai is the intelligent study assistant for extracting structured notes, active recall flashcards, and diagnostic mock exams from documents with real-time grounded AI tutoring and Pomodoro focus.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
              <span>Engineered with passion for high-performance learning.</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {/* Product Column */}
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                Product
              </div>
              <ul className="space-y-2 text-xs font-medium text-muted-foreground">
                <li>
                  <a href="#purpose" className="hover:text-foreground transition-colors">
                    Purpose & Science
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-foreground transition-colors">
                    Core Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-foreground transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-foreground transition-colors">
                    Frequently Asked
                  </a>
                </li>
              </ul>
            </div>

            {/* Platform & Auth */}
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                Get Started
              </div>
              <ul className="space-y-2 text-xs font-medium text-muted-foreground">
                <li>
                  <Link href="/login/" className="hover:text-foreground transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/signup/" className="hover:text-foreground transition-colors">
                    Create Free Account
                  </Link>
                </li>
                <li>
                  <Link href="/forgot-password/" className="hover:text-foreground transition-colors">
                    Reset Password
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal & Contact */}
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                Legal & Support
              </div>
              <ul className="space-y-2 text-xs font-medium text-muted-foreground">
                <li>
                  <Link href="/privacy/" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms/" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <a href="#contact" className="hover:text-foreground transition-colors">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="mailto:aral.ai.app@gmail.com" className="hover:text-foreground transition-colors">
                    aral.ai.app@gmail.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Strip */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            © {new Date().getFullYear()} Aral.ai. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy/" className="hover:underline">
              Privacy Disclosures
            </Link>
            <Link href="/terms/" className="hover:underline">
              Terms & Conditions
            </Link>
            <a href="#contact" className="hover:underline">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
