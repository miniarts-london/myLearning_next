import { Fragment } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import styles from '@/css/AssistantText.module.css';

// Renders the assistant's answer from a small, safe subset of Markdown: paragraphs, "- " and
// "1. " lists, **bold**, and [links](/courses/…). Never as HTML. Links must point inside this app
// (start with "/"); anything else is shown as plain text, so a link in course content can't
// send learners to another site.

export function isAppLink(href: string): boolean {
  return /^\/(?!\/)[\w\-./?=&#%]*$/.test(href);
}

const INLINE = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\))/g;

export function renderInline(text: string, keyPrefix = ''): React.ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}${i}`;
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={key}>{bold[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) return isAppLink(link[2]) ? <Link key={key} href={link[2]}>{link[1]}</Link> : <Fragment key={key}>{link[1]}</Fragment>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] };

export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const last = blocks.at(-1);
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      const item = (bullet ?? numbered)![1];
      if (last?.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (!line.trim()) {
      blocks.push({ kind: 'p', lines: [] }); // A blank line ends the paragraph
    } else if (last?.kind === 'p') {
      last.lines.push(line);
    } else {
      blocks.push({ kind: 'p', lines: [line] });
    }
  }
  return blocks.filter((b) => (b.kind === 'p' ? b.lines.length > 0 : b.items.length > 0));
}

export function AssistantText({ text }: { text: string }) {
  return (
    <Box className={styles.text}>
      {toBlocks(text).map((block, b) => block.kind === 'p' ? (
        <Typography key={b} component="p">
          {block.lines.map((line, l) => <Fragment key={l}>{l > 0 && <br />}{renderInline(line, `${b}-${l}-`)}</Fragment>)}
        </Typography>
      ) : (
        <Box key={b} component={block.kind}>
          {block.items.map((item, i) => <li key={i}><Typography component="span">{renderInline(item, `${b}-${i}-`)}</Typography></li>)}
        </Box>
      ))}
    </Box>
  );
}
