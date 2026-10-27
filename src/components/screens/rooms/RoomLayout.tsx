'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/en-gb';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CalendarIcon from '@mui/icons-material/CalendarTodayOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import GroupsIcon from '@mui/icons-material/GroupsOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import SchoolIcon from '@mui/icons-material/SchoolOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ChatIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import SendIcon from '@mui/icons-material/Send';
import { addPerson, createRoom, deleteRoom, messagePerson, personDetails, removePerson, saveDesks, saveGuestEmail, saveNote, saveRoomDetails } from '@/actions/rooms';
import { MESSAGE_MAX } from '@/lib/messages';
import { NOTE_MAX, GUEST_EMAIL_MAX, LOCATION_MAX, draggedSpot, freePosition, planPoint, roomWhenLabel, spotFromPointer, type PersonDetails, type RoomPageData, type RoomResult, type RoomView, type SeatView, type UnseatedView } from '@/lib/rooms';
import common from '@/css/common.module.css';
import styles from '@/css/RoomLayout.module.css';
import { Alert, Box, Paper } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-2, 0],
  ArrowRight: [2, 0],
  ArrowUp: [0, -2],
  ArrowDown: [0, 2],
};

interface LayoutOverride {
  seats: SeatView[];
  unseated: UnseatedView[];
}

type Drag =
  | { kind: 'desk'; pointerId: number; deskId: string; name: string; startX: number; startY: number; originX: number; originY: number; x: number; y: number; rect: DOMRect; moved: boolean }
  | { kind: 'tray'; pointerId: number; personId: string; name: string; startX: number; startY: number; moved: boolean };

const NO_SEATS: SeatView[] = [];
const NO_UNSEATED: UnseatedView[] = [];

function roomKind(item: RoomView): string {
  const kind = item.kind === 'meeting' ? 'Meeting' : (item.courseName ? `Class · ${item.courseName}` : 'Class');
  const when = item.startsAt ? roomWhenLabel(item.startsAt) : '';
  return [kind, when, item.location ?? ''].filter(Boolean).join(' · ');
}

function roomFor(item: RoomView): string {
  if (item.kind === 'meeting') return 'A meeting';
  return item.courseName ? `Class · ${item.courseName}` : 'A class';
}

function storedWhen(value: Dayjs | null, invalid: boolean): { ok: true; value: string } | { ok: false } {
  if (invalid || (value !== null && !value.isValid())) return { ok: false };
  if (!value) return { ok: true, value: '' };
  return { ok: true, value: value.format('YYYY-MM-DDTHH:mm') };
}

function WhenField({ value, onChange, onInvalid }: {
  value: Dayjs | null;
  onChange: (value: Dayjs | null) => void;
  onInvalid: (invalid: boolean) => void;
}) {
  return (
    <DateTimePicker
      label="Date and time"
      value={value}
      ampm={false}
      format="DD/MM/YYYY HH:mm"
      timeSteps={{ minutes: 1 }}
      onChange={(next, context) => {
        onChange(next);
        onInvalid(context.validationError != null);
      }}
      slotProps={{
        textField: { variant: 'standard' },
        openPickerButton: { 'aria-label': 'Choose date and time' },
      }}
    />
  );
}

function deskStyle(x: number, y: number, fromTheFront: boolean): { left: string; top: string } {
  const place = planPoint(x, y, fromTheFront);
  return { left: `${place.left}%`, top: `${place.top}%` };
}

function nameList(items: { id: string | number; name: string }[]): ReactNode {
  if (items.length === 0) return 'None';
  return (
    <ul className={styles.factList}>
      {items.map((item) => <li key={item.id}>{item.name}</li>)}
    </ul>
  );
}

function emailLine(email: string): ReactNode {
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return email;
  return <a href={`mailto:${email}`}>{email}</a>;
}

// A floor plan for an in-person class or a meeting. Teachers drag desks and write notes.
// Students get the same page with those controls left out; the server checks the role again on save.
export function RoomLayoutScreen({ canCreate, courses, candidates, rooms }: RoomPageData) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const shown = rooms.filter((item) => !hiddenIds.includes(item.id));
  const [selectedId, setSelectedId] = useState<string | null>(shown[0]?.id ?? null);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  if (pendingSelect && shown.some((item) => item.id === pendingSelect) && selectedId !== pendingSelect) {
    setSelectedId(pendingSelect);
    setPendingSelect(null);
  }
  const activeId = shown.some((item) => item.id === selectedId) ? selectedId : (shown[0]?.id ?? null);
  const room = shown.find((item) => item.id === activeId) ?? null;

  const [layouts, setLayouts] = useState<Record<string, LayoutOverride>>({});
  const override = room ? layouts[room.id] : undefined;
  const seats = override?.seats ?? room?.seats ?? NO_SEATS;
  const unseated = override?.unseated ?? room?.unseated ?? NO_UNSEATED;
  const [gesturing, setGesturing] = useState(false);
  const viewRef = useRef({ room, seats, unseated });
  useEffect(() => {
    // While a finger is down, the pointer handler owns the positions. Copying here would put the desk back.
    if (gesturing) return;
    viewRef.current = { room, seats, unseated };
  }, [gesturing, room, seats, unseated]);

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, PersonDetails>>({});
  const [shownDetails, setShownDetails] = useState<PersonDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const detailTicket = useRef(0);
  const selected = seats.find((seat) => seat.personId === selectedPersonId)
    ?? unseated.find((person) => person.personId === selectedPersonId)
    ?? null;
  const seated = selected ? seats.some((seat) => seat.personId === selected.personId) : false;
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  if ((selected?.personId ?? null) !== draftKey) {
    setDraftKey(selected?.personId ?? null);
    setDraft(selected?.note ?? '');
  }
  const [messageFor, setMessageFor] = useState<string | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  if ((selected?.personId ?? null) !== messageFor) {
    setMessageFor(selected?.personId ?? null);
    setMessageOpen(false);
    setMessageText('');
    setMessageError(null);
  }
  const guestEmail = shownDetails?.canEditEmail ? (shownDetails.email ?? '') : null;
  const [emailKey, setEmailKey] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const emailIdentity = selected && guestEmail !== null ? `${selected.personId}:${guestEmail}` : null;
  if (emailIdentity !== emailKey) {
    setEmailKey(emailIdentity);
    setEmailDraft(guestEmail ?? '');
  }

  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<'class' | 'meeting'>(courses.length > 0 ? 'class' : 'meeting');
  const [roomName, setRoomName] = useState('');
  const [roomWhen, setRoomWhen] = useState<Dayjs | null>(null);
  const [roomWhenInvalid, setRoomWhenInvalid] = useState(false);
  const [roomLocation, setRoomLocation] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWhen, setEditWhen] = useState<Dayjs | null>(null);
  const [editWhenInvalid, setEditWhenInvalid] = useState(false);
  const [editLocation, setEditLocation] = useState('');
  const [courseId, setCourseId] = useState(courses[0] ? String(courses[0].id) : '');
  const [guestName, setGuestName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [confirmRoom, setConfirmRoom] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [intro, setIntro] = useState<'shown' | 'leaving' | 'gone'>('shown');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const [ghost, setGhost] = useState<{ name: string; x: number; y: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const floorRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const saveGen = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistPromise = useRef<Promise<void>>(Promise.resolve());
  const latestSave = useRef<{ roomId: string; seats: SeatView[] } | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    let frame = 0;
    const wait = window.setTimeout(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const el = introRef.current;
      if (reduce || !el) {
        setIntro('gone');
        return;
      }
      // Lock the current height first so the text cannot wrap taller and shove the page down.
      el.style.height = `${el.getBoundingClientRect().height}px`;
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          el.style.height = '0px';
          setIntro('leaving');
        });
      });
    }, 5_000);
    return () => {
      window.clearTimeout(wait);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (intro !== 'leaving') return;
    const done = window.setTimeout(() => setIntro('gone'), 450);
    return () => window.clearTimeout(done);
  }, [intro]);

  async function persist(roomId: string, next: SeatView[]) {
    const ticket = ++saveGen.current;
    setSaving(true);
    const result = await saveDesks(roomId, next.map((seat) => ({ id: seat.deskId, personId: seat.personId, x: seat.x, y: seat.y })));
    if (ticket !== saveGen.current) return;
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      setLayouts((prev) => {
        const copy = { ...prev };
        delete copy[roomId];
        return copy;
      });
      router.refresh();
    }
  }

  function schedule(roomId: string, next: SeatView[], immediate: boolean) {
    latestSave.current = { roomId, seats: next };
    if (timer.current) clearTimeout(timer.current);
    if (immediate) {
      timer.current = null;
      persistPromise.current = persist(roomId, next);
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      const current = latestSave.current;
      if (current) persistPromise.current = persist(current.roomId, current.seats);
    }, 350);
  }

  async function flush() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      const current = latestSave.current;
      if (current) persistPromise.current = persist(current.roomId, current.seats);
    }
    await persistPromise.current;
  }

  function commit(roomId: string, nextSeats: SeatView[], nextUnseated: UnseatedView[], immediate: boolean) {
    viewRef.current = { ...viewRef.current, seats: nextSeats, unseated: nextUnseated };
    setLayouts((prev) => ({ ...prev, [roomId]: { seats: nextSeats, unseated: nextUnseated } }));
    schedule(roomId, nextSeats, immediate);
  }

  function place(person: UnseatedView, at?: { x: number; y: number }) {
    const current = viewRef.current;
    if (!current.room?.canEdit) return;
    const pos = at ?? freePosition(current.seats);
    const seat: SeatView = { ...person, deskId: crypto.randomUUID(), x: pos.x, y: pos.y };
    commit(
      current.room.id,
      [...current.seats, seat],
      current.unseated.filter((item) => item.personId !== person.personId),
      true,
    );
    openPerson(current.room.id, person.personId);
    setLive(`${person.name} seated.`);
  }

  function openPerson(roomId: string, personId: string) {
    setCreating(false);
    setEditingId(null);
    setSelectedPersonId(personId);
    const key = `${roomId}:${personId}`;
    const ticket = ++detailTicket.current;
    const cached = detailCache[key];
    setDetailsError(null);
    if (cached) {
      setShownDetails(cached);
      setDetailsLoading(false);
      return;
    }
    setShownDetails(null);
    setDetailsLoading(true);
    void personDetails(roomId, personId).then((result) => {
      if (ticket !== detailTicket.current) return;
      setDetailsLoading(false);
      if (!result.ok) {
        setDetailsError(result.message);
        return;
      }
      setShownDetails(result.details);
      setDetailCache((prev) => ({ ...prev, [key]: result.details }));
    });
  }

  function unseat(personId: string) {
    const current = viewRef.current;
    const seat = current.seats.find((item) => item.personId === personId);
    if (!seat || !current.room?.canEdit) return;
    const person: UnseatedView = { personId: seat.personId, name: seat.name, isYou: seat.isYou, note: seat.note };
    const nextUnseated = [...current.unseated, person].sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
    commit(current.room.id, current.seats.filter((item) => item.personId !== personId), nextUnseated, true);
    setLive(`${seat.name} is no longer seated.`);
  }

  function clearLayout(roomId: string) {
    setLayouts((prev) => {
      const copy = { ...prev };
      delete copy[roomId];
      return copy;
    });
  }

  async function run(task: () => Promise<RoomResult>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await flush();
      const result = await task();
      if (!result.ok) setError(result.message);
      else after?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onDeskPointerDown(event: React.PointerEvent<HTMLButtonElement>, seat: SeatView) {
    if (!room?.canEdit || event.button !== 0) return;
    const rect = floorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setGesturing(true);
    drag.current = {
      kind: 'desk', pointerId: event.pointerId, deskId: seat.deskId, name: seat.name,
      startX: event.clientX, startY: event.clientY, originX: seat.x, originY: seat.y, x: seat.x, y: seat.y, rect, moved: false,
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* The pointer may already be captured. */ }
  }

  function onDeskPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.kind !== 'desk' || current.pointerId !== event.pointerId || !room) return;
    const dx = ((event.clientX - current.startX) / current.rect.width) * 100;
    const dy = ((event.clientY - current.startY) / current.rect.height) * 100;
    if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 4) {
      current.moved = true;
      setDraggingId(current.deskId);
    }
    if (!current.moved) return;
    const spot = draggedSpot(current.originX, current.originY, dx, dy, room.canEdit);
    current.x = spot.x;
    current.y = spot.y;
    const next = viewRef.current.seats.map((seat) => (seat.deskId === current.deskId
      ? { ...seat, x: current.x, y: current.y }
      : seat));
    viewRef.current = { ...viewRef.current, seats: next };
    setLayouts((prev) => ({ ...prev, [room.id]: { seats: next, unseated: viewRef.current.unseated } }));
  }

  function onDeskPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.kind !== 'desk' || current.pointerId !== event.pointerId || !room) return;
    drag.current = null;
    setDraggingId(null);
    setGesturing(false);
    if (!current.moved) return;
    suppressClick.current = true;
    // The final point lives on the drag, so a render in the middle of the gesture can't save the old spot.
    const next = viewRef.current.seats.map((seat) => (seat.deskId === current.deskId ? { ...seat, x: current.x, y: current.y } : seat));
    viewRef.current = { ...viewRef.current, seats: next };
    setLayouts((prev) => ({ ...prev, [room.id]: { seats: next, unseated: viewRef.current.unseated } }));
    schedule(room.id, next, true);
    setLive(`${current.name} moved.`);
  }

  function onTrayPointerDown(event: React.PointerEvent<HTMLButtonElement>, person: UnseatedView) {
    if (!room?.canEdit || event.button !== 0) return;
    setGesturing(true);
    drag.current = {
      kind: 'tray', pointerId: event.pointerId, personId: person.personId, name: person.name,
      startX: event.clientX, startY: event.clientY, moved: false,
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* The pointer may already be captured. */ }
  }

  function onTrayPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.kind !== 'tray' || current.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) <= 4) return;
    current.moved = true;
    setGhost({ name: current.name, x: event.clientX, y: event.clientY });
  }

  function onTrayPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.kind !== 'tray' || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setGhost(null);
    setGesturing(false);
    if (!current.moved) return;
    suppressClick.current = true;
    const floor = floorRef.current?.getBoundingClientRect();
    const person = viewRef.current.unseated.find((item) => item.personId === current.personId);
    if (!floor || !person) return;
    const inside = event.clientX >= floor.left && event.clientX <= floor.right && event.clientY >= floor.top && event.clientY <= floor.bottom;
    if (!inside) return;
    place(person, spotFromPointer(event.clientX, event.clientY, floor, viewRef.current.room?.canEdit === true));
  }

  function ignoreDragClick(select: () => void) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    select();
  }

  if (editingId && editingId !== activeId) setEditingId(null);

  function beginEdit(item: RoomView) {
    setError(null);
    setCreating(false);
    setSelectedPersonId(null);
    setConfirmRoom(null);
    setEditingId(item.id);
    setEditName(item.name);
    setEditWhen(item.startsAt ? dayjs(item.startsAt) : null);
    setEditWhenInvalid(false);
    setEditLocation(item.location ?? '');
  }

  const introCopy = canCreate
    ? 'Arrange desks for an in-person class or a meeting. Click a person to see their details and send a message, drag the desks, and add notes.'
    : 'View the classes and meetings you are in, and see a few details about the people in the room.';

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
      <div className={styles.titleRow}>
        <Typography variant="h1" className={`${common.pageTitle} ${styles.titleInRow}`}>Classrooms</Typography>
        {intro === 'gone' && (
          <Tooltip title={introCopy} arrow placement="bottom-start" slotProps={{ tooltip: { sx: { maxWidth: 280 } } }}>
            <IconButton size="small" aria-label="About classrooms" className={styles.titleInfo}><InfoOutlinedIcon fontSize="small" /></IconButton>
          </Tooltip>
        )}
      </div>
      {(intro !== 'gone' || room) && (
      <div className={`${styles.masthead} ${intro === 'leaving' ? styles.mastheadLeaving : ''} ${intro === 'gone' ? styles.mastheadWide : ''}`}>
        {intro !== 'gone' && (
          <div className={styles.introWrap} ref={introRef}>
            <p className={styles.intro}>{introCopy}</p>
          </div>
        )}
        {room && (
          <section className={styles.details} aria-labelledby="room-details-title">
            <div className={styles.detailsHead}>
              <Typography id="room-details-title" component="h2" variant="h3" className={styles.detailsTitle}>{room.name}</Typography>
              {room.canEdit && <IconButton size="small" aria-label="Edit" onClick={() => beginEdit(room)}><EditIcon /></IconButton>}
            </div>
            <dl className={`${styles.facts} ${styles.detailRow}`}>
              <div className={styles.detailIcon}>
                <dt>
                  {room.kind === 'meeting' ? <GroupsIcon aria-hidden="true" /> : <SchoolIcon aria-hidden="true" />}
                  <span className="visually-hidden">Room for</span>
                </dt>
                <dd>{roomFor(room)}</dd>
              </div>
              <div className={styles.detailIcon}>
                <dt>
                  <CalendarIcon aria-hidden="true" />
                  <span className="visually-hidden">Date and time</span>
                </dt>
                <dd>{room.startsAt ? roomWhenLabel(room.startsAt) : 'Not set'}</dd>
              </div>
              <div className={styles.detailIcon}>
                <dt>
                  <PlaceIcon aria-hidden="true" />
                  <span className="visually-hidden">Location</span>
                </dt>
                <dd>{room.location || 'Not set'}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
      )}
      <p className="visually-hidden" role="status">{saving ? 'Saving the layout…' : live}</p>

      {error && !creating && !editingId && <Alert severity="error" className={common.gapAbove} onClose={() => setError(null)}>{error}</Alert>}

      {canCreate && (
        <Drawer
          anchor="right"
          open={creating}
          onClose={() => { if (!busy) setCreating(false); }}
          slotProps={{ paper: { 'aria-labelledby': 'new-room-title', className: styles.drawerPaper } as object }}
        >
          <div className={styles.drawerHeader}>
            <Typography id="new-room-title" variant="h2" className={styles.detailTitle}>New room</Typography>
            <IconButton onClick={() => setCreating(false)} aria-label="Close" disabled={busy}><CloseIcon /></IconButton>
          </div>
          <div className={styles.drawerBody}>
            <form className={styles.createForm} onSubmit={(event) => {
              event.preventDefault();
              const when = storedWhen(roomWhen, roomWhenInvalid);
              if (!when.ok) {
                setError('That date or time is not valid.');
                return;
              }
              void run(async () => {
                const result = await createRoom({
                  name: roomName,
                  kind,
                  courseId: kind === 'class' ? Number(courseId) : undefined,
                  startsAt: when.value,
                  location: roomLocation,
                });
                if (result.ok && result.roomId) setPendingSelect(result.roomId);
                return result;
              }, () => {
                setRoomName('');
                setRoomWhen(null);
                setRoomWhenInvalid(false);
                setRoomLocation('');
                setCreating(false);
              });
            }}>
              {error && <Alert severity="error" role="alert" onClose={() => setError(null)}>{error}</Alert>}
              <TextField label="Room name" value={roomName} onChange={(event) => setRoomName(event.target.value)} slotProps={{ htmlInput: { maxLength: 80 } }} required />
              <FormControl>
                <FormLabel id="room-kind">Room for</FormLabel>
                <RadioGroup aria-labelledby="room-kind" value={kind} onChange={(event) => setKind(event.target.value === 'meeting' ? 'meeting' : 'class')}>
                  <FormControlLabel value="class" control={<Radio />} label="A class" disabled={courses.length === 0} />
                  <FormControlLabel value="meeting" control={<Radio />} label="A meeting" />
                </RadioGroup>
              </FormControl>
              {kind === 'class' && (
                <TextField select label="Class" value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
                  {courses.map((course) => <MenuItem key={course.id} value={String(course.id)}>{course.name}</MenuItem>)}
                </TextField>
              )}
              {courses.length === 0 && <p className={common.muted}>You can set up a meeting. A classroom needs a class you teach.</p>}
              <WhenField value={roomWhen} onChange={setRoomWhen} onInvalid={setRoomWhenInvalid} />
              <TextField label="Location" value={roomLocation} onChange={(event) => setRoomLocation(event.target.value)} slotProps={{ htmlInput: { maxLength: LOCATION_MAX } }} />
              <div className={styles.actions}>
                <Button type="submit" variant="contained" disabled={busy || (kind === 'class' && !courseId)}>Create room</Button>
                <Button type="button" variant="outlined" color="secondary" disabled={busy} onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </Drawer>
      )}

      {shown.length === 0 && !canCreate ? (
        <Alert severity="info" className={common.gapAbove}>
          No classrooms yet. When a teacher arranges a room for one of your classes, or adds you to a meeting, it will show up here.
        </Alert>
      ) : (
        <div className={`${styles.columns} ${sidebarOpen ? '' : styles.columnsFolded}`}>
          <div className={styles.sidebarColumn}>
            <Paper className={styles.sidebar}>
              <div className={styles.sidebarBar}>
                <Typography component="h2" variant="overline" className={styles.sideTitle} aria-hidden={sidebarOpen ? undefined : true}>Rooms</Typography>
                <IconButton
                  size="small"
                  aria-expanded={sidebarOpen}
                  aria-controls="room-sidebar"
                  aria-label={sidebarOpen ? 'Hide the room list' : 'Show the room list'}
                  onClick={() => setSidebarOpen((open) => !open)}
                >
                  {sidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                </IconButton>
              </div>
              <div className={`${styles.sidebarReveal} ${sidebarOpen ? '' : styles.sidebarRevealClosed}`}>
                <div className={styles.sidebarRevealInner} inert={sidebarOpen ? undefined : true}>
                  <div className={styles.sidebarBody}>
                    {shown.length > 0 && <ul id="room-sidebar" className={styles.roomList}>
                      {shown.map((item) => (
                        <li key={item.id}>
                          <button type="button" className={styles.roomButton} aria-current={item.id === room?.id ? 'true' : undefined} onClick={() => setSelectedId(item.id)}>
                            <span className={styles.roomName}>{item.name}</span>
                            {item.startsAt && <span className={styles.roomMeta}>{roomWhenLabel(item.startsAt)}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>}
                    {canCreate && (
                      <Button type="button" size="small" variant="contained" onClick={() => { setSelectedPersonId(null); setError(null); setEditingId(null); setCreating(true); }}>Create new room</Button>
                    )}
                  </div>
                </div>
              </div>
            </Paper>
            {room?.canEdit && (
            <div className={`${styles.sidebarReveal} ${sidebarOpen ? '' : styles.sidebarRevealClosed}`}>
              <div className={styles.sidebarRevealInner} inert={sidebarOpen ? undefined : true}>
            <Paper className={styles.sidebar}>
              <Box sx={{ p: 2, mt: 2 }}>
              {room.kind === 'meeting' ? (
                <>
                  <Typography component="h2" variant="overline">Add students or guests</Typography>
                  <form className={styles.peopleForm} onSubmit={(event) => {
                    event.preventDefault();
                    const id = room.id;
                    void run(() => addPerson(id, { name: guestName }), () => {
                      setGuestName('');
                      clearLayout(id);
                    });
                  }}>
                    <TextField className={styles.peopleField} label="Guest name" value={guestName} onChange={(event) => setGuestName(event.target.value)} slotProps={{ htmlInput: { maxLength: 80 } }} />
                    <div className={styles.actions}>
                      <Button type="submit" variant="outlined" color="secondary" disabled={busy || !guestName.trim()}>Add guest</Button>
                    </div>
                  </form>
                  {candidates.length > 0 && (
                    <form className={styles.peopleForm} onSubmit={(event) => {
                      event.preventDefault();
                      const id = room.id;
                      void run(() => addPerson(id, { userId: Number(candidateId) }), () => {
                        setCandidateId('');
                        clearLayout(id);
                      });
                    }}>
                      <TextField className={styles.peopleField} select label="Someone you teach" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
                        <MenuItem value="">Choose a person</MenuItem>
                        {candidates.map((person) => (
                          <MenuItem key={person.userId} value={String(person.userId)}>{person.name} ({person.courseName})</MenuItem>
                        ))}
                      </TextField>
                      <div className={styles.actions}>
                        <Button type="submit" variant="outlined" color="secondary" disabled={busy || !candidateId}>Add to meeting</Button>
                      </div>
                    </form>
                  )}
                </>
              ) : <Alert severity="info">You can seat/unseat the students in this room.</Alert>}
              </Box>
            </Paper>
            <Paper className={styles.sidebar}>
              <Box sx={{ p: 2, mt: 2 }}>
                  <Typography component="h2" variant="overline">Not seated</Typography>
                  {unseated.length === 0 ? (
                    <p className={common.muted}>{seats.length === 0 ? 'No one is in this room yet.' : 'Everyone has a seat.'}</p>
                  ) : (
                    <ul className={styles.personList}>
                      {unseated.map((person) => (
                        <li key={person.personId}>
                          <button
                            type="button"
                            className={styles.person}
                            aria-pressed={selected?.personId === person.personId}
                            aria-haspopup="dialog"
                            onClick={() => ignoreDragClick(() => openPerson(room.id, person.personId))}
                            onPointerDown={(event) => onTrayPointerDown(event, person)}
                            onPointerMove={onTrayPointerMove}
                            onPointerUp={onTrayPointerUp}
                          >
                            {person.isYou && <span className={styles.youMark}>You</span>}
                            {person.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </Box>
            </Paper>
              </div>
            </div>
            )}
          </div>

          {shown.length === 0 ? (
            <Alert severity="info">Create a room, then drag the desks into place.</Alert>
          ) : room && (
            <div className={styles.workspace}>
              {saving && <p className={`${styles.hint} ${common.muted}`} aria-hidden="true">Saving the layout…</p>}
              <div className={styles.canvasScroll}>
                <div className={styles.room}>
                  {!room.canEdit && <p className={styles.front}>Front of the room</p>}
                  <div ref={floorRef} className={`${styles.floor} ${room.canEdit ? styles.editable : ''}`}>
                    {seats.map((seat) => (
                      <div key={seat.deskId} className={`${styles.desk} ${seat.isYou ? styles.deskYou : ''} ${selected?.personId === seat.personId ? styles.deskSelected : ''} ${draggingId === seat.deskId ? styles.deskDragging : ''}`} style={deskStyle(seat.x, seat.y, room.canEdit)}>
                        <button
                          type="button"
                          aria-pressed={selected?.personId === seat.personId}
                          aria-haspopup="dialog"
                          aria-keyshortcuts={room.canEdit ? 'ArrowUp ArrowDown ArrowLeft ArrowRight' : undefined}
                          onClick={() => ignoreDragClick(() => openPerson(room.id, seat.personId))}
                          onKeyDown={(event) => {
                            const step = ARROWS[event.key];
                            if (!step || !room.canEdit) return;
                            event.preventDefault();
                            const current = viewRef.current;
                            const next = current.seats.map((item) => {
                              if (item.deskId !== seat.deskId) return item;
                              const spot = draggedSpot(item.x, item.y, step[0], step[1], true);
                              return { ...item, x: spot.x, y: spot.y };
                            });
                            commit(room.id, next, current.unseated, false);
                            setLive(`${seat.name} moved.`);
                          }}
                          onPointerDown={(event) => onDeskPointerDown(event, seat)}
                          onPointerMove={onDeskPointerMove}
                          onPointerUp={onDeskPointerUp}
                        >
                          {seat.isYou && <span className={styles.youMark}>You</span>}
                          <span className={styles.deskName}>{seat.name}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                  {room.canEdit && <p className={styles.front}>Front of the room</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {room?.canEdit && (
        <Drawer
          anchor="right"
          open={editingId === room.id}
          onClose={() => { if (!busy) { setEditingId(null); setError(null); setConfirmRoom(null); } }}
          slotProps={{ paper: { 'aria-labelledby': 'edit-room-title', className: styles.drawerPaper } as object }}
        >
          <div className={styles.drawerHeader}>
            <Typography id="edit-room-title" variant="h2" className={styles.detailTitle}>
              Edit {room.kind === 'meeting' ? 'meeting' : 'classroom'}
            </Typography>
            <IconButton onClick={() => { setEditingId(null); setError(null); setConfirmRoom(null); }} aria-label="Close" disabled={busy}><CloseIcon /></IconButton>
          </div>
          <div className={styles.drawerBody}>
            <form className={styles.createForm} onSubmit={(event) => {
              event.preventDefault();
              const when = storedWhen(editWhen, editWhenInvalid);
              if (!when.ok) {
                setError('That date or time is not valid.');
                return;
              }
              const id = room.id;
              void run(() => saveRoomDetails(id, { name: editName, startsAt: when.value, location: editLocation }), () => setEditingId(null));
            }}>
              <p className={styles.detailMeta}>{roomFor(room)}</p>
              {error && <Alert severity="error" role="alert" onClose={() => setError(null)}>{error}</Alert>}
              <TextField label="Room name" value={editName} onChange={(event) => setEditName(event.target.value)} slotProps={{ htmlInput: { maxLength: 80 } }} required />
              <WhenField value={editWhen} onChange={setEditWhen} onInvalid={setEditWhenInvalid} />
              <TextField label="Location" value={editLocation} onChange={(event) => setEditLocation(event.target.value)} slotProps={{ htmlInput: { maxLength: LOCATION_MAX } }} />
              <div className={styles.actions}>
                <Button type="submit" variant="contained" disabled={busy}>Save</Button>
                <Button type="button" variant="outlined" color="secondary" disabled={busy} onClick={() => { setEditingId(null); setError(null); setConfirmRoom(null); }}>Cancel</Button>
              </div>
            </form>
            <div className={styles.deleteRoom}>
              {confirmRoom === room.id ? (
                <>
                  <Button type="button" variant="contained" color="error" disabled={busy} onClick={() => {
                    const id = room.id;
                    void run(() => deleteRoom(id), () => {
                      setHiddenIds((prev) => [...prev, id]);
                      clearLayout(id);
                      setConfirmRoom(null);
                      setEditingId(null);
                      setSelectedId(null);
                    });
                  }}>
                    Delete {room.name}
                  </Button>
                  <Button type="button" variant="outlined" color="secondary" disabled={busy} onClick={() => setConfirmRoom(null)}>Keep it</Button>
                </>
              ) : (
                <Button type="button" variant="outlined" color="error" disabled={busy} onClick={() => setConfirmRoom(room.id)}>Delete room</Button>
              )}
            </div>
          </div>
        </Drawer>
      )}
      {room && (
        <Drawer
          anchor="right"
          open={selected !== null}
          onClose={() => setSelectedPersonId(null)}
          slotProps={{ paper: { 'aria-labelledby': 'person-details', className: styles.drawerPaper } as object }}
        >
          {selected && (
            <>
              <div className={styles.drawerHeader}>
                <div className={styles.detailHeading}>
                  <Typography id="person-details" variant="h2" className={styles.detailTitle}>{selected.name}</Typography>
                  {shownDetails?.canMessage && (
                    <IconButton size="small" aria-label={`Message ${selected.name}`} onClick={() => { setMessageError(null); setMessageOpen(true); }}>
                      <ChatIcon />
                    </IconButton>
                  )}
                </div>
                <IconButton onClick={() => setSelectedPersonId(null)} aria-label="Close details"><CloseIcon /></IconButton>
              </div>
              <div className={styles.drawerBody}>
                <p className={styles.detailMeta}>
                  {roomKind(room)}
                  {seated ? '' : ' · Not seated yet'}
                  {selected.isYou ? ' · This is you' : ''}
                </p>
                {detailsLoading && <p className={common.muted} role="status">Loading details…</p>}
                {detailsError && <Alert severity="error" role="alert">{detailsError}</Alert>}
                {shownDetails && (
                  <dl className={styles.facts}>
                    {shownDetails.email && !(shownDetails.canEditEmail && room.canEdit) && (
                      <div>
                        <dt>Email</dt>
                        <dd>{emailLine(shownDetails.email)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Courses</dt>
                      <dd>{nameList(shownDetails.courses)}</dd>
                    </div>
                    <div>
                      <dt>Classes</dt>
                      <dd>{nameList(shownDetails.classes)}</dd>
                    </div>
                    {shownDetails.status !== null && (
                      <div>
                        <dt>Status</dt>
                        <dd>{shownDetails.status}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {shownDetails?.canEditEmail && room.canEdit && (
                  <form className={styles.emailForm} onSubmit={(event) => {
                    event.preventDefault();
                    const id = room.id;
                    const personId = selected.personId;
                    const email = emailDraft.trim();
                    void run(() => saveGuestEmail(id, personId, email), () => {
                      setEmailDraft(email);
                      setShownDetails((prev) => (prev ? { ...prev, email } : prev));
                      setDetailCache((prev) => {
                        const key = `${id}:${personId}`;
                        const current = prev[key];
                        if (!current) return prev;
                        return { ...prev, [key]: { ...current, email } };
                      });
                      setLive(email ? 'Email saved.' : 'Email cleared.');
                    });
                  }}>
                    <TextField
                      label="Email"
                      type="email"
                      fullWidth
                      value={emailDraft}
                      onChange={(event) => setEmailDraft(event.target.value)}
                      helperText="Only teachers can see a guest email."
                      slotProps={{ htmlInput: { maxLength: GUEST_EMAIL_MAX } }}
                    />
                    <Button type="submit" variant="contained" disabled={busy}>Save email</Button>
                  </form>
                )}
                {shownDetails && !shownDetails.canMessage && !selected.isYou && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    This person has no account, so you cannot use the in-app message.
                  </Alert>
                )}
                {room.canEdit && (
                  <form onSubmit={(event) => {
                    event.preventDefault();
                    const id = room.id;
                    const personId = selected.personId;
                    const text = draft.trim();
                    void run(() => saveNote(id, personId, text), () => {
                      setDraft(text);
                      setLive('Note saved.');
                      setLayouts((prev) => {
                        const current = prev[id];
                        if (!current) return prev;
                        const apply = <T extends { personId: string; note: string | null }>(person: T): T => (
                          person.personId === personId ? { ...person, note: text } : person
                        );
                        return { ...prev, [id]: { seats: current.seats.map(apply), unseated: current.unseated.map(apply) } };
                      });
                    });
                  }}>
                    <TextField
                      label="Note"
                      multiline
                      minRows={3}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      helperText="Only teachers can see notes."
                      slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
                    />
                    <div className={styles.actions}>
                      <Button type="submit" variant="contained" disabled={busy}>Save note</Button>
                    </div>
                    <div className={styles.actions}>
                      {seated && <Button type="button" variant="outlined" color="secondary" disabled={busy} onClick={() => unseat(selected.personId)}>Unseat</Button>}
                      {!seated && <Button type="button" variant="outlined" color="secondary" disabled={busy} onClick={() => place(selected)}>Seat</Button>}
                      {room.kind === 'meeting' && (
                        <Button type="button" variant="outlined" color="secondary" disabled={busy} onClick={() => {
                          const id = room.id;
                          const personId = selected.personId;
                          void run(() => removePerson(id, personId), () => {
                            clearLayout(id);
                            setSelectedPersonId(null);
                          });
                        }}>
                          Remove from meeting
                        </Button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </Drawer>
      )}
      <Dialog open={messageOpen && selected !== null} onClose={busy ? undefined : () => setMessageOpen(false)} fullWidth maxWidth="sm" aria-labelledby="room-message-title">
        {selected && (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!room) return;
            const id = room.id;
            const personId = selected.personId;
            const text = messageText;
            setBusy(true);
            setMessageError(null);
            void messagePerson(id, personId, text).then((result) => {
              setBusy(false);
              if (!result.ok) {
                setMessageError(result.message);
                return;
              }
              setMessageText('');
              setMessageOpen(false);
              setLive(result.message);
            });
          }}>
            <DialogTitle id="room-message-title">Message {selected.name}</DialogTitle>
            <DialogContent>
              <TextField
                label="Your message"
                multiline
                minRows={4}
                fullWidth
                autoFocus
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                helperText="They'll see it in their Moodle messages."
                slotProps={{ htmlInput: { maxLength: MESSAGE_MAX } }}
              />
              {messageError && <Alert severity="error" role="alert" className={styles.messageError}>{messageError}</Alert>}
            </DialogContent>
            <DialogActions>
              <Button type="button" color="inherit" disabled={busy} onClick={() => setMessageOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" endIcon={<SendIcon />} loading={busy} disabled={messageText.trim() === ''}>Send</Button>
            </DialogActions>
          </form>
        )}
      </Dialog>
      {ghost && <div className={styles.ghost} style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">{ghost.name}</div>}
    </LocalizationProvider>
  );
}
