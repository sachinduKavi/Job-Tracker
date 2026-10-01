import sanitizeHtml from "sanitize-html";

/**
 * HTML sanitization for outgoing email bodies (server-side).
 *
 * Only basic formatting tags are allowed; scripts, styles, event handlers, iframes,
 * forms and non-http(s)/mailto links are removed. Applied before an email is stored
 * or sent, so the stored body is exactly what was delivered.
 * See docs/architecture/security.md#html-sanitization.
 */
export const EMAIL_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "blockquote", "span", "div", "hr", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    td: ["colspan", "rowspan", "align"],
    th: ["colspan", "rowspan", "align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, EMAIL_SANITIZE_OPTIONS).trim();
}
