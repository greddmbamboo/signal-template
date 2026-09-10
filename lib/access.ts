import { createRemoteJWKSet, jwtVerify } from "jose";
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyAccessToken(token: string | null, team: string, audience: string) {
  if (!token || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)) return null;
  try {
    const issuer = `https://${team}`;
    let keys = keySets.get(issuer);
    if (!keys) { keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)); keySets.set(issuer, keys); }
    const { payload } = await jwtVerify(token, keys, { issuer, audience, algorithms: ["RS256"], requiredClaims: ["sub", "email", "exp", "iat"] });
    if (payload.type !== "app" || typeof payload.sub !== "string" || !payload.sub || typeof payload.email !== "string" || !payload.email) return null;
    return { id: payload.sub, email: payload.email, displayName: payload.email };
  } catch { return null; }
}
