'use client';

import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';

interface Source { n: number; cmid: number; title: string; href: string }
interface Turn { question: string; answer: string; sources: Source[]; error?: string; done: boolean }

// "Ask this course": a panel that answers questions from this course's own content,
// with links to the activities the answer came from. Answers stream in as they're written.
export function AskCourse() {
  const { id } = useParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const busy = turns.at(-1)?.done === false;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: (t: Turn) => Turn) => setTurns((all) => [...all.slice(0, -1), patch(all.at(-1)!)]);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion('');
    setTurns((all) => [...all, { question: q, answer: '', sources: [], done: false }]);
    try {
      const response = await fetch(`/api/courses/${id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        update((t) => ({ ...t, error: body?.error ?? 'Sorry, something went wrong. Try again in a moment.', done: true }));
        return;
      }
      // Read the stream line by line: each line is one JSON event.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === 'sources') {
            setRemaining(event.remaining);
            update((t) => ({ ...t, sources: event.sources }));
          } else if (event.type === 'text') {
            update((t) => ({ ...t, answer: t.answer + event.text }));
          } else if (event.type === 'error') {
            update((t) => ({ ...t, error: event.message }));
          }
        }
        if (done) break;
      }
      update((t) => ({ ...t, done: true }));
    } catch {
      update((t) => ({ ...t, error: "Ask this course can't be reached right now.", done: true }));
    } finally {
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} color="secondary" size="small" startIcon={<AutoAwesomeIcon />}
        aria-haspopup="dialog" sx={{ mb: 2 }}>
        Ask this course
      </Button>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}
        slotProps={{ paper: { 'aria-labelledby': 'ask-title', sx: { width: 'min(440px, 100vw)', display: 'flex' } } as object }}
        // Following a source link closes the panel; the conversation is kept for next time.
        onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2.5, pt: 2 }}>
          <Typography id="ask-title" variant="h2" sx={{ fontSize: '1.25rem' }}>Ask this course</Typography>
          <IconButton onClick={() => setOpen(false)} aria-label="Close"><CloseIcon /></IconButton>
        </Stack>
        <Typography variant="body2" sx={{ px: 2.5, pb: 1.5, color: 'text.secondary' }}>
          Answers come only from this course&apos;s content, written by AI. Check the linked activities: AI can make mistakes.
        </Typography>

        {/* The conversation. New answers are announced politely as they finish. */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1, borderTop: 1, borderColor: 'divider' }}>
          {turns.length === 0 && (
            <Typography sx={{ color: 'text.secondary', mt: 2 }}>
              For example: &ldquo;What are the main points of this course?&rdquo; or &ldquo;When is my assignment due?&rdquo;
            </Typography>
          )}
          {turns.map((t, i) => (
            <Box key={i} component="section" aria-label={`Question ${i + 1}`} sx={{ my: 2 }}>
              <Typography sx={{ fontWeight: 600, bgcolor: 'grey.100', px: 1.5, py: 1, mb: 1 }}>{t.question}</Typography>
              <Box aria-live={i === turns.length - 1 ? 'polite' : undefined} aria-busy={!t.done}>
                {t.answer && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{t.answer}</Typography>}
                {!t.done && !t.answer && <Typography sx={{ color: 'text.secondary' }}>Looking through the course…</Typography>}
                {t.error && <Alert severity="error" sx={{ mt: 1 }}>{t.error}</Alert>}
              </Box>
              {t.done && t.sources.length > 0 && (
                <Box component="nav" aria-label={`Sources for question ${i + 1}`} sx={{ mt: 1 }}>
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>From the course</Typography>
                  <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                    {t.sources.map((s) => (
                      <li key={s.cmid}><Link href={s.href}>[{s.n}] {s.title}</Link></li>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>

        <Box component="form" onSubmit={(e) => { e.preventDefault(); void ask(); }}
          sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <TextField inputRef={inputRef} label="Your question" value={question} onChange={(e) => setQuestion(e.target.value)}
            multiline maxRows={4} variant="outlined" fullWidth
            slotProps={{ htmlInput: { maxLength: 500 } }}
            // Enter sends; Shift+Enter starts a new line.
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); } }} />
          <Stack direction="row" sx={{ mt: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {remaining !== null && `${remaining} question${remaining === 1 ? '' : 's'} left today`}
            </Typography>
            <Button type="submit" variant="contained" endIcon={<SendIcon />} loading={busy} disabled={!question.trim()}>Ask</Button>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}
