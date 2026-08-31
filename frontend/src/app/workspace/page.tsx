import React from 'react';
import { BookOpen, Bot, Columns, Layers, Trophy } from 'lucide-react';
import { DocumentViewer } from '@/components/study/DocumentViewer';

const studyTools = [
  {
    label: 'Notes',
    description: 'Structured notes will appear after your document is processed.',
    icon: BookOpen
  },
  {
    label: 'Flashcards',
    description: 'Active-recall cards will be generated from your study material.',
    icon: Layers
  },
  {
    label: 'Quiz Arena',
    description: 'Practice questions unlock when a new session is ready.',
    icon: Trophy
  },
  {
    label: 'AI Tutor',
    description: 'Upload a document to give your tutor the right context.',
    icon: Bot
  }
];

export default function EmptyWorkspacePage() {
  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      <div className="bg-surface-container-lowest p-5 sm:p-7 rounded-2xl border border-outline-variant">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-1.5 font-medium">
          <span>Study Workspace</span>
          <span>•</span>
          <span className="font-semibold text-on-surface">New session</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-on-surface">
          Start a new study session
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Upload study material below. Your previous session is safely stored in Session History.
        </p>
      </div>

      <div className="flex items-center gap-3 bg-surface-container-lowest p-2.5 rounded-2xl border border-outline-variant">
        <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-on-primary shadow-sm">
          <Columns className="w-4 h-4" />
          <span>Split View</span>
          <span className="px-2 py-0.5 rounded bg-on-primary/20 text-on-primary text-[10px] uppercase font-bold">
            Empty
          </span>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="w-full xl:w-[62%]">
          <DocumentViewer document={null} sessionTitle="New Study Session" height={760} />
        </div>

        <div className="w-full xl:flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
          {studyTools.map(({ label, description, icon: Icon }) => (
            <div
              key={label}
              className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-on-surface">{label}</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">
                    {description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
