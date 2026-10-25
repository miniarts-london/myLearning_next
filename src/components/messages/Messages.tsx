'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import { listConversations, openConversation, sendToConversation, unreadCount } from '@/actions/messages';
import { MESSAGE_TEXT_MAX, messageTime, type ConversationSummary, type ConversationView } from '@/lib/messaging';
import styles from '@/css/Messages.module.css';

const UNREAD_EVERY_MS = 60_000; // How often the header badge checks for new messages
const OPEN_EVERY_MS = 10_000;   // How often an open conversation checks for replies

const now = () => Math.floor(Date.now() / 1000);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Runs `task` every `ms` while `active` and the tab is visible.
function useEvery(task: () => void, ms: number, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') task(); }, ms);
    return () => clearInterval(id);
  }, [task, ms, active]);
}

// Messages: a button in the header (with the number of unread conversations) that opens a panel
// listing your Moodle conversations; pick one to read it and reply. Everything goes through
// Moodle's own messaging, so it's the same conversation as on the Moodle site and in its app.
export function Messages() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState<string>();
  const [current, setCurrent] = useState<ConversationView | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const refreshUnread = useCallback(() => { void unreadCount().then(setUnread); }, []);
  const refreshList = useCallback(() => {
    void listConversations().then((r) => { setList(r.conversations); setListError(r.error); });
  }, []);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);
  useEvery(refreshUnread, UNREAD_EVERY_MS, true);
  useEffect(() => { if (open) refreshList(); }, [open, refreshList]);

  async function show(id: number) {
    setLoadingId(id);
    const r = await openConversation(id);
    setLoadingId(null);
    if (r.conversation) {
      setCurrent(r.conversation);
      refreshUnread();
      setList((l) => l?.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) ?? l);
    } else {
      setListError(r.error);
    }
  }

  const back = () => { setCurrent(null); refreshList(); };

  return (
    <>
      <IconButton onClick={() => setOpen(true)} aria-haspopup="dialog" color="inherit"
        aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}>
        <Badge badgeContent={unread} color="primary" max={99}><ChatIcon /></Badge>
      </IconButton>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}
        slotProps={{ paper: { 'aria-labelledby': 'messages-title', className: styles.paper } as object }}>
        {current ? (
          <Conversation conversation={current} onBack={back} onClose={() => setOpen(false)} onUpdate={setCurrent} />
        ) : (
          <>
            <header className={styles.header}>
              <Typography id="messages-title" variant="h2" className={styles.title}>Messages</Typography>
              <IconButton onClick={() => setOpen(false)} aria-label="Close messages"><CloseIcon /></IconButton>
            </header>
            <div className={styles.body}>
              {listError && <Alert severity="error" className={styles.alert}>{listError}</Alert>}
              {list === null ? (
                <div className={styles.loading}><CircularProgress size={24} aria-label="Loading your conversations" /></div>
              ) : list.length === 0 ? (
                <Typography className={styles.empty}>No messages yet. Teachers can write to you from the course&apos;s learner list, and replies arrive here.</Typography>
              ) : (
                <ul className={styles.list} aria-label="Conversations">
                  {list.map((c) => (
                    <li key={c.id}>
                      <button type="button" className={styles.item} onClick={() => void show(c.id)}
                        aria-label={`${c.name}${c.unread ? `, ${c.unread} unread` : ''}${c.lastText ? `. ${c.lastFromMe ? 'You' : 'Last message'}: ${c.lastText}` : ''}`}>
                        <Badge overlap="circular" variant="dot" color="success" invisible={!c.online}
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                          <Avatar className={styles.avatar}>{c.name === 'Personal space' ? '★' : initials(c.name)}</Avatar>
                        </Badge>
                        <span className={styles.itemText}>
                          <span className={styles.itemTop}>
                            <span className={c.unread ? `${styles.name} ${styles.unreadName}` : styles.name}>{c.name}</span>
                            {c.lastTime > 0 && <span className={styles.time}>{messageTime(c.lastTime, now())}</span>}
                          </span>
                          <span className={styles.snippet}>{c.lastFromMe && 'You: '}{c.lastText || 'No messages yet'}</span>
                        </span>
                        {loadingId === c.id ? <CircularProgress size={18} aria-hidden />
                          : c.unread > 0 && <span className={styles.count} aria-hidden>{c.unread}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}

// One conversation: the messages, newest at the bottom, and a box to reply.
function Conversation({ conversation: c, onBack, onClose, onUpdate }: {
  conversation: ConversationView;
  onBack: () => void;
  onClose: () => void;
  onUpdate: (c: ConversationView) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [sending, startSending] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message in view, and put the cursor in the reply box.
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [c.messages.length]);
  useEffect(() => { input.current?.focus(); }, [c.id]);

  // New replies arrive while the conversation is open.
  const poll = useCallback(() => {
    void openConversation(c.id).then((r) => { if (r.conversation && r.conversation.messages.length !== c.messages.length) onUpdate(r.conversation); });
  }, [c.id, c.messages.length, onUpdate]);
  useEvery(poll, OPEN_EVERY_MS, true);

  function send() {
    const message = text.trim();
    if (!message || sending) return;
    startSending(async () => {
      const r = await sendToConversation(c.id, message);
      if (r.message) {
        setText('');
        setError(undefined);
        onUpdate({ ...c, messages: [...c.messages, r.message] });
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <>
      <header className={styles.header}>
        <IconButton onClick={onBack} aria-label="Back to all conversations"><ArrowBackIcon /></IconButton>
        <Typography id="messages-title" variant="h2" className={`${styles.title} ${styles.grow}`}>{c.name}</Typography>
        <IconButton onClick={onClose} aria-label="Close messages"><CloseIcon /></IconButton>
      </header>

      {/* role="log": screen readers announce new messages as they arrive. */}
      <div className={styles.messages} role="log" aria-label={`Messages with ${c.name}`}>
        {c.messages.length === 0 && <Typography className={styles.empty}>No messages yet. Say hello!</Typography>}
        {c.messages.map((m) => (
          <div key={m.id} className={m.fromMe ? `${styles.bubble} ${styles.mine}` : styles.bubble}>
            <span className="visually-hidden">{m.sender}: </span>
            <p className={styles.bubbleText}>{m.text}</p>
            <span className={styles.bubbleTime}>{messageTime(m.time, now())}</span>
          </div>
        ))}
        <div ref={end} />
      </div>

      <form className={styles.reply} onSubmit={(e) => { e.preventDefault(); send(); }}>
        {error && <Alert severity="error" className={styles.alert}>{error}</Alert>}
        <TextField inputRef={input} label="Write a message" value={text} onChange={(e) => setText(e.target.value)}
          multiline maxRows={5} fullWidth variant="outlined" slotProps={{ htmlInput: { maxLength: MESSAGE_TEXT_MAX } }}
          helperText="Enter to send, Shift+Enter for a new line"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Button type="submit" variant="contained" endIcon={<SendIcon />} loading={sending} disabled={!text.trim()} className={styles.send}>
          Send
        </Button>
      </form>
    </>
  );
}
