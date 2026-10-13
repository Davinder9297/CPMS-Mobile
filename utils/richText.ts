// Helpers for the rich-text (Quill) HTML that the web app's RichTextEditor stores in
// fields like task descriptions, incident summaries and appraisal comments.

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

// Named entities plus numeric ones (&#39; / &#x27;). Unknown names are left as-is.
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[name] ?? match;
  });
}

// Removes <script>/<style> elements together with their content, so their code never
// shows up as text (nothing is ever executed - this is a renderer, not a browser).
export function stripScripts(html: string): string {
  return html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
}

// True when the string contains at least one HTML tag. Plain-text values (older rows,
// or text typed in the mobile app) have none and must be shown exactly as written.
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/.test(value);
}

// HTML -> readable plain text (paragraph/list breaks kept), for putting stored rich
// text into a plain TextInput without showing the tags.
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  if (!looksLikeHtml(html)) return html;
  const text = stripScripts(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Plain text typed in the app -> the paragraph HTML the web editor produces, so the
// web app shows it with the same line breaks.
export function plainTextToHtml(text: string): string {
  if (!text.trim()) return '';
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split('\n')
    .map((line) => (line.trim() ? `<p>${escape(line)}</p>` : '<p><br></p>'))
    .join('');
}
