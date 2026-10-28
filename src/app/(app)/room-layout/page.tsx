import type { Metadata } from 'next';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { loadRoomPage } from '@/lib/rooms.server';
import { Loading } from '@/components/Loading';
import { RoomLayoutScreen } from '@/components/screens/rooms/RoomLayout';

export const metadata: Metadata = { title: 'Classrooms' };

export default function RoomLayoutPage({ searchParams }: { searchParams: Promise<{ room?: string | string[] }> }) {
  return (
    <Suspense fallback={<Loading label="Loading classrooms…" />}>
      <RoomLayout searchParams={searchParams} />
    </Suspense>
  );
}

async function RoomLayout({ searchParams }: { searchParams: Promise<{ room?: string | string[] }> }) {
  const params = await searchParams;
  const initialRoomId = typeof params.room === 'string' ? params.room : null;
  const session = await verifySession();
  const data = await loadRoomPage(session);
  return <RoomLayoutScreen {...data} initialRoomId={initialRoomId} />;
}
