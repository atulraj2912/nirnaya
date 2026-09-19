import Sidebar from "./sidebar";
import Header from "./header";

export default function AppShell({ children, user }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex w-full justify-end border-b border-border bg-surface/80 backdrop-blur-sm">
          <Header user={user} />
        </div>
        <main className="flex-1 overflow-y-auto p-6 w-full">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
