import { Ticket } from "lucide-react";

// Centered card used by the forgot-password and reset-password pages.
function AuthShell({ title, subtitle, children }) {
  return (
    <div className="app-bg flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-content-center rounded-2xl bg-linear-to-br from-slate-800 to-teal-600 shadow-lg shadow-teal-600/20">
            <Ticket className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">HR Management</h2>
        </div>
        <h1 className="text-3xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export default AuthShell;
