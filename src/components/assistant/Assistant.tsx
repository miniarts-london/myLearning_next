'use client';

import { useRef, useState } from 'react';
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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/ErrorOutlineOutlined';
import SendIcon from '@mui/icons-material/Send';
import type { AgentEvent, ChatMessage } from '@/lib/agent/types';
import { AssistantText } from './AssistantText';
import styles from '@/css/Assistant.module.css';
import common from '@/css/common.module.css';

// One answer, in the order things happened: text, the tools it used, more text…
type Part = { kind: 'text'; text: string } | { kind: 'step'; id: string; label: string; status: 'running' | 'done' | 'error' };
interface Turn { question: string; parts: Part[]; error?: string; done: boolean }

const answerText = (t: Turn) => t.parts.filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text).join('');

// The assistant: a button on every page that opens a panel. It's an agent: for each message it
// decides which lookups it needs (deadlines, progress, searching a course…), shows each one as a
// step, and streams its answer.
export function Assistant() {
  const pathname = usePathname();
  const onCourse = /^\/courses\/\d+/.test(pathname);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [message, setMessage] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const busy = turns.at(-1)?.done === false;
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      updateLast((t) => ({ ...t, error: event.message }));
    } else if (event.type === 'done') {
      setRemaining(event.remaining);
    }
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setMessage('');
    // Earlier questions and answers go along too, so follow-ups ("and the next one?") make sense.
    const history: ChatMessage[] = turns.flatMap((t) => [
      { role: 'user' as const, content: t.question },
      ...(answerText(t).trim() ? [{ role: 'assistant' as const, content: answerText(t) }] : []),
    ]);
    setTurns((all) => [...all, { question, parts: [], done: false }]);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: question }], path: pathname }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        updateLast((t) => ({ ...t, error: body?.error ?? 'Sorry, something went wrong. Try again in a moment.' }));
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
      updateLast((t) => ({ ...t, error: "The assistant can't be reached right now." }));
    } finally {
      updateLast((t) => ({ ...t, done: true }));
      inputRef.current?.focus();
    }
  }

  const suggestions = [
    'What should I focus on this week?',
    'How am I doing in my courses?',
    ...(onCourse ? ['What are the main ideas of this course?'] : []),
  ];

  return (
    <>
      <Fab variant="extended" color="primary" onClick={() => setOpen(true)} aria-haspopup="dialog" className={styles.fab}>
        <AutoAwesomeIcon className={styles.fabIcon} /> Assistant
      </Fab>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}
        slotProps={{ paper: { 'aria-labelledby': 'assistant-title', className: styles.paper } as object }}
        // Following a link closes the panel; the conversation stays for next time.
        onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        <Stack direction="row" className={styles.header}>
          <Typography id="assistant-title" variant="h2" className={styles.title}>Assistant</Typography>
          <IconButton onClick={() => setOpen(false)} aria-label="Close"><CloseIcon /></IconButton>
        </Stack>
        <Typography variant="body2" className={styles.intro}>
          Ask about your courses, deadlines and progress. It looks things up in Moodle for you, and can make mistakes: check the links.
        </Typography>

        <Box className={styles.messages}>
          {turns.length === 0 && (
            <Stack spacing={1} className={styles.suggestions}>
              <Typography className={common.muted}>Try:</Typography>
              {suggestions.map((s) => <Chip key={s} label={s} onClick={() => void send(s)} variant="outlined" clickable />)}
            </Stack>
          )}
          {turns.map((t, i) => (
            <Box key={i} component="section" aria-label={`Message ${i + 1}`} className={styles.turn}>
              <Typography className={styles.question}>{t.question}</Typography>
              <Box aria-live={i === turns.length - 1 ? 'polite' : undefined} aria-busy={!t.done}>
                {t.parts.map((p, j) => p.kind === 'text'
                  ? <AssistantText key={j} text={p.text} />
                  : <Step key={p.id} label={p.label} status={p.status} />)}
                {!t.done && t.parts.length === 0 && <Typography className={common.muted}>Thinking…</Typography>}
                {t.error && <Alert severity="error" className={styles.error}>{t.error}</Alert>}
              </Box>
            </Box>
          ))}
        </Box>

        <Box component="form" onSubmit={(e) => { e.preventDefault(); void send(message); }} className={styles.form}>
          <TextField inputRef={inputRef} label="Message" value={message} onChange={(e) => setMessage(e.target.value)}
            multiline maxRows={4} variant="outlined" fullWidth slotProps={{ htmlInput: { maxLength: 2000 } }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(message); } }} />
          <Stack direction="row" className={styles.formFooter}>
            <Typography variant="body2" className={common.muted}>
              {remaining !== null && `${remaining} message${remaining === 1 ? '' : 's'} left today`}
            </Typography>
            <Button type="submit" variant="contained" endIcon={<SendIcon />} loading={busy} disabled={!message.trim()}>Send</Button>
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
