import { EntryLogin } from "@/components/entry-login";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

export const metadata = { title: "进入 · 高科极客 AI 网关平台" };

export default async function HomePage() {
  const session = await readSession();
  if (session) {
    redirect(session.mustChangePassword ? "/change-password" : "/playground");
  }
  return <EntryLogin />;
}
