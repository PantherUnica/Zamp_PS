import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status, headers: { "Cache-Control": "no-store" } });
}

export function fromError(err: unknown) {
  if (err instanceof ZodError) {
    return fail("Some fields are invalid", 422, err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error(err);
  return fail(message, 500);
}

export function isToken(t: string) {
  return /^[a-f0-9]{48}$/.test(t);
}

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100);
}
