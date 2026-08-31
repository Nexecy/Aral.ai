import type { Metadata } from 'next';
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { PomodoroProvider } from '@/context/PomodoroContext';
import { AppShell } from '@/components/layout/AppShell';
import { ThemePreferencesSync } from '@/components/layout/ThemePreferencesSync';
import { BRAND_LOGO_FALLBACK, BRAND_LOGO_URL } from '@/lib/brand';

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-hanken',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-jetbrains',
});

function apiOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

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
  const origin = apiOrigin();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`overflow-x-hidden ${hanken.variable} ${jetbrains.variable}`}
    >
      <head>
        {origin ? <link rel="preconnect" href={origin} /> : null}
      </head>
      <body className={`${hanken.className} font-sans min-h-screen bg-background text-foreground antialiased`}>
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
