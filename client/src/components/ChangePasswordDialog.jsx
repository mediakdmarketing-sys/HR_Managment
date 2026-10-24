import { useState } from "react";
import { KeyRound, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import PasswordInput from "./PasswordInput";
import { newPasswordError, passwordErrorMessage } from "../utils/passwords";

// Firebase requires a recent sign-in to change a password, so the current password is
// checked first; the user stays signed in afterwards.
function ChangePasswordDialog({ onClose }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (isSaving) return;
    const problem =
      newPasswordError(password, confirmation) ||
      (password === current ? "The new password must be different from the current one." : "");
    if (problem) {
      setError(problem);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await firebaseAuth.authStateReady();
      const user = firebaseAuth.currentUser;
      if (!user?.email) {
        setError("Your session has expired. Please log in again.");
        setIsSaving(false);
        return;
      }
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, password);
      toast.success("Your password has been changed.", { theme: "dark" });
      onClose();
    } catch (saveError) {
      setError(passwordErrorMessage(saveError));
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-11 w-11 place-content-center rounded-xl bg-teal-50 text-teal-700">
            <KeyRound size={20} />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="change-password-title" className="mt-4 text-lg font-bold text-slate-800">
          Change password
        </h2>
        <p className="mt-1 text-sm text-slate-500">At least 8 characters, with letters and numbers.</p>
        <div className="mt-5 space-y-4">
          <PasswordInput
            label="Current password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            autoFocus
          />
          <PasswordInput label="New password" value={password} onChange={setPassword} />
          <PasswordInput label="Confirm new password" value={confirmation} onChange={setConfirmation} />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {isSaving && <Loader2 className="animate-spin" size={16} />}
            Change password
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChangePasswordDialog;
