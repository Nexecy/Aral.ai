import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { PomodoroProvider } from '@/context/PomodoroContext';
import { AppShell } from '@/components/layout/AppShell';
import { ThemePreferencesSync } from '@/components/layout/ThemePreferencesSync';
import { BRAND_LOGO_FALLBACK, BRAND_LOGO_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Aral.ai — Cross-Platform AI Study Application',
  description: 'Aral.ai is an intelligent study assistant for extracting structured notes, active recall flashcards, and interactive quizzes from documents with real-time AI tutoring and Pomodoro focus.',
  icons: {
    icon: [
      { url: BRAND_LOGO_URL, type: 'image/svg+xml' },
      { url: BRAND_LOGO_FALLBACK, type: 'image/svg+xml' },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <AuthProvider>
            <ThemePreferencesSync />
            <NotificationProvider>
              <PomodoroProvider>
                <AppShell>
                  {children}
                </AppShell>
              </PomodoroProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
