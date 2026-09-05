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
              <h2 className="text-base font-bold text-foreground">4. Third-Party Services &amp; Infrastructure</h2>
              <p>
                We integrate with trusted service providers strictly for authentication, database hosting, and AI generation:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong className="text-foreground">Supabase:</strong> Secure PostgreSQL database, user authentication, session management, and encrypted storage.</li>
                <li><strong className="text-foreground">Google OAuth &amp; Meta / Facebook Login:</strong> Optional, secure social single sign-on (SSO).</li>
                <li><strong className="text-foreground">Groq &amp; Google Gemini:</strong> AI processing for study material summarization, flashcards, and quizzes.</li>
              </ul>
            </section>

            <section id="google-data-policy" className="space-y-3 pt-4 border-t border-border">
              <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <span>5. Google API Services &amp; User Data Policy</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Google Verification
                </span>
              </h2>
              <p>
                Aral.ai allows users to sign in using their Google account via Google OAuth. We value your privacy and are transparent about how your Google data is handled:
              </p>
              
              <div className="bg-muted/30 p-4 rounded-2xl border border-border space-y-3 text-xs sm:text-sm">
                <div>
                  <strong className="text-foreground block mb-1">Google Data Accessed:</strong>
                  <p>When you authenticate with Google, we request access only to your primary Google account email address (<code>email</code>), basic profile information including your display name and profile picture URL (<code>profile</code>), and your unique identifier (<code>openid</code>).</p>
                </div>
                <div>
                  <strong className="text-foreground block mb-1">Purpose of Collection:</strong>
                  <p>This data is strictly utilized to authenticate your identity, create and manage your Aral.ai account profile, and safeguard your study materials. We do not access your Google Drive, Gmail, or any other personal Google services.</p>
                </div>
                <div>
                  <strong className="text-foreground block mb-1">Data Storage &amp; Protection:</strong>
                  <p>All Google user data is transmitted securely over TLS/SSL encryption and stored in our protected database managed by Supabase, protected with strict row-level security (RLS) policies.</p>
                </div>
                <div>
                  <strong className="text-foreground block mb-1">No Selling or AI Training:</strong>
                  <p>We do not sell, rent, or transfer your Google user data to data brokers or advertising networks. We never use your Google user data to train general-purpose artificial intelligence or machine learning models.</p>
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 text-xs sm:text-sm space-y-2">
                <strong className="text-foreground font-bold block">Google API Services Limited Use Disclosure:</strong>
                <p className="italic">
                  Aral.ai&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary font-semibold hover:underline inline-flex items-center gap-0.5"
                  >
                    Google API Services User Data Policy
                  </a>
                  , including the Limited Use requirements.
                </p>
              </div>
            </section>

            <section id="data-deletion" className="space-y-3 pt-4 border-t border-border">
              <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <span>6. User Data Deletion &amp; Access Revocation</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Compliance
                </span>
              </h2>
              <p>
                According to Google API Policies, Meta/Facebook Platform rules, and data privacy regulations (such as GDPR and the Data Privacy Act), you have full control over your personal data and account records stored on Aral.ai.
              </p>

              <div className="bg-muted/40 p-4 rounded-2xl border border-border space-y-3">
                <h3 className="text-sm font-bold text-foreground">Option A: Revoke Google Account Access</h3>
                <ol className="list-decimal pl-5 space-y-1 text-xs sm:text-sm">
                  <li>Visit your Google Account&apos;s Third-party apps &amp; services dashboard at{' '}
                    <a
                      href="https://myaccount.google.com/connections"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary font-semibold hover:underline"
                    >
                      myaccount.google.com/connections
                    </a>.
                  </li>
                  <li>Locate <strong>Aral.ai</strong> in your list of connected apps.</li>
                  <li>Click <strong>Delete all connections</strong> or <strong>Remove Access</strong> to immediately revoke permissions.</li>
                </ol>
              </div>

              <div className="bg-muted/40 p-4 rounded-2xl border border-border space-y-3">
                <h3 className="text-sm font-bold text-foreground">Option B: Automatic In-App Deletion</h3>
                <ol className="list-decimal pl-5 space-y-1 text-xs sm:text-sm">
                  <li>Log in to your account at <Link href="/login" className="text-primary hover:underline">aral-ai-three.vercel.app</Link>.</li>
                  <li>Navigate to <strong>Settings</strong> ➔ <strong>Account</strong>.</li>
                  <li>Click <strong>Delete Account &amp; Data</strong> to immediately purge your uploaded files, flashcards, quizzes, and profile.</li>
                </ol>
              </div>

              <div className="bg-muted/40 p-4 rounded-2xl border border-border space-y-3">
                <h3 className="text-sm font-bold text-foreground">Option C: Remove Facebook Login App &amp; Data</h3>
                <ol className="list-decimal pl-5 space-y-1 text-xs sm:text-sm">
                  <li>Go to your Facebook account&apos;s <strong>Settings &amp; Privacy</strong> ➔ <strong>Settings</strong>.</li>
                  <li>Select <strong>Apps and Websites</strong> to view all apps linked to your Facebook profile.</li>
                  <li>Locate <strong>Aral.ai</strong> and click <strong>Remove</strong>.</li>
                  <li>(Optional) Check the box to delete all posts, videos, or events Aral.ai may have published, and confirm.</li>
                </ol>
              </div>

              <div className="bg-muted/40 p-4 rounded-2xl border border-border space-y-3">
                <h3 className="text-sm font-bold text-foreground">Option D: Direct Email Request</h3>
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
              <h2 className="text-base font-bold text-foreground">7. Contact Us</h2>
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
