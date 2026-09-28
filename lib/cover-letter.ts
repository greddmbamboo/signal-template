import { env } from "cloudflare:workers";
import type { Job, Profile } from "./model";
import { generateCoverLetterWithKey } from "./cover-letter-core";

export function generateCoverLetter(job: Job, profile: Profile, regenerationToken = "", previousDraft = "") {
  const apiKey = (env as Cloudflare.Env & { OPENAI_API_KEY?: string }).OPENAI_API_KEY || "";
  if (env.GENERATION_ENABLED === "false") throw new Error("OPENAI_API_KEY_MISSING");
  return generateCoverLetterWithKey(job, profile, apiKey, regenerationToken, previousDraft);
}
