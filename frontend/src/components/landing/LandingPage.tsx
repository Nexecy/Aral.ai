'use client';

import React from 'react';
import { LandingNavbar } from './LandingNavbar';
import { LandingHero } from './LandingHero';
import { LandingPurpose } from './LandingPurpose';
import { LandingFeatures } from './LandingFeatures';
import { LandingWorkflow } from './LandingWorkflow';
import { LandingFAQ } from './LandingFAQ';
import { LandingContact } from './LandingContact';
import { LandingFooter } from './LandingFooter';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-primary/20">
      <LandingNavbar />
      <main className="flex-1">
        <LandingHero />
        <LandingPurpose />
        <LandingFeatures />
        <LandingWorkflow />
        <LandingFAQ />
        <LandingContact />
      </main>
      <LandingFooter />
    </div>
  );
}
