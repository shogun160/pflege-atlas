// Minimal markdown → Lexical converter, scope-limited to the node types
// the Article RichText schema accepts: paragraph, text(bold/italic), link,
// list(ul/ol), heading(h3/h4), quote. Anything else is dropped silently.
//
// Design choice: hand-rolled rather than @lexical/markdown to avoid the
// DOM/editor-instance dependency of the official converter in a Node-only
// server-action context.

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;

type LexicalNode = Record<string, unknown>;

function makeText(text: string, format: number): LexicalNode {
  return {
    type: 'text',
    version: 1,
    text,
    format,
    detail: 0,
    mode: 'normal',
    style: '',
  };
}

function makeLink(url: string, children: LexicalNode[]): LexicalNode {
  return {
    type: 'link',
    version: 1,
    url,
    target: null,
    rel: null,
    fields: { url, newTab: false, linkType: 'custom' },
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

function makeParagraph(children: LexicalNode[]): LexicalNode {
  return {
    type: 'paragraph',
    version: 1,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
  };
}

function makeHeading(tag: 'h3' | 'h4', children: LexicalNode[]): LexicalNode {
  return {
    type: 'heading',
    version: 1,
    tag,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

function makeListItem(children: LexicalNode[], value: number): LexicalNode {
  return {
    type: 'listitem',
    version: 1,
    value,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

function makeList(listType: 'bullet' | 'number', items: LexicalNode[]): LexicalNode {
  return {
    type: 'list',
    version: 1,
    listType,
    start: 1,
    tag: listType === 'bullet' ? 'ul' : 'ol',
    children: items,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

function makeQuote(children: LexicalNode[]): LexicalNode {
  return {
    type: 'quote',
    version: 1,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

// --- Inline parser --------------------------------------------------------

interface InlineState {
  format: number;
}

function parseInline(text: string): LexicalNode[] {
  return parseInlineWithState(text, { format: 0 });
}

function parseInlineWithState(text: string, state: InlineState): LexicalNode[] {
  const out: LexicalNode[] = [];
  let i = 0;
  let buf = '';

  const flushText = () => {
    if (buf.length > 0) {
      out.push(makeText(buf, state.format));
      buf = '';
    }
  };

  while (i < text.length) {
    // Bold+italic ***...***
    if (text.startsWith('***', i)) {
      const end = text.indexOf('***', i + 3);
      if (end > -1) {
        flushText();
        const inner = parseInlineWithState(text.slice(i + 3, end), {
          format: state.format | FORMAT_BOLD | FORMAT_ITALIC,
        });
        out.push(...inner);
        i = end + 3;
        continue;
      }
    }
    // Bold **...**
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end > -1) {
        flushText();
        const inner = parseInlineWithState(text.slice(i + 2, end), {
          format: state.format | FORMAT_BOLD,
        });
        out.push(...inner);
        i = end + 2;
        continue;
      }
    }
    // Italic *...*  (single asterisk, but not preceded by another `*`)
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end > -1 && text[end - 1] !== '*' && text[end + 1] !== '*') {
        flushText();
        const inner = parseInlineWithState(text.slice(i + 1, end), {
          format: state.format | FORMAT_ITALIC,
        });
        out.push(...inner);
        i = end + 1;
        continue;
      }
    }
    // Link [label](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket > -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen > -1) {
          flushText();
          const label = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen);
          const labelNodes = parseInlineWithState(label, { format: state.format });
          out.push(makeLink(url, labelNodes));
          i = closeParen + 1;
          continue;
        }
      }
    }
    buf += text[i];
    i++;
  }
  flushText();
  return out;
}

// --- Block parser ---------------------------------------------------------

const HEADING_RE = /^(#{3,4})\s+(.+)$/;
const UNSUPPORTED_HEADING_RE = /^#{1,2}\s+/;       // h1, h2 — likely document title; drop
const HIGH_LEVEL_HEADING_RE = /^#{5,6}\s+/;        // h5, h6 — out of our supported range; drop
const UL_RE = /^[-*]\s+(.+)$/;
const OL_RE = /^\d+\.\s+(.+)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const HTML_RE = /^<.*>$/;
const IMAGE_RE = /^!\[.*\]\(.*\)\s*$/;

function isUnsupported(line: string): boolean {
  const t = line.trim();
  return HTML_RE.test(t) || IMAGE_RE.test(t);
}

function consumeListLines(
  lines: string[],
  start: number,
  re: RegExp,
): { items: string[]; consumed: number } {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(re);
    if (!m) break;
    items.push(m[1]);
    i++;
  }
  return { items, consumed: i - start };
}

function consumeQuoteLines(
  lines: string[],
  start: number,
): { text: string; consumed: number } {
  const parts: string[] = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(QUOTE_RE);
    if (!m) break;
    parts.push(m[1]);
    i++;
  }
  return { text: parts.join('\n'), consumed: i - start };
}

function consumeParagraphLines(
  lines: string[],
  start: number,
): { text: string; consumed: number } {
  const parts: string[] = [];
  let i = start;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === '') break;
    if (HEADING_RE.test(l) || UL_RE.test(l) || OL_RE.test(l) || QUOTE_RE.test(l)) break;
    if (isUnsupported(l)) break;
    parts.push(l);
    i++;
  }
  return { text: parts.join('\n'), consumed: i - start };
}

export function markdownToLexical(input: string): { root: LexicalNode } {
  const blocks: LexicalNode[] = [];
  const lines = input.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (isUnsupported(line)) {
      i++;
      continue;
    }
    if (UNSUPPORTED_HEADING_RE.test(line) || HIGH_LEVEL_HEADING_RE.test(line)) {
      i++;
      continue;
    }
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = level === 3 ? 'h3' : 'h4';
      blocks.push(makeHeading(tag, parseInline(headingMatch[2])));
      i++;
      continue;
    }
    if (UL_RE.test(line)) {
      const { items, consumed } = consumeListLines(lines, i, UL_RE);
      const lexItems = items.map((it, idx) => makeListItem(parseInline(it), idx + 1));
      blocks.push(makeList('bullet', lexItems));
      i += consumed;
      continue;
    }
    if (OL_RE.test(line)) {
      const { items, consumed } = consumeListLines(lines, i, OL_RE);
      const lexItems = items.map((it, idx) => makeListItem(parseInline(it), idx + 1));
      blocks.push(makeList('number', lexItems));
      i += consumed;
      continue;
    }
    if (QUOTE_RE.test(line)) {
      const { text, consumed } = consumeQuoteLines(lines, i);
      blocks.push(makeQuote([makeParagraph(parseInline(text))]));
      i += consumed;
      continue;
    }
    const { text, consumed } = consumeParagraphLines(lines, i);
    if (text.trim() !== '') {
      blocks.push(makeParagraph(parseInline(text)));
    }
    i += Math.max(consumed, 1);
  }

  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: blocks,
    },
  };
}
