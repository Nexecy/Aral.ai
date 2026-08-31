import React from 'react';
import { SessionWorkspaceClient } from '@/components/study/SessionWorkspaceClient';

// Session ids are UUIDs minted at runtime, so the static export can only emit a
// placeholder shell here. The dev server and any hosted (non-export) build
// resolve real ids normally.
export function generateStaticParams() {
  return [{ id: 'session' }];
}

export default function SessionWorkspacePage({ params }: { params: { id: string } }) {
  return <SessionWorkspaceClient sessionId={params.id} />;
}
