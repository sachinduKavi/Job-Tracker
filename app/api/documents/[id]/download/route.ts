import { isAuthenticated } from "@/lib/auth/session";
import { getDocumentWithContent } from "@/lib/documents/service";
import { isAppError } from "@/lib/errors";

/**
 * Authenticated document download. Files live outside public/, so this handler is the
 * only way to read them. `?inline=1` displays PDFs in the browser instead of downloading.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/documents/[id]/download">) {
  if (!(await isAuthenticated())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const { document, content } = await getDocumentWithContent(id);
    const inline = new URL(request.url).searchParams.get("inline") === "1" && document.mimeType === "application/pdf";
    const filename = encodeURIComponent(document.originalFilename);
    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(content.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") return Response.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
