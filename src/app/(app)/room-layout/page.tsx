import type { Metadata } from 'next';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { loadRoomPage } from '@/lib/rooms.server';
import { Loading } from '@/components/Loading';
import { RoomLayoutScreen } from '@/components/screens/rooms/RoomLayout';

export const metadata: Metadata = { title: 'Class rooms' };

export default function RoomLayoutPage() {
  return (
    <Suspense fallback={<Loading label="Loading class rooms…" />}>
      <RoomLayout />
    </Suspense>
  );
}

async function RoomLayout() {
  const session = await verifySession();
  const data = await loadRoomPage(session);
  return <RoomLayoutScreen {...data} />;
}
