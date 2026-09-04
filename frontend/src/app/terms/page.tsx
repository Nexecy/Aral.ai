import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <BrandLogo href="/" align="left" size={40} wordmarkClassName="text-xl font-extrabold" />
        <div className="p-6 sm:p-8 rounded-3xl bg-card border border-border shadow-notion-soft space-y-5">
          <div>
            <h1 className="text-2xl font-extrabold">Terms and Conditions</h1>
            <p className="text-xs text-muted-foreground mt-1">Last updated August 31, 2026</p>
          </div>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              By creating an Aral.ai account you agree to these terms. Aral.ai is a study assistant that
              helps you upload materials, generate notes, flashcards, and quizzes, chat with a tutor, and
              track focus time.
            </p>
            <h2 className="text-sm font-bold text-foreground">Your account</h2>
            <p>
              You are responsible for the email and password you use, and for activity on your account.
              Confirm your email so we can protect the account and unlock AI study tools. Do not share
              your password.
            </p>
            <h2 className="text-sm font-bold text-foreground">Your content</h2>
            <p>
              You keep ownership of documents you upload. You grant Aral.ai permission to store, process,
              and analyze that content so the product can extract text and generate study materials for you.
              Do not upload material you do not have the right to use.
            </p>
            <h2 className="text-sm font-bold text-foreground">AI tools</h2>
            <p>
              Generated notes, flashcards, quizzes, and tutor replies are study aids, not academic advice
              or guaranteed-accurate summaries. Review them before you rely on them for exams or coursework.
            </p>
            <h2 className="text-sm font-bold text-foreground">Acceptable use</h2>
            <p>
              Do not misuse the service, attempt to access other users&apos; data, or use Aral.ai to generate
              harmful or dishonest academic work in violation of your school&apos;s policies.
            </p>
            <h2 className="text-sm font-bold text-foreground">Availability</h2>
            <p>
              We may change or interrupt features as the product develops. We are not liable for lost study
              time, exam outcomes, or data loss beyond what applicable law requires.
            </p>
          </div>
          <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="text-sm font-bold text-primary hover:underline">
              &larr; Back to Aral.ai
            </Link>
            <Link href="/privacy" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Privacy Policy &amp; Data Deletion &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
