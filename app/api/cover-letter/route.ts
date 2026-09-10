import { z } from "zod";
import { getUser } from "../../auth";
import { getSql } from "../../../db";
import { generateCoverLetter } from "../../../lib/cover-letter";
import type { Job, Profile } from "../../../lib/model";
import { initialize } from "../../../lib/store";

const requestSchema = z.object({ id: z.string().min(1).max(250), regenerate: z.boolean().default(false) });
type JobRow = { id:string; payload:string; status:string; reason:string; cover_letter:string; linkedin_url:string; linkedin_id:string; first_seen:string; last_seen:string; active:number };

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 2000) return Response.json({ error: "The request is too long." }, { status: 413 });
    const input = requestSchema.parse(JSON.parse(raw));
    await initialize(user.id);
    const db = getSql();
    const row = await db.prepare("SELECT id,payload,status,reason,cover_letter,linkedin_url,linkedin_id,first_seen,last_seen,active FROM jobs WHERE owner = ? AND id = ?").bind(user.id,input.id).first<JobRow>();
    if (!row) return Response.json({ error: "Listing not found." }, { status: 404 });

    // Opening a saved letter never spends tokens or replaces the user's draft.
    if (!input.regenerate && row.cover_letter.trim()) return Response.json({ content: row.cover_letter, generated: false });

    const profileRow = await db.prepare("SELECT payload FROM preferences WHERE owner = ?").bind(user.id).first<{payload:string}>();
    const job = {...JSON.parse(row.payload),id:row.id,status:row.status,reason:row.reason,coverLetter:row.cover_letter,linkedinUrl:row.linkedin_url,linkedinId:row.linkedin_id,firstSeen:row.first_seen,lastSeen:row.last_seen,active:row.active} as Job;
    const content = await generateCoverLetter(job,JSON.parse(profileRow!.payload) as Profile);
    const saved = await db.prepare("UPDATE jobs SET cover_letter = ? WHERE owner = ? AND id = ?").bind(content,user.id,input.id).run();
    if (!saved.meta.changes) return Response.json({ error: "Listing not found." }, { status: 404 });
    return Response.json({ content, generated: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Please check the request." }, { status: 400 });
    if (error instanceof Error && error.message === "CANDIDATE_EVIDENCE_REQUIRED") return Response.json({ error: "Save your name, résumé, and approval to use your evidence in Preferences first." }, { status: 409 });
    if (error instanceof Error && error.message === "OPENAI_API_KEY_MISSING") return Response.json({ error: "Cover-letter generation is not configured yet." }, { status: 503 });
    if (error instanceof Error && error.message === "OPENAI_CREDITS_REQUIRED") return Response.json({ error: "OpenAI API credits are required before Signal can generate a cover letter." }, { status: 402 });
    console.error("cover letter route", error);
    return Response.json({ error: "The cover letter could not be generated. Your saved draft was not changed." }, { status: 502 });
  }
}
