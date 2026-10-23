import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileSignature,
  IdCardLanyard,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import logo from "../assets/kd-logo.jpeg";

const features = [
  {
    icon: LayoutDashboard,
    title: "Role-based dashboards",
    description: "HR, managers, team leads and employees each see the tools and numbers that matter to them.",
  },
  {
    icon: IdCardLanyard,
    title: "Employee management",
    description: "Add, update and deactivate employee records with roles, departments and team leads.",
  },
  {
    icon: CalendarCheck,
    title: "Leave workflow",
    description: "Employees request leave with attachments; the right approver reviews it in one click.",
  },
  {
    icon: Clock3,
    title: "Attendance & work hours",
    description: "See daily availability, working hours and who is on leave today.",
  },
  {
    icon: FileSignature,
    title: "Letter templates",
    description: "Generate offer and service letters with your logo and open them in Google Docs.",
  },
  {
    icon: BellRing,
    title: "Real-time notifications",
    description: "Approvers hear about new requests and employees hear about decisions instantly.",
  },
];

const steps = [
  ["Sign in", "Every user logs in with their work account and lands on a dashboard for their role."],
  ["Submit & review", "Requests go straight to the right reviewer — team lead, HR or manager."],
  ["Stay informed", "Decisions, balances and team availability update across the portal."],
];

const roles = [
  ["HR", "Employees, leave, templates and workforce insights"],
  ["Managers", "Team and HR leave approvals"],
  ["Team Leads", "Team requests and availability"],
  ["Employees", "Leave requests, history and profile"],
];

const PreviewStat = ({ label, value, tone }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <p className="text-[11px] font-medium text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
  </div>
);

const ProductPreview = () => (
  <div className="relative">
    <div className="absolute -inset-4 rounded-[2rem] bg-linear-to-br from-teal-500/25 via-transparent to-slate-500/20 blur-2xl" aria-hidden="true" />
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 text-xs font-medium text-slate-400">HR Dashboard</span>
      </div>
      <div className="space-y-4 p-5">
        <div className="rounded-2xl bg-linear-to-r from-slate-900 to-teal-700 p-4 text-white">
          <p className="text-[11px] font-medium text-teal-200">HR operations</p>
          <p className="mt-1 text-lg font-bold">Good morning, Meena</p>
          <p className="text-xs text-slate-200">Here is your workforce overview for today.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <PreviewStat label="Headcount" value="18" tone="text-slate-800" />
          <PreviewStat label="Active" value="17" tone="text-emerald-700" />
          <PreviewStat label="On leave" value="2" tone="text-blue-700" />
          <PreviewStat label="Pending" value="3" tone="text-amber-700" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white">
          {[
            ["Arun Prakash", "Annual leave · 3 days", "Pending", "bg-amber-100 text-amber-700"],
            ["Madhan", "Medical leave · 1 day", "Approved", "bg-emerald-100 text-emerald-700"],
            ["Gokul", "Casual leave · 2 days", "Approved", "bg-emerald-100 text-emerald-700"],
          ].map(([name, detail, status, tone]) => (
            <div key={name} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-content-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                  {name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{name}</p>
                  <p className="text-[11px] text-slate-500">{detail}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="absolute -bottom-12 -left-6 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 pr-5 shadow-xl sm:flex">
      <div className="grid h-10 w-10 place-content-center rounded-xl bg-emerald-50 text-emerald-700">
        <CheckCircle2 size={20} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">Leave approved</p>
        <p className="text-xs text-slate-500">Notification sent just now</p>
      </div>
    </div>
  </div>
);

function Home() {
  return (
    <main className="app-bg min-h-screen bg-slate-100 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="KD Marketing Group" className="h-10 w-10 rounded-xl object-cover shadow-sm" />
            <div>
              <p className="text-lg font-bold leading-tight text-slate-800">HRMS</p>
              <p className="text-xs text-slate-500">KD Marketing Group</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="transition hover:text-teal-700">Features</a>
            <a href="#how-it-works" className="transition hover:text-teal-700">How it works</a>
            <a href="#roles" className="transition hover:text-teal-700">Roles</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="p-2.5" />
            <Link
              to="/login"
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-32 top-40 h-80 w-80 rounded-full bg-slate-500/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
              <ShieldCheck size={14} />
              Secure, role-based HR portal
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
              People operations,{" "}
              <span className="bg-linear-to-r from-teal-600 to-emerald-500 bg-clip-text text-transparent">
                simplified
              </span>{" "}
              for every team.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              One workspace for employee records, leave approvals, attendance and HR letters —
              with dashboards tailored to each role in your organisation.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white shadow-lg shadow-teal-700/25 transition hover:bg-teal-800"
              >
                Login to your workspace
                <ArrowRight size={18} />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
              >
                Explore features
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-500">
              {["Role-based access", "Instant notifications", "Google Docs letters"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="text-teal-600" size={16} />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Features</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything HR needs, in one place
            </h2>
            <p className="mt-4 text-slate-600">
              Built around the everyday work of HR teams, approvers and employees.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-900/5"
              >
                <div className="grid h-12 w-12 place-content-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-700 group-hover:text-white">
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            From request to decision in minutes
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map(([title, description], index) => (
            <div key={title} className="relative rounded-2xl border border-slate-200 bg-white p-6">
              <span className="text-5xl font-bold text-teal-600/20">0{index + 1}</span>
              <h3 className="mt-2 text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="scroll-mt-20 px-4 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-teal-800 p-8 text-white shadow-xl sm:p-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">Built for every role</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">The right access for the right people</h2>
            <p className="mt-4 text-slate-300">
              Pages, data and approvals are protected by role, so each person only sees what they
              need — and nobody can approve their own requests.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#ffffff] px-6 py-3 font-semibold text-[#0f172a] transition hover:bg-[#f0fdfa]"
            >
              <LockKeyhole size={18} />
              Sign in securely
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map(([role, description], index) => {
              const Icon = [ShieldCheck, Users, UserCheck, IdCardLanyard][index];
              return (
                <div key={role} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <Icon className="text-teal-300" size={22} />
                  <p className="mt-3 font-semibold">{role}</p>
                  <p className="mt-1 text-sm text-slate-300">{description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2">
            <img src={logo} alt="" className="h-6 w-6 rounded-md object-cover" />
            HRMS · KD Marketing Group
          </span>
          <span>© {new Date().getFullYear()} Employee and HR management portal</span>
        </div>
      </footer>
    </main>
  );
}

export default Home;
