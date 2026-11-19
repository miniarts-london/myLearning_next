'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Drawer from '@mui/material/Drawer';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/ErrorOutlineOutlined';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import type { AgentEvent, ChatMessage } from '@/lib/agent/types';
import { AssistantIcon } from './AssistantIcon';
import { AssistantText } from './AssistantText';
import styles from '@/css/Assistant.module.css';
import common from '@/css/common.module.css';

// The assistant's horse: the name shown in the panel heading.
const ASSISTANT_NAME = 'Christopher Columbus II';

// One answer, in the order things happened: text, the tools it used, more text…
type Part = { kind: 'text'; text: string } | { kind: 'step'; id: string; label: string; status: 'running' | 'done' | 'error' };
// `stopped`: the learner pressed Stop; whatever had arrived stays. `retryable`: "Try again" may help.
interface Turn { question: string; parts: Part[]; error?: string; retryable?: boolean; stopped?: boolean; done: boolean }

const answerText = (t: Turn) => t.parts.filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text).join('');

// An earlier answer as it goes back in the history. Tool results are left out to keep requests
// small, so a note lists the lookups it made; otherwise the assistant thinks it made the answer up.
function historyAnswer(t: Turn) {
  const lookups = t.parts.filter((p) => p.kind === 'step' && p.status === 'done').map((p) => (p as { label: string }).label);
  return lookups.length ? `[Looked up: ${lookups.join(', ')}]\n${answerText(t)}` : answerText(t);
}

// The assistant: a button on every page that opens a panel. It's an agent: for each message it
// decides which lookups it needs (deadlines, progress, searching a course…), shows each one as a
// step, and streams its answer.
// `teaching`: ids of the courses this user teaches, so the suggestions fit a teacher.
export function Assistant({ teaching }: { teaching: number[] }) {
  const pathname = usePathname();
  const courseId = Number(/^\/courses\/(\d+)/.exec(pathname)?.[1]) || null;
  const onCourse = courseId !== null;
  // On a course page, their role in that course; elsewhere, whether they teach any course.
  const asTeacher = onCourse ? teaching.includes(courseId) : teaching.length > 0;
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [message, setMessage] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const busy = turns.at(-1)?.done === false;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  // Follow the answer as it grows, unless they've scrolled up to reread something.
  const stickRef = useRef(true);

  useEffect(() => () => abortRef.current?.abort(), []); // Leaving the page stops the answer

  useLayoutEffect(() => {
    const box = messagesRef.current;
    if (box && stickRef.current) box.scrollTop = box.scrollHeight;
  }, [turns, open]);

  function onScroll() {
    const box = messagesRef.current;
    if (box) stickRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  }

  function stop() {
    abortRef.current?.abort();
  }

  const updateLast = (patch: (t: Turn) => Turn) => setTurns((all) => [...all.slice(0, -1), patch(all.at(-1)!)]);

  function apply(event: AgentEvent) {
    if (event.type === 'text') {
      updateLast((t) => {
        const last = t.parts.at(-1);
        return last?.kind === 'text'
          ? { ...t, parts: [...t.parts.slice(0, -1), { kind: 'text', text: last.text + event.text }] }
          : { ...t, parts: [...t.parts, { kind: 'text', text: event.text }] };
      });
    } else if (event.type === 'step') {
      updateLast((t) => {
        const exists = t.parts.some((p) => p.kind === 'step' && p.id === event.id);
        const step: Part = { kind: 'step', id: event.id, label: event.label, status: event.status };
        return { ...t, parts: exists ? t.parts.map((p) => (p.kind === 'step' && p.id === event.id ? step : p)) : [...t.parts, step] };
      });
    } else if (event.type === 'error') {
      updateLast((t) => ({ ...t, error: event.message, retryable: true }));
    } else if (event.type === 'done') {
      setRemaining(event.remaining);
    }
  }

  function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setMessage('');
    void ask(question, turns);
  }

  // Ask again after an error. The failed attempt is dropped, so it isn't sent as history.
  function retry() {
    const failed = turns.at(-1);
    if (!failed || busy) return;
    const earlier = turns.slice(0, -1);
    setTurns(earlier);
    void ask(failed.question, earlier);
  }

  async function ask(question: string, earlier: Turn[]) {
    // Earlier questions and answers go along too, so follow-ups ("and the next one?") make sense.
    const history: ChatMessage[] = earlier.flatMap((t) => [
      { role: 'user' as const, content: t.question },
      ...(answerText(t).trim() ? [{ role: 'assistant' as const, content: historyAnswer(t) }] : []),
    ]);
    const controller = new AbortController();
    abortRef.current = controller;
    stickRef.current = true;
    setTurns((all) => [...all, { question, parts: [], done: false }]);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: question }], path: pathname }),
        // Stop cancels the request; the server sees that and stops asking Claude.
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        // Trying again won't help if they're logged out, out of messages, or the message is too long.
        const retryable = response.status >= 500 && response.status !== 503;
        updateLast((t) => ({ ...t, error: body?.error ?? 'Sorry, something went wrong. Try again in a moment.', retryable }));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.filter(Boolean).forEach((line) => apply(JSON.parse(line) as AgentEvent));
        if (done) break;
      }
    } catch {
      if (controller.signal.aborted) updateLast((t) => ({ ...t, stopped: true }));
      else updateLast((t) => ({ ...t, error: "The assistant can't be reached right now.", retryable: true }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      updateLast((t) => ({ ...t, done: true }));
      inputRef.current?.focus();
    }
  }

  // Teachers' questions stick to what the assistant can look up: course content and structure.
  const suggestions = asTeacher
    ? onCourse
      ? ['What does this course cover, section by section?', 'Which assignments and quizzes are in this course?']
      : ['Summarise what each of my courses covers', 'Which assignments are set in my courses?']
    : [
      'What should I focus on this week?',
      'How am I doing in my courses?',
      ...(onCourse ? ['What are the main ideas of this course?'] : []),
    ];

  return (
    <>
      <Fab variant="extended" color="primary" onClick={() => setOpen(true)} aria-haspopup="dialog" className={styles.fab}>
        <AssistantIcon className={styles.fabIcon} motion="idle" data-assistant-fab-icon /> Assistant
      </Fab>

      <Drawer anchor="right" open={open}
        // While an answer is coming, Esc stops it; otherwise it closes the panel.
        onClose={(_, reason) => { if (reason === 'escapeKeyDown' && busy) stop(); else setOpen(false); }}
        slotProps={{ paper: { 'aria-labelledby': 'assistant-title', className: styles.paper } as object }}
        // Following a link closes the panel; the conversation stays for next time.
        onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        <Stack direction="row" className={styles.header}>
          <Typography id="assistant-title" variant="h2" className={styles.title}>
            <AssistantIcon className={styles.titleIcon} motion={busy ? 'busy' : 'idle'} aria-hidden /> Assistant
            <span className={styles.name}>({ASSISTANT_NAME})</span>
          </Typography>
          <IconButton onClick={() => setOpen(false)} aria-label="Close"><CloseIcon /></IconButton>
        </Stack>
        <Typography variant="body2" className={styles.intro}>
          Ask about your courses, deadlines and progress. It looks things up in Moodle for you, and can make mistakes: check the links.
        </Typography>

        <Box ref={messagesRef} onScroll={onScroll} className={styles.messages}>
          {turns.length === 0 && (
            <Stack spacing={1} className={styles.suggestions}>
              <Typography className={common.muted}>Try:</Typography>
              {suggestions.map((s) => <Chip key={s} label={s} onClick={() => send(s)} variant="outlined" clickable />)}
            </Stack>
          )}
          {turns.map((t, i) => {
            const last = i === turns.length - 1;
            return (
              <Box key={i} component="section" aria-label={`Message ${i + 1}`} className={styles.turn}>
                <Typography className={styles.question}>{t.question}</Typography>
                <Box aria-live={last ? 'polite' : undefined} aria-busy={!t.done}>
                  {t.parts.map((p, j) => p.kind === 'text'
                    // Only the text still arriving gets the caret and the half-markup trimming.
                    ? <AssistantText key={j} text={p.text} streaming={!t.done && j === t.parts.length - 1} />
                    : <Step key={p.id} label={p.label} status={p.status} />)}
                  {!t.done && t.parts.length === 0 && <Typography className={common.muted}>Thinking…</Typography>}
                  {t.stopped && <Typography variant="body2" className={common.muted}>Stopped.</Typography>}
                  {t.error && (
                    <Alert severity="error" className={styles.error}
                      action={last && t.retryable && <Button color="inherit" size="small" onClick={retry}>Try again</Button>}>
                      {t.error}
                    </Alert>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box component="form" onSubmit={(e) => { e.preventDefault(); send(message); }} className={styles.form}>
          <TextField inputRef={inputRef} label="Message" value={message} onChange={(e) => setMessage(e.target.value)}
            multiline maxRows={4} variant="outlined" fullWidth slotProps={{ htmlInput: { maxLength: 2000 } }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(message); } }} />
          <Stack direction="row" className={styles.formFooter}>
            <Typography variant="body2" className={common.muted}>
              {remaining !== null && `${remaining} message${remaining === 1 ? '' : 's'} left today`}
            </Typography>
            {busy
              ? <Button type="button" variant="outlined" endIcon={<StopIcon />} onClick={stop}>Stop</Button>
              : <Button type="submit" variant="contained" endIcon={<SendIcon />} disabled={!message.trim()}>Send</Button>}
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}

// One lookup the assistant made, e.g. "Checking your deadlines".
function Step({ label, status }: { label: string; status: 'running' | 'done' | 'error' }) {
  return (
    <Stack direction="row" spacing={1} className={status === 'error' ? `${styles.step} ${styles.stepError}` : styles.step}>
      {status === 'running' ? <CircularProgress size={14} color="inherit" aria-hidden />
        : status === 'done' ? <CheckIcon fontSize="small" aria-hidden /> : <ErrorIcon fontSize="small" aria-hidden />}
      <Typography variant="body2">
        {label}{status === 'running' ? '…' : ''}
        {status === 'error' && <span className="visually-hidden"> (failed)</span>}
      </Typography>
    </Stack>
  );
}
