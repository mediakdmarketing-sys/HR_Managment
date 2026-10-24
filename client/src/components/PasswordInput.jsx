import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

function PasswordInput({ label, value, onChange, autoComplete = "new-password", autoFocus = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <span className="relative mt-1 block">
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type={visible ? "text" : "password"}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-12 text-sm font-normal text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-content-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-teal-600"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

export default PasswordInput;
