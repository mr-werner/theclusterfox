/* global process */
import { neon } from "@neondatabase/serverless";
import { createRemoteJWKSet, jwtVerify } from "jose";

// The Neon integration on Vercel names its variables with the store prefix.
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.THECLUSTERFOX_DATABASE_URL || null;
}

let sqlClient = null;
export function sql() {
  const url = databaseUrl();
  if (!url) return null;
  sqlClient ??= neon(url);
  return sqlClient;
}

function authBaseUrl() {
  const url =
    process.env.NEON_AUTH_BASE_URL ||
    process.env.THECLUSTERFOX_NEON_AUTH_BASE_URL ||
    process.env.VITE_NEON_AUTH_URL ||
    process.env.THECLUSTERFOX_VITE_NEON_AUTH_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

let jwks = null;

/**
 * The signed-in person behind a request, from its Neon Auth bearer token, or
 * null. A missing or bad token is not an error: the caller is just anonymous.
 */
export async function requestUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const base = authBaseUrl();
  if (!token || !base) return null;
  try {
    jwks ??= createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks);
    if (typeof payload.sub !== "string") return null;
    return { id: payload.sub, name: typeof payload.name === "string" ? payload.name : null };
  } catch {
    return null;
  }
}
