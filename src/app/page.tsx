import { redirect } from "next/navigation";
import { getReviewer } from "@/lib/auth";

export default async function Home() {
  redirect((await getReviewer()) ? "/dashboard" : "/onboard");
}
