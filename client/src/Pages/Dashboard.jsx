import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileBarChart,
  FileSignature,
  FileText,
  IdCardLanyard,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import UserLayout from "../layouts/UserLayout";
import { getUser } from "../utils/auth";
import { getUserById, getUsers } from "../api/userApi";
import { getLeaveRequests } from "../api/leaveApi";

const NEW_JOINER_DAYS = 14;

const toDateKey = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const formatDate = (date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const leaveStatusClass = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

// Loads the dashboard's data once and exposes loading/error state.
const useDashboardData = (loaders, deps) => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all(loaders())
      .then((responses) => {
        if (active) setData(responses.map((response) => response.data.data));
      })
      .catch((error) => {
        if (active) {
          setLoadError(error.response?.data?.message || "Unable to load dashboard data.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, isLoading, loadError };
};

const Skeleton = ({ className = "h-8 w-16" }) => (
  <span className={`inline-block animate-pulse rounded-lg bg-slate-100 ${className}`} />
);

const Panel = ({ title, description, icon: Icon, action, children, className = "" }) => (
  <section className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 ${className}`}>
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-teal-50 text-teal-700">
            <Icon size={19} />
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const PanelLink = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-teal-700 hover:underline"
  >
    {children}
    <ArrowRight size={15} />
  </Link>
);

const StatCard = ({ label, value, detail, icon: Icon, color, to, isLoading }) => {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`grid h-10 w-10 place-content-center rounded-xl ${color}`}>
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-800">
        {isLoading ? <Skeleton /> : value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </>
  );
  const className =
    "block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 transition";
  return to ? (
    <Link to={to} className={`${className} hover:-translate-y-0.5 hover:shadow-md`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
};

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
    <Icon className="text-slate-400" size={26} />
    <p className="mt-3 font-semibold text-slate-700">{title}</p>
    <p className="mt-1 max-w-xs text-sm text-slate-500">{description}</p>
  </div>
);

const QuickLink = ({ label, to, icon: Icon }) => (
  <Link
    to={to}
    className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 transition hover:border-teal-200 hover:bg-teal-50"
  >
    <span className="flex items-center gap-3 text-sm font-semibold text-slate-700">
      <span className="grid h-9 w-9 place-content-center rounded-lg bg-slate-100 text-teal-700">
        <Icon size={17} />
      </span>
      {label}
    </span>
    <ArrowRight
      className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-600"
      size={16}
    />
  </Link>
);

const LeaveRow = ({ request, showName }) => (
  <Link
    to="/leave"
    className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
  >
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-9 w-9 shrink-0 place-content-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
        {(showName ? request.employeeName : request.type)?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-700">
          {showName ? request.employeeName : `${request.type} · ${request.days} day(s)`}
        </p>
        <p className="truncate text-xs text-slate-500">
          {showName && `${request.type} · `}
          {formatDate(request.startDate)} – {formatDate(request.endDate)}
        </p>
      </div>
    </div>
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${leaveStatusClass[request.status]}`}>
      {request.status}
    </span>
  </Link>
);

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { department, count } = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-800">{department}</p>
      <p className="text-slate-500">
        {count} employee{count === 1 ? "" : "s"}
      </p>
    </div>
  );
};

// Wraps long department names (e.g. "Digital Marketing") onto two lines under the bar.
const DepartmentTick = ({ x, y, payload }) => {
  const words = String(payload.value).split(" ");
  const middle = Math.ceil(words.length / 2);
  const lines = words.length > 1 && payload.value.length > 10
    ? [words.slice(0, middle).join(" "), words.slice(middle).join(" ")]
    : [payload.value];
  return (
    <text x={x} y={y + 14} textAnchor="middle" fill="var(--chart-axis)" fontSize={12}>
      {lines.map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? 0 : 14}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

const DepartmentChart = ({ employees }) => {
  const counts = employees.reduce((totals, employee) => {
    const department = employee.department || "Unassigned";
    totals[department] = (totals[department] || 0) + 1;
    return totals;
  }, {});
  const data = Object.entries(counts)
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  if (!data.length) {
    return (
      <EmptyState icon={BarChart3} title="No employees yet" description="Departments appear once employees are added." />
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="department"
            interval={0}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            height={44}
            tick={<DepartmentTick />}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: "var(--chart-grid)", opacity: 0.5 }} content={<ChartTooltip />} />
          {/* Bars grow up from the axis when the dashboard loads. */}
          <Bar
            dataKey="count"
            fill="var(--chart-bar)"
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
            animationBegin={150}
            animationDuration={900}
            animationEasing="ease-out"
            activeBar={{ fillOpacity: 0.85 }}
          >
            <LabelList dataKey="count" position="top" fill="var(--chart-axis)" fontSize={12} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const HrDashboard = ({ user }) => {
  const [loadedAt] = useState(() => Date.now());
  const {
    data: [usersData, leaveData],
    isLoading,
    loadError,
  } = useDashboardData(() => [getUsers(1, "all", 1000), getLeaveRequests()], []);
  const employees = usersData?.users || [];
  const leaveRequests = leaveData || [];

  const currentEmployeeId = user?._id ?? user?.id;
  const today = toDateKey(new Date(loadedAt));
  const newJoinerSince = loadedAt - NEW_JOINER_DAYS * 86400000;
  const activeEmployees = employees.filter((employee) => employee.status === "Active");
  const newJoiners = employees.filter(
    (employee) => employee.createdAt && new Date(employee.createdAt).getTime() >= newJoinerSince,
  );
  const onLeaveToday = new Set(
    leaveRequests
      .filter(
        (request) =>
          request.status === "Approved" &&
          request.startDate <= today &&
          request.endDate >= today,
      )
      .map((request) => request.employeeId),
  ).size;
  // HR's own requests are reviewed by Managers, so they are not HR approvals.
  const reviewable = leaveRequests.filter((request) => request.employeeId !== currentEmployeeId);
  const pendingLeave = reviewable.filter((request) => request.status === "Pending").length;
  const show = (value) => (isLoading ? "…" : value);

  return (
    <>
      {loadError && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total headcount"
          value={employees.length}
          detail="Employees in the directory"
          icon={Users}
          color="bg-teal-50 text-teal-700"
          to="/employees"
          isLoading={isLoading}
        />
        <StatCard
          label="Active employees"
          value={activeEmployees.length}
          detail="Currently marked as active"
          icon={UserCheck}
          color="bg-emerald-50 text-emerald-700"
          to="/employees"
          isLoading={isLoading}
        />
        <StatCard
          label="New joiners"
          value={newJoiners.length}
          detail={`Added in the last ${NEW_JOINER_DAYS} days`}
          icon={UserPlus}
          color="bg-blue-50 text-blue-700"
          to="/employees"
          isLoading={isLoading}
        />
        <StatCard
          label="Departures"
          value={employees.length - activeEmployees.length}
          detail="Marked as not active"
          icon={UserMinus}
          color="bg-amber-50 text-amber-700"
          to="/employees"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Headcount by department"
          description="All employees in the directory."
          icon={BarChart3}
          action={<PanelLink to="/employees">Directory</PanelLink>}
          className="xl:col-span-2"
        >
          {isLoading ? <Skeleton className="h-48 w-full" /> : <DepartmentChart employees={employees} />}
        </Panel>

        <Panel title="Today at a glance" description={formatDate(loadedAt)} icon={Clock3}>
          <div className="space-y-3">
            <Link
              to="/leave"
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5 transition hover:border-teal-200 hover:bg-teal-50"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <FileText className="text-amber-700" size={18} />
                Leave approvals pending
              </span>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${pendingLeave ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                {show(pendingLeave)}
              </span>
            </Link>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3.5">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <CalendarDays className="text-blue-700" size={18} />
                On leave today
              </span>
              <span className="text-lg font-bold text-slate-800">{show(onLeaveToday)}</span>
            </div>
            {["Present", "Late", "Currently working"].map((label) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-500">{label}</span>
                <span className="text-sm font-semibold text-slate-400">—</span>
              </div>
            ))}
            <p className="text-xs text-slate-400">Attendance tracking will be connected later.</p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Recent leave requests"
          description="Latest requests across the organisation."
          icon={CalendarDays}
          action={<PanelLink to="/leave">View all</PanelLink>}
          className="xl:col-span-2"
        >
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((key) => <Skeleton key={key} className="h-12 w-full" />)}
            </div>
          ) : reviewable.length ? (
            <div className="-mx-3 divide-y divide-slate-100">
              {reviewable.slice(0, 5).map((request) => (
                <LeaveRow key={request.id} request={request} showName />
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="No leave requests yet" description="Requests from employees will appear here." />
          )}
        </Panel>

        <Panel title="Pending approvals" description="Items that need HR attention." icon={CheckCircle2}>
          <div className="space-y-3">
            <Link
              to="/leave"
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 transition hover:border-teal-200 hover:bg-teal-50"
            >
              <span className="text-sm font-medium text-slate-600">Leave requests</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pendingLeave ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                {show(pendingLeave)} pending
              </span>
            </Link>
            {["Attendance corrections", "Payroll reviews"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <span className="text-sm text-slate-500">{item}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Quick links" description="Jump straight to common HR tasks." icon={Sparkles}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <QuickLink label="Employee records" to="/employees" icon={IdCardLanyard} />
          <QuickLink label="Leave management" to="/leave" icon={CalendarDays} />
          <QuickLink label="Attendance" to="/attendance" icon={Clock3} />
          <QuickLink label="Payroll & payslips" to="/payslip" icon={CreditCard} />
          <QuickLink label="Offer letter template" to="/templates" icon={FileSignature} />
          <QuickLink label="Service letter template" to="/templates" icon={FileText} />
        </div>
      </Panel>
    </>
  );
};

const EmployeeDashboard = ({ user }) => {
  const [loadedAt] = useState(() => Date.now());
  const currentEmployeeId = user?._id ?? user?.id;
  const {
    data: [employee, leaveData],
    isLoading,
    loadError,
  } = useDashboardData(
    () => [getUserById(currentEmployeeId), getLeaveRequests()],
    [currentEmployeeId],
  );
  const leaveRequests = leaveData || [];

  const today = toDateKey(new Date(loadedAt));
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const myRequests = leaveRequests.filter((request) => request.employeeId === currentEmployeeId);
  const approved = myRequests.filter((request) => request.status === "Approved");
  const onLeaveToday = approved.find(
    (request) => request.startDate <= today && request.endDate >= today,
  );
  const leaveTakenThisYear = approved
    .filter((request) => request.startDate >= yearStart)
    .reduce((total, request) => total + Number(request.days || 0), 0);
  const myPending = myRequests.filter((request) => request.status === "Pending").length;
  const upcomingLeave = approved
    .filter((request) => request.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  // Team Leads and Managers also receive other people's requests to review.
  const isReviewer = ["Team Lead", "Manager"].includes(user?.role);
  const toReview = leaveRequests.filter(
    (request) => request.status === "Pending" && request.employeeId !== currentEmployeeId,
  ).length;

  return (
    <>
      {loadError && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today"
          value={onLeaveToday ? "On leave" : "Working"}
          detail={onLeaveToday ? `${onLeaveToday.type} until ${formatDate(onLeaveToday.endDate)}` : "No approved leave today"}
          icon={UserCheck}
          color="bg-emerald-50 text-emerald-700"
          isLoading={isLoading}
        />
        <StatCard
          label="Leave taken"
          value={`${leaveTakenThisYear} day${leaveTakenThisYear === 1 ? "" : "s"}`}
          detail="Approved leave this year"
          icon={CalendarDays}
          color="bg-blue-50 text-blue-700"
          to="/leave"
          isLoading={isLoading}
        />
        <StatCard
          label="My pending requests"
          value={myPending}
          detail="Waiting for a decision"
          icon={FileText}
          color="bg-amber-50 text-amber-700"
          to="/leave"
          isLoading={isLoading}
        />
        {isReviewer ? (
          <StatCard
            label="Requests to review"
            value={toReview}
            detail="Leave requests waiting for you"
            icon={CheckCircle2}
            color="bg-teal-50 text-teal-700"
            to="/leave"
            isLoading={isLoading}
          />
        ) : (
          <StatCard
            label="Next leave"
            value={upcomingLeave[0] ? formatDate(upcomingLeave[0].startDate) : "—"}
            detail={upcomingLeave[0] ? upcomingLeave[0].type : "No upcoming approved leave"}
            icon={CalendarDays}
            color="bg-teal-50 text-teal-700"
            isLoading={isLoading}
          />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="My profile" description="Your details in the employee directory." icon={Users}>
          <div className="mb-5 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
            <div className="grid h-14 w-14 shrink-0 place-content-center rounded-2xl bg-linear-to-br from-slate-800 to-teal-600 text-xl font-bold text-white">
              {user?.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-800">{user?.name || "—"}</p>
              <p className="truncate text-sm text-slate-500">{employee?.email || user?.email}</p>
            </div>
          </div>
          <dl className="space-y-3">
            {[
              ["Employee ID", employee?.id],
              ["Role", employee?.role],
              ["Department", employee?.department],
              ["Team lead", employee?.assignedTeamLead],
              ["Status", employee?.status],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-slate-500">{label}</dt>
                <dd className="truncate font-semibold text-slate-700">
                  {isLoading ? <Skeleton className="h-4 w-20" /> : value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel
          title="Recent leave requests"
          description="Your latest requests and their status."
          icon={FileText}
          action={<PanelLink to="/leave">My leave</PanelLink>}
          className="xl:col-span-2"
        >
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((key) => <Skeleton key={key} className="h-12 w-full" />)}
            </div>
          ) : myRequests.length ? (
            <div className="-mx-3 divide-y divide-slate-100">
              {myRequests.slice(0, 5).map((request) => (
                <LeaveRow key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No leave requests yet"
              description="Requests you submit from My Leave will appear here."
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Upcoming leave" description="Approved leave coming up." icon={CalendarDays}>
          {upcomingLeave.length ? (
            <div className="space-y-3">
              {upcomingLeave.slice(0, 4).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-slate-700">{request.type}</span>
                  <span className="text-xs font-medium text-teal-700">
                    {formatDate(request.startDate)} – {formatDate(request.endDate)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming leave"
              description="Approved leave that starts after today will appear here."
            />
          )}
        </Panel>

        <Panel title="Quick links" description="Access your employee tools." icon={Sparkles}>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickLink label="My leave" to="/leave" icon={CalendarDays} />
            <QuickLink label="My attendance" to="/attendance" icon={Clock3} />
            <QuickLink label="My payslips" to="/payslip" icon={CreditCard} />
            <QuickLink label="My performance" to="/performance" icon={FileBarChart} />
          </div>
        </Panel>
      </div>
    </>
  );
};

const Dashboard = () => {
  const user = getUser();
  const userRole = user?.role || "Employee";
  const isHr = userRole.toLowerCase() === "hr";
  const firstName = user?.name?.trim()?.split(" ")[0] || "there";
  const actions = isHr
    ? [
        ["/employees", "Manage employees", Users],
        ["/leave", "Review leave", CheckCircle2],
      ]
    : [["/leave", "Request leave", CalendarPlus]];

  return (
    <UserLayout>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-teal-700 p-6 text-white shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold text-teal-100">
                  {userRole}
                </span>
                <span className="text-slate-300">{formatDate(new Date())}</span>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                {greeting()}, {firstName}
              </h1>
              <p className="mt-2 max-w-xl text-slate-300">
                {isHr
                  ? "Here is your workforce overview for today."
                  : "Here is your personal work overview for today."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {actions.map(([to, label, Icon], index) => (
                <Link
                  key={to}
                  to={to}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    index === 0
                      ? "bg-[#ffffff] text-[#0f172a] hover:bg-[#f0fdfa]"
                      : "border border-white/20 text-white hover:bg-white/10"
                  }`}
                >
                  <Icon size={17} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {isHr ? <HrDashboard user={user} /> : <EmployeeDashboard user={user} />}
      </div>
    </UserLayout>
  );
};

export default Dashboard;
