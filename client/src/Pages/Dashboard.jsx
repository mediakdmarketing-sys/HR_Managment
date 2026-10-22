import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileBarChart,
  FileSignature,
  FileText,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
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

const HrDashboard = ({ user }) => {
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadedAt] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    Promise.all([getUsers(1, "all", 1000), getLeaveRequests()])
      .then(([usersResponse, leaveResponse]) => {
        if (!active) return;
        setEmployees(usersResponse.data.data.users);
        setLeaveRequests(leaveResponse.data.data);
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
  }, []);

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
  const pendingLeave = leaveRequests.filter(
    (request) => request.status === "Pending" && request.employeeId !== currentEmployeeId,
  ).length;
  const show = (value) => (isLoading ? "…" : value);

  return (
    <>
      {loadError && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>
      )}
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
            value={show(employees.length)}
            detail="Employees in the directory"
            icon={Users}
            color="bg-teal-50 text-teal-700"
          />
          <StatCard
            label="Active employees"
            value={show(activeEmployees.length)}
            detail="Currently marked as active"
            icon={UserCheck}
            color="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="New joiners"
            value={show(newJoiners.length)}
            detail={`Added in the last ${NEW_JOINER_DAYS} days`}
            icon={UserPlus}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            label="Departures"
            value={show(employees.length - activeEmployees.length)}
            detail="Marked as not active"
            icon={UserMinus}
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
              ["On leave", show(onLeaveToday)],
              ["Present", "—"],
              ["Late", "—"],
              ["Absent", "—"],
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
            On leave is based on approved leave requests. Other attendance values will be connected later.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <SectionHeader
            title="Pending approvals"
            description="Items that need HR attention."
            icon={CheckCircle2}
          />
          <div className="space-y-3">
            <Link
              to="/leave"
              className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 transition hover:border-teal-200 hover:bg-teal-50"
            >
              <span className="text-sm text-slate-600">Leave requests</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  pendingLeave ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                }`}
              >
                {show(pendingLeave)} pending
              </span>
            </Link>
            {["Attendance corrections", "Payroll reviews", "Employee requests"].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
              >
                <span className="text-sm text-slate-600">{item}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400">
                  Coming soon
                </span>
              </div>
            ))}
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
            <QuickLink label="Offer letter template" to="/templates" icon={FileSignature} />
            <QuickLink label="Service letter template" to="/templates" icon={FileText} />
          </div>
        </section>
      </div>
    </>
  );
};

const leaveStatusClass = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

const EmployeeDashboard = ({ user }) => {
  const [employee, setEmployee] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadedAt] = useState(() => Date.now());
  const currentEmployeeId = user?._id ?? user?.id;

  useEffect(() => {
    let active = true;
    Promise.all([getUserById(currentEmployeeId), getLeaveRequests()])
      .then(([employeeResponse, leaveResponse]) => {
        if (!active) return;
        setEmployee(employeeResponse.data.data);
        setLeaveRequests(leaveResponse.data.data);
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
  }, [currentEmployeeId]);

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
  const show = (value) => (isLoading ? "…" : value);

  return (
    <>
      {loadError && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{loadError}</p>
      )}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-800">My work overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            A quick summary of your leave and requests.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Today"
            value={show(onLeaveToday ? "On leave" : "Working")}
            detail={onLeaveToday ? `${onLeaveToday.type} until ${formatDate(onLeaveToday.endDate)}` : "No approved leave today"}
            icon={UserCheck}
            color="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            label="Leave taken"
            value={show(`${leaveTakenThisYear} day${leaveTakenThisYear === 1 ? "" : "s"}`)}
            detail="Approved leave this year"
            icon={CalendarDays}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            label="My pending requests"
            value={show(myPending)}
            detail="Waiting for a decision"
            icon={FileText}
            color="bg-amber-50 text-amber-700"
          />
          {isReviewer ? (
            <StatCard
              label="Requests to review"
              value={show(toReview)}
              detail="Leave requests waiting for you"
              icon={CheckCircle2}
              color="bg-teal-50 text-teal-700"
            />
          ) : (
            <StatCard
              label="Next leave"
              value={show(upcomingLeave[0] ? formatDate(upcomingLeave[0].startDate) : "—")}
              detail={upcomingLeave[0] ? upcomingLeave[0].type : "No upcoming approved leave"}
              icon={CalendarDays}
              color="bg-teal-50 text-teal-700"
            />
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <SectionHeader
            title="My profile"
            description="Your details in the employee directory."
            icon={Users}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Employee ID", employee?.id],
              ["Role", employee?.role],
              ["Department", employee?.department],
              ["Team lead", employee?.assignedTeamLead],
              ["Email", employee?.email],
              ["Status", employee?.status],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                  {show(value || "—")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <SectionHeader
            title="Recent leave requests"
            description="Your latest requests and their status."
            icon={FileText}
          />
          {myRequests.length ? (
            <div className="space-y-3">
              {myRequests.slice(0, 4).map((request) => (
                <Link
                  key={request.id}
                  to="/leave"
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 transition hover:bg-teal-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {request.type} · {request.days} day(s)
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(request.startDate)} - {formatDate(request.endDate)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${leaveStatusClass[request.status]}`}>
                    {request.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title={isLoading ? "Loading…" : "No leave requests yet"}
              description="Requests you submit from My Leave will appear here."
            />
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <SectionHeader
            title="Upcoming leave"
            description="Approved leave coming up."
            icon={Bell}
          />
          {upcomingLeave.length ? (
            <div className="space-y-3">
              {upcomingLeave.slice(0, 4).map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-slate-700">{request.type}</span>
                  <span className="text-xs font-medium text-teal-700">
                    {formatDate(request.startDate)} - {formatDate(request.endDate)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming leave"
              description={`${user?.name || "You"} have no approved leave coming up.`}
            />
          )}
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
    </>
  );
};

const Dashboard = () => {
  const user = getUser();
  const userRole = user?.role || "Employee";
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
            Welcome back {user?.name || "User"},{" "}
            {isHr
              ? "here is your workforce overview for today."
              : "here is your personal work overview for today."}
          </p>
          <p className="mt-4 text-sm text-slate-300">{formatDate(new Date())}</p>
        </div>

        {isHr ? (
          <HrDashboard user={user} />
        ) : (
          <EmployeeDashboard user={user} />
        )}
      </div>
    </UserLayout>
  );
};

export default Dashboard;
