import { useEffect, useState } from "react";
import { Ticket, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { loginUser } from "../api/authApi";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { clearSession, isLoggedIn, startSession } from "../utils/auth";
import { toast } from "react-toastify";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason");

  useEffect(() => {
    if (reason === "expired") {
      toast.info("Your session has ended. Please log in again.", { theme: "dark" });
    } else if (reason === "signed-out") {
      toast.info("You have been signed out. Please log in again.", { theme: "dark" });
    }
  }, [reason]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error("Please fill all fields", { theme: "dark" });
      return;
    }

    if (loading) return;
    try {
      setLoading(true);

      const response = await loginUser({
        email: formData.email.trim(),
        password: formData.password,
      });

      startSession(response.data.data.token, response.data.data.user);

      toast.success("Welcome to HR Management", { theme: "dark" });

      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      // Firebase may have signed in even though the server rejected the user (e.g. disabled).
      await clearSession();
      toast.error(err.response?.data?.message || "Login failed", {
        theme: "dark",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="app-bg min-h-screen bg-slate-100 p-4 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl grid lg:grid-cols-2">
        {/* Left Side */}
        <div className="relative hidden overflow-hidden lg:flex">
          <img
            src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1600&q=80"
            alt="Support team"
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-0 bg-linear-to-br from-slate-950/90 via-slate-800/80 to-teal-700/70 flex flex-col justify-between p-10">
            <div className="inline-flex w-fit rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              HR management
            </div>

            <div className="max-w-lg">
              <h1 className="text-5xl font-bold leading-tight text-white">
                Manage every document with clarity.
              </h1>

              <p className="mt-4 text-lg text-slate-100">
                Log in to handle employees requests, keep your queue organized,
                and move issues from open to resolved faster.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur">
                  <p className="text-sm text-slate-100/90">Open</p>
                  <p className="mt-1 text-2xl font-bold text-white">128</p>
                </div>

                <div className="rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur">
                  <p className="text-sm text-slate-100/90">In Progress</p>
                  <p className="mt-1 text-2xl font-bold text-white">42</p>
                </div>

                <div className="rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur">
                  <p className="text-sm text-slate-100/90">Resolved</p>
                  <p className="mt-1 text-2xl font-bold text-white">316</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex flex-col justify-center bg-white p-8 lg:p-14">
          <div className="flex items-center gap-3 mb-8">
            <div className="grid h-12 w-12 place-content-center rounded-2xl bg-linear-to-br from-slate-800 to-teal-600 shadow-lg shadow-teal-600/20">
              <Ticket className="text-white w-6 h-6" />
            </div>

            <h2 className="text-2xl font-bold text-slate-800">HR Management</h2>
          </div>

          <h1 className="text-4xl font-bold text-slate-800">Welcome back</h1>

          <p className="text-slate-500 mt-2">
            Sign in to continue managing documents and support workflows
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="relative">
              <Mail className="absolute left-4 top-4 text-slate-400 w-5 h-5" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email Address"
                className="w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 py-4 text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-4 text-slate-400 w-5 h-5" />

              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
                className="w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-14 py-4 text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-3 grid h-8 w-8 place-content-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-teal-600 hover:text-teal-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full disabled:cursor-wait disabled:opacity-70 bg-linear-to-r from-slate-800 to-teal-600 text-white py-4 rounded-2xl font-semibold shadow-lg shadow-teal-600/20 hover:opacity-95 transition cursor-pointer"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="flex justify-between mt-5 text-sm text-slate-500">
            <a href="/dashboard" className="text-teal-700 hover:text-teal-800">
              Forgot Password?
            </a>

            <a href="/register" className="text-slate-600 hover:text-slate-900">
              Register
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
