import Sidebar from "./sidebar";
import Header from "./header";

export default function AppShell({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-surface-secondary p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
