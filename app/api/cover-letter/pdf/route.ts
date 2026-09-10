import { jsPDF } from "jspdf";
import { getUser } from "../../../auth";
import { getSql } from "../../../../db";
import { initialize } from "../../../../lib/store";
import type { Job } from "../../../../lib/model";

function pdfSafeText(value: string) {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function safeFilename(value: string) {
  return value
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140) || "cover-letter";
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  const form = await request.formData();
  const id = String(form.get("id") || "");
  const content = String(form.get("content") || "").trim();
  if (!id || id.length > 250 || !content || content.length > 20000) {
    return Response.json({ error: "The cover letter could not be exported." }, { status: 400 });
  }

  await initialize(user.id);
  const row = await getSql()
    .prepare("SELECT payload FROM jobs WHERE owner = ? AND id = ?")
    .bind(user.id, id)
    .first<{ payload: string }>();
  if (!row) return Response.json({ error: "Listing not found." }, { status: 404 });
  const job = JSON.parse(row.payload) as Pick<Job, "company" | "title">;

  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  pdf.setProperties({ title: `Cover letter - ${job.company} - ${job.title}` });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(24, 43, 66);

  const left = 72;
  const width = 468;
  const bottom = 720;
  const lineHeight = 16;
  let y = 70;
  for (const paragraph of pdfSafeText(content).split(/\n\s*\n/)) {
    for (const logicalLine of paragraph.split(/\n/)) {
      const lines = pdf.splitTextToSize(logicalLine.trim(), width) as string[];
      for (const line of lines) {
        if (y > bottom) {
          pdf.addPage();
          y = 70;
        }
        pdf.text(line, left, y);
        y += lineHeight;
      }
    }
    y += 8;
  }

  const filename = safeFilename(`${job.company}-${job.title}-cover-letter`);
  return new Response(pdf.output("arraybuffer"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
