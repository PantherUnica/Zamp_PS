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
  reviewerEmails: () =>
    (process.env.REVIEWER_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
};

export const STORAGE_BUCKET = "vendor-documents";
