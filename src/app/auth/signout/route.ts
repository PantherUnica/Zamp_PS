import { NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await authClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
