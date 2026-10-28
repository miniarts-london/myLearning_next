'use server';

import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/dal';
import type { PersonLookup, RoomMessageResult, RoomResult } from '@/lib/rooms';
import { addMeetingPerson, createRoomRecord, deleteRoomRecord, loadPersonDetails, messageRoomPerson, removeMeetingPerson, saveGuestEmailRecord, saveRoomDesks, saveRoomNote, updateRoomDetailsRecord } from '@/lib/rooms.server';

function done(result: RoomResult): RoomResult {
  if (result.ok) {
    revalidatePath('/room-layout');
    revalidatePath('/dashboard');
  }
  return result;
}

export async function createRoom(input: { name: string; kind: string; courseId?: number; startsAt?: string; location?: string }): Promise<RoomResult> {
  const session = await verifySession();
  return done(await createRoomRecord(session, input));
}

export async function saveRoomDetails(roomId: string, input: { name: string; startsAt?: string; location?: string; presenterUserId?: number | null }): Promise<RoomResult> {
  const session = await verifySession();
  return done(await updateRoomDetailsRecord(session, roomId, input));
}

export async function saveDesks(roomId: string, desks: { id: string; personId: string; x: number; y: number }[]): Promise<RoomResult> {
  const session = await verifySession();
  return done(await saveRoomDesks(session, roomId, desks));
}

export async function saveNote(roomId: string, personId: string, text: string): Promise<RoomResult> {
  const session = await verifySession();
  return done(await saveRoomNote(session, roomId, personId, text));
}

export async function saveGuestEmail(roomId: string, personId: string, email: string): Promise<RoomResult> {
  const session = await verifySession();
  return done(await saveGuestEmailRecord(session, roomId, personId, email));
}

export async function addPerson(roomId: string, input: { userId?: number; name?: string }): Promise<RoomResult> {
  const session = await verifySession();
  return done(await addMeetingPerson(session, roomId, input));
}

export async function removePerson(roomId: string, personId: string): Promise<RoomResult> {
  const session = await verifySession();
  return done(await removeMeetingPerson(session, roomId, personId));
}

export async function deleteRoom(roomId: string): Promise<RoomResult> {
  const session = await verifySession();
  return done(await deleteRoomRecord(session, roomId));
}

export async function personDetails(roomId: string, personId: string): Promise<PersonLookup> {
  const session = await verifySession();
  return loadPersonDetails(session, roomId, personId);
}

export async function messagePerson(roomId: string, personId: string, text: string): Promise<RoomMessageResult> {
  const session = await verifySession();
  return messageRoomPerson(session, roomId, personId, text);
}
