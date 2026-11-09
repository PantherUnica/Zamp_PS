import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { listEmails } from "@/lib/data";
import { emailConfigured } from "@/lib/email/mailer";
import { EmailComposer, type EmailView } from "@/components/email-composer";
import { Chip, Empty, PageHeader, Panel, StatusChip } from "@/components/ui";
import { EMAIL_KIND_LABEL, fmtDateTime } from "@/components/format";

export const metadata: Metadata = { title: "Emails" };

const TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts to review" },
  { key: "failed", label: "Failed" },
  { key: "sent", label: "Sent" },
];

export default async function Emails({ searchParams }: PageProps<"/emails">) {
  await requireStaff();
  const sp = await searchParams;
  const tab = typeof sp.status === "string" ? sp.status : "all";
  const emails = await listEmails(tab);
  const actionable = emails.filter((e) => e.status === "draft" || e.status === "failed");
  const rest = emails.filter((e) => e.status !== "draft" && e.status !== "failed");
  const configured = emailConfigured();
  return (
    <>
      <PageHeader title="Emails" meta="Every message the system, the agent or your team sends, with its delivery status" />
      {!configured && (
        <div className="mb-6 rounded-md border border-accent-line bg-accent-soft px-4 py-3 text-sm text-accent">
          Email delivery is not configured. Add <span className="mono">GMAIL_USER</span> and <span className="mono">GMAIL_APP_PASSWORD</span> to the environment. Until then, emails are recorded here as failed and can be retried.
        </div>
      )}
      <nav className="mb-4 flex gap-1 overflow-x-auto" aria-label="Filter emails">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === "all" ? "/emails" : `/emails?status=${t.key}`} className={`t-colors whitespace-nowrap rounded-md px-3 py-1 text-sm ${tab === t.key ? "bg-ink font-medium text-white" : "text-ink-2 hover:bg-accent-soft/70"}`}>{t.label}</Link>
        ))}
      </nav>
      {actionable.length > 0 && (
        <div className="mb-6 flex flex-col gap-4">
          {actionable.map((e) => (
            <div key={e.id}>
              {e.vendors && <div className="mb-1.5 text-sm"><Link href={`/vendors/${e.vendor_id}`} className="font-medium underline-offset-4 hover:underline">{e.vendors.company_name}</Link> <span className="mono text-xs text-muted">{e.vendors.ref}</span></div>}
              <EmailComposer email={e as EmailView} highlight={e.status === "draft"} />
            </div>
          ))}
        </div>
      )}
      {(tab === "all" || tab === "sent") && (
        <Panel>
          {rest.length === 0 ? (
            <Empty title="No emails here yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2 font-normal">Email</th>
                    <th className="px-4 py-2 font-normal">To</th>
                    <th className="px-4 py-2 font-normal">Vendor</th>
                    <th className="px-4 py-2 font-normal">Status</th>
                    <th className="px-4 py-2 text-right font-normal">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rest.map((e) => (
                    <tr key={e.id} className="align-top">
                      <td className="max-w-[360px] px-4 py-2.5">
                        <details>
                          <summary className="truncate font-medium">{e.subject}</summary>
                          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-ink-2">{e.body_text}</pre>
                          {e.provider_message_id && <p className="mono mt-1 text-[11px] text-muted">{e.provider_message_id}</p>}
                        </details>
                        <span className="text-xs text-muted">{EMAIL_KIND_LABEL[e.kind]}{e.generated_by === "agent" ? " · agent-written" : e.generated_by === "staff" ? " · by staff" : ""}</span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-2">{e.to_email}<div className="text-xs text-muted">{e.audience === "staff" ? "Team" : "Vendor"}</div></td>
                      <td className="px-4 py-2.5">{e.vendors ? <Link href={`/vendors/${e.vendor_id}`} className="underline-offset-4 hover:underline">{e.vendors.company_name}</Link> : <span className="text-muted">-</span>}</td>
                      <td className="px-4 py-2.5">{e.status === "discarded" ? <Chip tone="neutral">Discarded</Chip> : <StatusChip status={e.status} />}</td>
                      <td className="mono px-4 py-2.5 text-right text-xs text-muted">{fmtDateTime(e.sent_at ?? e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      {tab !== "all" && tab !== "sent" && actionable.length === 0 && <Panel><Empty title={tab === "draft" ? "No drafts waiting" : "No failed emails"} /></Panel>}
    </>
  );
}
