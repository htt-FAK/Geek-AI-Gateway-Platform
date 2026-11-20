import { EntryLogin } from "@/components/entry-login";
import { AuthError, requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

export const metadata = { title: "进入 · 高科极客 AI 网关平台" };

export default async function HomePage() {
  const session = await readSession();
  if (!session) return <EntryLogin />;
  try {
    const { user } = await requireUser();
    redirect(user.mustChangePassword ? "/change-password" : "/playground");
  } catch (e) {
    if (e instanceof AuthError) redirect("/api/auth/logout");
    throw e;
  }
}
