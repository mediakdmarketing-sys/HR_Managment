import { useState } from "react";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import AuthShell from "../components/AuthShell";
import { passwordErrorMessage } from "../utils/passwords";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (isSending) return;
    setIsSending(true);
    setError("");
    const address = email.trim();
    try {
      // The link in the email opens /reset-password (set as the action URL in Firebase).
      await sendPasswordResetEmail(firebaseAuth, address, { url: `${window.location.origin}/login` });
      setSentTo(address);
    } catch (sendError) {
      // Don't reveal whether an account exists for this email.
      if (sendError.code === "auth/user-not-found") setSentTo(address);
      else setError(passwordErrorMessage(sendError));
    } finally {
      setIsSending(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell title="Check your email">
        <div className="mt-6 flex gap-3 rounded-2xl bg-teal-50 p-4 text-sm text-teal-700">
          <MailCheck className="shrink-0" size={20} />
          <p>
            If an account exists for <strong>{sentTo}</strong>, we have sent a link to reset the password. It
            expires in 1 hour. Check your spam folder if you don't see it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSentTo("")}
          className="mt-6 text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          Use a different email
        </button>
        <Link to="/login" className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password?" subtitle="Enter your company email and we will send you a link to set a new password.">
      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email Address"
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-slate-800 to-teal-600 py-4 font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70"
        >
          {isSending && <Loader2 className="animate-spin" size={18} />}
          {isSending ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <Link to="/login" className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} /> Back to login
      </Link>
    </AuthShell>
  );
}
