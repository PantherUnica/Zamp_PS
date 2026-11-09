import { requireReviewer } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function OpsLayout({ children }: LayoutProps<"/">) {
  const reviewer = await requireReviewer();
  return <AppShell email={reviewer.email}>{children}</AppShell>;
}
