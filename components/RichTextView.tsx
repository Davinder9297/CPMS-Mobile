import { Fragment, type ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';

import { decodeEntities, looksLikeHtml, stripScripts } from '@/utils/richText';

// Renders the constrained HTML that Quill (the web app's RichTextEditor —
// see CPMS/frontend/src/components/RichTextEditor.jsx's toolbar config)
// actually produces: <p>, <h1>/<h2>, <strong>/<b>, <em>/<i>, <u>,
// <s>/<strike>, <ol>/<ul>/<li>, <a>, <br>, and <span style="color:...;
// background-color:...">. This is NOT a general HTML parser.
//
// Why not a library: react-native-render-html hasn't been published since
// 2022, and this app runs React 19.2.3 / RN 0.86 (both far newer than that
// library was ever tested against) — a small purpose-built renderer for a
// known, bounded tag set is safer than an abandoned dependency, and lighter
// than embedding a WebView just to show some formatted text.

interface RichTextViewProps {
  html: string | null | undefined;
  style?: TextStyle;
  emptyText?: string;
}

type Node =
  | { type: 'text'; value: string }
  | { type: 'element'; tag: string; attrs: Record<string, string>; children: Node[] };

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(attrString))) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return attrs;
}

const VOID_TAGS = new Set(['br', 'hr', 'img']);

// Small recursive-descent parser over a flat token stream (open tag / close
// tag / text run) — sufficient for well-formed Quill output.
function parseHtml(html: string): Node[] {
  const tokenRe = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  const root: Node[] = [];
  const stack: { tag: string; children: Node[] }[] = [{ tag: '', children: root }];
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(html))) {
    const [full, tag, attrString, text] = m;
    if (text !== undefined) {
      const decoded = decodeEntities(text);
      if (decoded) stack[stack.length - 1].children.push({ type: 'text', value: decoded });
      continue;
    }
    const isClosing = full.startsWith('</');
    const tagLower = (tag ?? '').toLowerCase();

    if (isClosing) {
      // Pop back to (and including) the matching open tag, if present.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tagLower) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const node: Node = { type: 'element', tag: tagLower, attrs: parseAttrs(attrString ?? ''), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!VOID_TAGS.has(tagLower) && !full.endsWith('/>')) {
      stack.push({ tag: tagLower, children: node.children });
    }
  }

  return root;
}

function parseInlineStyle(styleAttr: string | undefined): TextStyle {
  if (!styleAttr) return {};
  const style: TextStyle = {};
  for (const decl of styleAttr.split(';')) {
    const [prop, value] = decl.split(':').map((s) => s?.trim());
    if (!prop || !value) continue;
    if (prop === 'color') style.color = value;
    if (prop === 'background-color') style.backgroundColor = value;
  }
  return style;
}

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'li']);

type ElementNode = Extract<Node, { type: 'element' }>;

// An empty Quill paragraph is <p><br></p>: it should render as one blank line, not two.
const isBlankBlock = (children: Node[]) =>
  children.length === 1 && children[0].type === 'element' && children[0].tag === 'br';

// Line breaks are inserted BETWEEN blocks (never after the last one), so there is no
// stray empty line at the bottom of the text.
function renderNodes(nodes: Node[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let afterBlock = false;
  const breakLine = () => {
    if (out.length > 0 && out[out.length - 1] !== '\n') out.push('\n');
  };
  const startInline = () => {
    if (afterBlock) {
      out.push('\n');
      afterBlock = false;
    }
  };

  nodes.forEach((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.type === 'text') {
      startInline();
      out.push(<Fragment key={key}>{node.value}</Fragment>);
      return;
    }

    const { tag, attrs, children } = node;

    // Quill 2 puts an empty <span class="ql-ui"> marker inside list items.
    if (tag === 'span' && /\bql-ui\b/.test(attrs.class ?? '')) return;

    if (tag === 'br') {
      afterBlock = false;
      out.push('\n');
      return;
    }

    if (tag === 'ol' || tag === 'ul') {
      // Quill 2 stores EVERY list as <ol> and marks each <li data-list="bullet|ordered">.
      let counter = 0;
      children.forEach((child, i) => {
        if (child.type !== 'element' || child.tag !== 'li') return;
        const item = child as ElementNode;
        const kind = item.attrs['data-list'] ?? (tag === 'ol' ? 'ordered' : 'bullet');
        counter = kind === 'ordered' ? counter + 1 : 0;
        const indent = Number(/ql-indent-(\d+)/.exec(item.attrs.class ?? '')?.[1] ?? 0);
        const prefix = `${'    '.repeat(indent)}${kind === 'ordered' ? `${counter}. ` : '• '}`;
        breakLine();
        out.push(
          <Text key={`${key}-li-${i}`}>
            {prefix}
            {renderNodes(item.children, `${key}-li-${i}`)}
          </Text>
        );
      });
      afterBlock = true;
      return;
    }

    let childStyle: TextStyle = {};
    if (tag === 'strong' || tag === 'b') childStyle.fontWeight = '700';
    if (tag === 'em' || tag === 'i') childStyle.fontStyle = 'italic';
    if (tag === 'u') childStyle.textDecorationLine = 'underline';
    if (tag === 's' || tag === 'strike') childStyle.textDecorationLine = 'line-through';
    if (tag === 'h1') childStyle = { ...childStyle, fontWeight: '700', fontSize: 20 };
    if (tag === 'h2') childStyle = { ...childStyle, fontWeight: '700', fontSize: 17 };
    if (tag === 'h3') childStyle = { ...childStyle, fontWeight: '700', fontSize: 15 };
    if (tag === 'a') childStyle = { ...childStyle, color: '#2563EB', textDecorationLine: 'underline' };
    if (tag === 'span') childStyle = { ...childStyle, ...parseInlineStyle(attrs.style) };

    if (BLOCK_TAGS.has(tag)) {
      breakLine();
      out.push(
        <Text key={key} style={childStyle}>
          {renderNodes(isBlankBlock(children) ? [] : children, key)}
        </Text>
      );
      afterBlock = true;
      return;
    }

    startInline();
    out.push(
      <Text key={key} style={childStyle}>
        {renderNodes(children, key)}
      </Text>
    );
  });

  return out;
}

export default function RichTextView({ html, style, emptyText = '—' }: RichTextViewProps) {
  const value = stripScripts(html ?? '');
  // Values without any tag (older rows, or text typed in the app) are shown verbatim,
  // so a plain "a < b" is never mistaken for markup.
  if (!looksLikeHtml(value)) {
    return <Text style={style}>{value.trim() ? value : emptyText}</Text>;
  }

  const visible = decodeEntities(value.replace(/<[^>]+>/g, '')).trim();
  if (!visible) {
    return <Text style={style}>{emptyText}</Text>;
  }

  return <Text style={style}>{renderNodes(parseHtml(value), 'root')}</Text>;
}
