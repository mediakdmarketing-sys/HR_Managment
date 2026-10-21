import {
  ArrowRight,
  CalendarCheck,
  ChartNoAxesCombined,
  Clock3,
  IdCardLanyard,
  SquareDashedKanban,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "../assets/icon.png";

const features = [
  {
    icon: IdCardLanyard,
    title: "Employee management",
    description: "Keep employee records, roles and departments organised.",
  },
  {
    icon: Clock3,
    title: "Attendance & work hours",
    description: "Track attendance, working hours and daily availability.",
  },
  {
    icon: WalletCards,
    title: "Payroll & payslips",
    description: "Keep payroll information and payslips easy to manage.",
  },
];

function Home() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-content-center rounded-2xl bg-linear-to-br from-slate-800 to-teal-600 shadow-lg shadow-teal-600/20">
              <SquareDashedKanban className="text-white" size={23} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">HRMS</p>
              <p className="text-xs text-slate-500">HR Management</p>
            </div>
          </Link>

          <Link
            to="/login"
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            Login
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            Human resources management system
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
            People operations, organised for your team.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            HRMS brings employee management, attendance, leave, payroll and
            performance into one clear workspace for your organisation.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white transition hover:bg-teal-800"
            >
              Login to continue
              <ArrowRight size={18} />
            </Link>
            <span className="text-sm text-slate-500">
              Designed for everyday HR work
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
            <img
              src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80"
              alt="People collaborating in an office"
              className="h-80 w-full object-cover"
            />
            <div className="grid gap-4 bg-white p-5 sm:grid-cols-3">
              {[
                ["01", "People records"],
                ["02", "Daily attendance"],
                ["03", "HR insights"],
              ].map(([number, label]) => (
                <div key={number}>
                  <p className="text-2xl font-bold text-teal-700">{number}</p>
                  <p className="mt-1 text-sm text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute -bottom-10 -right-8 hidden h-28 w-28 opacity-70 sm:block"
          />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold text-slate-900">
              A clear view of your HR operations
            </h2>
            <p className="mt-3 text-slate-600">
              Manage the important parts of the employee lifecycle from one
              consistent system.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 p-5 transition hover:border-teal-200 hover:bg-teal-50/40"
              >
                <Icon className="text-teal-700" size={25} />
                <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="flex items-center gap-4 rounded-2xl bg-slate-800 p-5 text-white">
              <ChartNoAxesCombined className="text-teal-300" size={28} />
              <div>
                <h3 className="font-bold">HR dashboard insights</h3>
                <p className="mt-1 text-sm text-slate-300">
                  View workforce activity and important HR updates at a glance.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-5">
              <CalendarCheck className="text-teal-700" size={28} />
              <div>
                <h3 className="font-bold text-slate-900">
                  Simple daily workflows
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Give HR teams and employees the right tools for their role.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>HRMS</span>
        <span>Employee and HR management portal</span>
      </footer>
    </main>
  );
}

export default Home;
