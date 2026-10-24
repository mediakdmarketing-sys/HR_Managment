import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import AuthShell from "../components/AuthShell";
import PasswordInput from "../components/PasswordInput";
import { newPasswordError, passwordErrorMessage } from "../utils/passwords";

// Opened from the password reset email: /reset-password?mode=resetPassword&oobCode=...
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const code = searchParams.get("oobCode");
  const linkProblem = mode !== "resetPassword" || !code ? "This link is invalid. Request a new reset link." : "";
  const [email, setEmail] = useState("");
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (linkProblem) return;
    verifyPasswordResetCode(firebaseAuth, code)
      .then(setEmail)
      .catch((verifyError) => setLinkError(passwordErrorMessage(verifyError)));
  }, [code, linkProblem]);

  const submit = async (event) => {
    event.preventDefault();
    if (isSaving) return;
    const problem = newPasswordError(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await confirmPasswordReset(firebaseAuth, code, password);
      setIsDone(true);
    } catch (saveError) {
      setError(passwordErrorMessage(saveError));
      setIsSaving(false);
    }
  };

  const invalid = linkProblem || linkError;
  if (invalid) {
    return (
      <AuthShell title="Link not valid">
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{invalid}</p>
        <Link to="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-teal-700 hover:text-teal-800">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (isDone) {
    return (
      <AuthShell title="Password changed">
        <div className="mt-6 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="shrink-0" size={20} />
          <p>Your password has been updated. You can now log in with your new password.</p>
        </div>
        <Link
          to="/login"
          className="mt-6 block w-full rounded-2xl bg-linear-to-r from-slate-800 to-teal-600 py-4 text-center font-semibold text-white shadow-lg shadow-teal-600/20 hover:opacity-95"
        >
          Go to login
        </Link>
      </AuthShell>
    );
  }

  if (!email) {
    return (
      <AuthShell title="Reset password">
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="animate-spin" size={16} /> Checking your link...
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle={`For ${email}`}>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <PasswordInput label="New password" value={password} onChange={setPassword} autoFocus />
        <PasswordInput label="Confirm new password" value={confirmation} onChange={setConfirmation} />
        <p className="text-xs text-slate-500">At least 8 characters, with letters and numbers.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-slate-800 to-teal-600 py-4 font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70"
        >
          {isSaving && <Loader2 className="animate-spin" size={18} />}
          {isSaving ? "Saving..." : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
