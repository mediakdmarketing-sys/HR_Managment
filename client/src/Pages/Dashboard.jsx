import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileBarChart,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import mockEmployees from "../assets/mockEmployees";
import { getUser } from "../utils/auth";

const formatDate = (date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
    <Icon className="mt-0.5 text-slate-400" size={19} />
    <div>
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  </div>
);

const StatCard = ({ label, value, detail, icon: Icon, color }) => (
  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon size={21} />
      </div>
    </div>
    <p className="mt-4 text-xs text-slate-500">{detail}</p>
  </div>
);

const SectionHeader = ({ title, description, icon: Icon }) => (
  <div className="mb-5 flex items-center justify-between">
    <div>
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
    <Icon className="text-teal-600" size={22} />
  </div>
);

const QuickLink = ({ label, to, icon: Icon }) => (
  <Link
    to={to}
    className="group flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-teal-200 hover:bg-teal-50"
  >
    <span className="flex items-center gap-3 text-sm font-semibold text-slate-700">
      <Icon className="text-teal-600" size={18} />
      {label}
    </span>
    <ArrowRight
      className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-600"
      size={16}
    />
  </Link>
);

const HrDashboard = ({ employees }) => {
  const activeEmployees = employees.filter(
    (employee) => employee.status === "Active"
  );
  const newJoiners = employees.slice(0, 6);

  return (
    <>
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800">People snapshot</h2>
          <p className="mt-1 text-sm text-slate-500">
            A quick view of your workforce.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total headcount"
            value={employees.length}
            detail="Employees in the directory"
            icon={Users}
            color="bg-teal-50 text-teal-700"
          />
          <StatCard
            label="Active employees"
            value={activeEmployees.length}
            detail="Currently marked as active"
            icon={UserCheck}
            color="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="New joiners"
            value={newJoiners.length}
            detail="Recent employee records"
            icon={UserPlus}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            label="Departures"
            value={employees.length - activeEmployees.length}
            detail="Marked as not active"
            icon={Users}
            color="bg-amber-50 text-amber-700"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <SectionHeader
            title="Today&apos;s attendance"
            description="Live workforce availability."
            icon={Clock3}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Present", activeEmployees.length],
              ["Late", "—"],
              ["Absent", employees.length - activeEmployees.length],
              ["On leave", "—"],
              ["Currently working", "—"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="text-sm text-slate-600">{label}</span>
                <span className="font-bold text-slate-700">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Attendance values are based on the current mock employee status.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <SectionHeader
            title="Pending approvals"
            description="Items that need HR attention."
            icon={CheckCircle2}
          />
          <div className="space-y-3">
            {["Leave requests", "Attendance corrections", "Payroll reviews", "Employee requests"].map(
              (item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                >
                  <span className="text-sm text-slate-600">{item}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400">
                    0 pending
                  </span>
                </div>
              )
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <SectionHeader
            title="Upcoming HR activities"
            description="Important dates to keep on your radar."
            icon={Bell}
          />
          <EmptyState
            icon={CalendarDays}
            title="No upcoming activities available"
            description="Birthdays, probation reviews, renewals, interviews and training deadlines will appear here."
          />
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <SectionHeader
            title="Quick links"
            description="Jump straight to common HR tasks."
            icon={ArrowRight}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickLink label="Employee records" to="/employees" icon={Users} />
            <QuickLink label="Attendance" to="/attendance" icon={Clock3} />
            <QuickLink label="Leave management" to="/leave" icon={CalendarDays} />
            <QuickLink label="Payroll & payslips" to="/payslip" icon={FileBarChart} />
          </div>
        </section>
      </div>
    </>
  );
};

const EmployeeDashboard = ({ user, employee }) => (
  <>
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">My work overview</h2>
        <p className="mt-1 text-sm text-slate-500">
          A quick summary of your attendance, leave and payroll.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today&apos;s attendance"
          value={employee?.status === "Active" ? "Present" : "Absent"}
          detail="Based on today&apos;s mock record"
          icon={UserCheck}
          color="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Working hours"
          value={`${employee?.workingHours || 0}h`}
          detail="Today&apos;s recorded hours"
          icon={Clock3}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Leave balance"
          value="12 days"
          detail="Available this year"
          icon={CalendarDays}
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Next payslip"
          value="30 Oct"
          detail="Estimated payroll date"
          icon={CreditCard}
          color="bg-teal-50 text-teal-700"
        />
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <SectionHeader
          title="Today&apos;s timeline"
          description="Your attendance activity for today."
          icon={Clock3}
        />
        <div className="space-y-3">
          {[
            ["09:00 AM", "Workday started", "Present"],
            ["01:00 PM", "Lunch break", "1 hour"],
            ["05:30 PM", "Expected finish", "On schedule"],
          ].map(([time, activity, status]) => (
            <div
              key={time}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-700">{activity}</p>
                <p className="mt-1 text-xs text-slate-500">{time}</p>
              </div>
              <span className="text-xs font-semibold text-teal-700">{status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <SectionHeader
          title="My quick links"
          description="Access your employee tools."
          icon={ArrowRight}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLink label="My attendance" to="/attendance" icon={Clock3} />
          <QuickLink label="My leave" to="/leave" icon={CalendarDays} />
          <QuickLink label="My payslips" to="/payslip" icon={CreditCard} />
          <QuickLink label="My performance" to="/performance" icon={FileBarChart} />
        </div>
      </section>
    </div>

    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
      <SectionHeader
        title="Upcoming reminders"
        description="Keep track of your next HR activities."
        icon={Bell}
      />
      <EmptyState
        icon={CalendarDays}
        title="No upcoming reminders"
        description={`${user?.name || "You"} have no probation, training or review reminders at the moment.`}
      />
    </section>
  </>
);

const Dashboard = () => {
  const user = getUser();
  const userRole = user?.role || "Employees";
  const employees = mockEmployees;
  const currentEmployee =
    employees.find(
      (employee) => employee.id === user?.id || employee.email === user?.email
    ) || employees[0];
  const isHr = userRole.toLowerCase() === "hr";

  return (
    <UserLayout>
      <div className="space-y-6">
        <div className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <p className="text-sm font-medium text-teal-200">
            {isHr ? "HR operations" : "Employee self-service"}
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            {isHr ? "HR Dashboard" : "My Dashboard"}
          </h1>
          <p className="mt-3 text-slate-200">
            Welcome back {user?.name || currentEmployee?.name || "User"},{" "}
            {isHr
              ? "here is your workforce overview for today."
              : "here is your personal work overview for today."}
          </p>
          <p className="mt-4 text-sm text-slate-300">{formatDate(new Date())}</p>
        </div>

        {isHr ? (
          <HrDashboard employees={employees} />
        ) : (
          <EmployeeDashboard user={user} employee={currentEmployee} />
        )}
      </div>
    </UserLayout>
  );
};

export default Dashboard;
