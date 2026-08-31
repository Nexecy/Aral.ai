import React from 'react';
import { SessionWorkspaceClient } from '@/components/study/SessionWorkspaceClient';

export const dynamicParams = true;

// Static export (Capacitor/Tauri) can only emit a placeholder path.
// Vercel and `next dev` generate real session ids on demand.
export function generateStaticParams() {
  if (process.env.VERCEL === '1') return [];
  return [{ id: 'session' }];
}

export default function SessionWorkspacePage({ params }: { params: { id: string } }) {
  return <SessionWorkspaceClient sessionId={params.id} />;
}
