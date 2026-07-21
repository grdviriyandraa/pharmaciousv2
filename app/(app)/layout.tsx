import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSessionUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware sudah menjaga rute ini; cek ulang di sini sebagai lapis kedua
  // sekaligus sumber data user untuk Shell.
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <Shell user={{ name: user.name, role: user.role }}>{children}</Shell>;
}
