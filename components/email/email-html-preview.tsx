/**
 * Renders email HTML inside a fully sandboxed iframe (no scripts, no same-origin
 * access, no forms). Combined with server-side sanitization this is defence in depth:
 * even unsanitized HTML could not run code in the app's origin.
 */
export function EmailHtmlPreview({ html, title = "Email preview", className }: { html: string; title?: string; className?: string }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#18181b;background:#fff;margin:16px;word-wrap:break-word}
    a{color:#4f46e5}p{margin:0 0 12px}
  </style></head><body>${html}</body></html>`;
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={doc}
      className={className ?? "h-80 w-full rounded-lg border bg-white"}
    />
  );
}
