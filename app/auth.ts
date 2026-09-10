import { headers } from "next/headers";
import { env } from "cloudflare:workers";
import { verifyAccessToken } from "../lib/access";
export async function getUser() {
  return verifyAccessToken((await headers()).get("cf-access-jwt-assertion"), env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
}
