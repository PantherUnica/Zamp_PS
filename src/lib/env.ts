import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return v;
}

export const serverEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  openaiKey: () => required("OPENAI_API_KEY"),
  openaiModel: () => process.env.OPENAI_MODEL || "gpt-5.4-mini",
  gmailUser: () => process.env.GMAIL_USER || "",
  gmailPassword: () => (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, ""),
  emailFromName: () => process.env.EMAIL_FROM_NAME || "Vendor Onboarding",
  /** Public base URL used in email links. Falls back to Vercel's production URL. */
  appUrl: () =>
    (process.env.APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
      "http://localhost:3000").replace(/\/$/, ""),
  linkValidityDays: () => Number(process.env.MAGIC_LINK_DAYS || 14),
};

export const STORAGE_BUCKET = "vendor-documents";
