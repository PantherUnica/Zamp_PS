import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { admin } from "@/lib/supabase/admin";
import { RunView, type RunPayload } from "@/components/run-view";

export const metadata: Metadata = { title: "Live run" };

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = admin();
  const { data: run } = await db
    .from("runs")
    .select("id, submission_id, version, trigger, status, recommendation, result, error, model, created_at, started_at, finished_at")
    .eq("id", id)
    .single();
  if (!run) notFound();
  const [{ data: stages }, { data: submission }] = await Promise.all([
    db.from("run_stages").select("key, label, position, status, summary, output, error, started_at, finished_at").eq("run_id", id).order("position"),
    db.from("submissions").select("id, ref, legal_name, country, status").eq("id", run.submission_id).single(),
  ]);
  const initial = { run, stages: stages ?? [], submission } as unknown as RunPayload;
  return <RunView initial={initial} />;
}
