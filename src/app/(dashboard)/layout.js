import AppShell from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies();

  // Build a request-like object to pass to getCurrentUser
  const request = {
    cookies: {
      get(name) {
        const cookie = cookieStore.get(name);
        return cookie ? { value: cookie.value } : undefined;
      },
    },
  };

  const user = await getCurrentUser(request);

  if (!user) {
    redirect("/login");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
