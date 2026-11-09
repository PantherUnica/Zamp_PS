"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, inputClass } from "./ui";
import { fmtDate } from "./format";

export interface TaskItem {
  id: string;
  title: string;
  owner: "us" | "vendor";
  due_date: string | null;
  done: boolean;
  vendor?: { id: string; name: string } | null;
}

export function TaskList({ tasks, showVendor }: { tasks: TaskItem[]; showVendor?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  if (!tasks.length) return <p className="px-4 py-6 text-sm text-muted">No open follow-ups.</p>;
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const overdue = !t.done && t.due_date && t.due_date < today;
        return (
          <li key={t.id} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              aria-label={`Mark "${t.title}" done`}
              checked={t.done}
              disabled={pending === t.id}
              onChange={async (e) => {
                setPending(t.id);
                await fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: e.target.checked }) });
                setPending(null);
                router.refresh();
              }}
              className="mt-1 accent-[var(--color-accent)]"
            />
            <div className="min-w-0 flex-1">
              <div className={`text-sm ${t.done ? "text-muted line-through" : ""}`}>{t.title}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                <span>{t.owner === "vendor" ? "Vendor's action" : "Our action"}</span>
                {t.due_date && <span className={overdue ? "font-medium text-accent" : ""}>· due {fmtDate(t.due_date)}{overdue ? " · overdue" : ""}</span>}
                {showVendor && t.vendor && <Link href={`/vendors/${t.vendor.id}`} className="underline-offset-4 hover:underline">· {t.vendor.name}</Link>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AddTask({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendor_id: vendorId, title, due_date: due || null }) });
        setTitle("");
        setDue("");
        setBusy(false);
        router.refresh();
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a follow-up…" aria-label="New task" className={`${inputClass} h-8 sm:flex-1`} />
      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className={`${inputClass} h-8 sm:w-[150px]`} />
      <Button size="sm" disabled={busy || !title.trim()}>Add</Button>
    </form>
  );
}
