import Sidebar from "./sidebar";
import Header from "./header";

export default function AppShell({ children, user }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto bg-surface-secondary p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
