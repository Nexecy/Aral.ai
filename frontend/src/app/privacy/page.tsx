import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <BrandLogo href="/" align="left" size={40} wordmarkClassName="text-xl font-extrabold" />
        
        <div className="p-6 sm:p-10 rounded-3xl bg-card border border-border shadow-notion-soft space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy & Data Deletion</h1>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">Last updated September 4, 2026</p>
          </div>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-2.5">
              <h2 className="text-base font-bold text-foreground">1. Overview</h2>
              <p>
                Aral.ai (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;) is committed to protecting your privacy. This policy explains what information we collect when you use our AI study companion, how we use it, and how you can manage or request the deletion of your personal data.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-base font-bold text-foreground">2. Information We Collect</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Account Information:</strong> When you sign up via Email, Google OAuth, or Facebook Login, we collect your email address, display name, and avatar URL provided by the identity provider.</li>
                <li><strong className="text-foreground">Study Materials & Notes:</strong> Documents (PDFs, images, text files) you upload for AI summary, quiz generation, and chat tutoring.</li>
                <li><strong className="text-foreground">Activity & Focus Metrics:</strong> Pomodoro timer sessions, flashcard review history, quiz scores, and study streak counters.</li>
                <li><strong className="text-foreground">Technical Data:</strong> Essential session cookies and security tokens to keep you logged in safely.</li>
              </ul>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-base font-bold text-foreground">3. How We Use Your Data</h2>
              <p>
                We use your data solely to provide, personalize, and improve your study experience:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Extracting study notes, flashcards, and interactive quizzes from your uploaded course materials.</li>
                <li>Powering your personalized AI study tutor conversations.</li>
                <li>Synchronizing your study progress across devices.</li>
                <li>Preventing abuse and enforcing rate limits.</li>
              </ul>
              <p className="text-xs italic bg-accent/40 p-3 rounded-xl border border-border">
                Note: We do not sell your personal data or uploaded academic materials to third parties or data brokers.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-base font-bold text-foreground">4. Third-Party Services</h2>
              <p>
                We integrate with trusted providers strictly for authentication, database hosting, and AI generation:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Supabase:</strong> Secure PostgreSQL database, user authentication, and file storage.</li>
                <li><strong className="text-foreground">Google &amp; Meta / Facebook:</strong> Optional 1-click social sign-in.</li>
                <li><strong className="text-foreground">Groq &amp; Google Gemini:</strong> AI processing for study materials.</li>
              </ul>
            </section>

            <section id="data-deletion" className="space-y-3 pt-4 border-t border-border">
              <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <span>5. User Data Deletion Instructions</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Compliance
                </span>
              </h2>
              <p>
                According to Meta/Facebook Platform rules and international data protection laws (GDPR/Data Privacy Act), you have the right to request the deletion of all your personal data and account records stored on Aral.ai.
              </p>

              <div className="bg-muted/40 p-4 rounded-2xl border border-border space-y-3">
                <h3 className="text-sm font-bold text-foreground">Option A: Automatic In-App Deletion</h3>
                <ol className="list-decimal pl-5 space-y-1 text-xs sm:text-sm">
                  <li>Log in to your account at <Link href="/login" className="text-primary hover:underline">aral-ai-three.vercel.app</Link>.</li>
                  <li>Navigate to <strong>Settings</strong> ➔ <strong>Account</strong>.</li>
                  <li>Click <strong>Delete Account &amp; Data</strong> to immediately purge your uploaded files, flashcards, quizzes, and profile.</li>
                </ol>
              </div>

              <div className="bg-muted/40 p-4 rounded-2xl border border-border space-y-3">
                <h3 className="text-sm font-bold text-foreground">Option B: Remove Facebook Login App &amp; Data</h3>
                <ol className="list-decimal pl-5 space-y-1 text-xs sm:text-sm">
                  <li>Go to your Facebook account&apos;s <strong>Settings &amp; Privacy</strong> ➔ <strong>Settings</strong>.</li>
                  <li>Select <strong>Apps and Websites</strong> to view all apps linked to your Facebook profile.</li>
                  <li>Locate <strong>Aral.ai</strong> and click <strong>Remove</strong>.</li>
                  <li>(Optional) Check the box to delete all posts, videos, or events Aral.ai may have published, and confirm.</li>
                </ol>
              </div>

              <div className="bg-muted/40 p-4 rounded-2xl border border-border space-y-3">
                <h3 className="text-sm font-bold text-foreground">Option C: Direct Email Request</h3>
                <p className="text-xs sm:text-sm">
                  You can also email our support team directly at{' '}
                  <a href="mailto:aral.ai.app@gmail.com" className="text-primary font-semibold hover:underline">
                    aral.ai.app@gmail.com
                  </a>{' '}
                  with the subject line <code className="bg-background px-1.5 py-0.5 rounded text-xs border border-border">&quot;Data Deletion Request&quot;</code> and the email associated with your account. We will permanently delete all your data within 48 hours.
                </p>
              </div>
            </section>

            <section className="space-y-2.5 pt-4 border-t border-border">
              <h2 className="text-base font-bold text-foreground">6. Contact Us</h2>
              <p>
                If you have any questions or feedback regarding this Privacy Policy or your data, reach out to us at:
              </p>
              <p className="font-semibold text-foreground">
                Email: <a href="mailto:aral.ai.app@gmail.com" className="text-primary hover:underline">aral.ai.app@gmail.com</a>
              </p>
            </section>
          </div>

          <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="text-sm font-bold text-primary hover:underline">
              &larr; Back to Aral.ai
            </Link>
            <Link href="/terms" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Terms of Service &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
