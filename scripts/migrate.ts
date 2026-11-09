// Applies supabase/migrations/*.sql to the database in SUPABASE_DB_URL.
// Usage: npm run db:migrate   (reads .env.local)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set (Supabase → Settings → Database → Connection string).");
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    process.stdout.write(`Applying ${file} … `);
    await client.query(readFileSync(join(dir, file), "utf8"));
    console.log("ok");
  }
  await client.end();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
