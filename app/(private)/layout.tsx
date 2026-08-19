import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { requireViewer } from "@/lib/auth";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseEnv()) redirect("/login");
  const viewer = await requireViewer();
  return (
    <>
      <Nav name={viewer.display_name} />
      <main>{children}</main>
    </>
  );
}
