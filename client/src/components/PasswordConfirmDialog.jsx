import { useState } from "react";
import { Loader2, LockKeyhole, X } from "lucide-react";
import { confirmPassword } from "../utils/reauth";

// Asks the signed-in user to re-enter their password before a sensitive action.
function PasswordConfirmDialog({ title = "Confirm your password", description, onConfirmed, onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (isChecking || !password) return;
    setIsChecking(true);
    setError("");
    try {
      await confirmPassword(password);
      await onConfirmed();
    } catch (confirmError) {
      setError(confirmError.message);
      setIsChecking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isChecking) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-confirm-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-11 w-11 place-content-center rounded-xl bg-teal-50 text-teal-700">
            <LockKeyhole size={20} />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isChecking}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cancel"
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="password-confirm-title" className="mt-4 text-lg font-bold text-slate-800">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {description || "For security, re-enter your password to continue."}
        </p>
        <label className="mt-5 block text-sm font-semibold text-slate-700">
          Your password
          <input
            type="password"
            autoFocus
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isChecking}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isChecking || !password}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {isChecking && <Loader2 className="animate-spin" size={16} />}
            Confirm
          </button>
        </div>
      </form>
    </div>
  );
}

export default PasswordConfirmDialog;
