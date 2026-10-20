import { useEffect, useMemo, useState } from "react";
import UserLayout from "../layouts/UserLayout";
import { Link } from "react-router-dom";
import {
  getAllTickets,
  getAssignedTickets,
  getMyTickets,
} from "../api/ticketApi";
import { getUsers } from "../api/userApi";
import { getUser } from "../utils/auth";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileBarChart,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const STATUS_COLORS = {
  Open: "#0f766e",
  "In Progress": "#3b82f6",
  Resolved: "#14b8a6",
  Closed: "#64748b",
};

const ROLE_TITLES = {
  admin: "Admin Dashboard",
  agent: "Dashboard Agent",
  user: "My Dashboard",
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

const Dashboard = () => {
  const user = getUser();
  const userRole = user?.role || "user";
  const userId = user?.id ?? user?._id;

  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        setError("");

        if (!userId) {
          setTickets([]);
          return;
        }

        const response =
          userRole === "admin"
            ? await getAllTickets()
            : userRole === "agent"
              ? await getAssignedTickets(userId)
              : await getMyTickets(userId);

        setTickets(response.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [userId, userRole]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await getUsers(1, "all", 1000);
        setEmployees(response.data?.data?.users || []);
      } catch (err) {
        console.error("Failed to load employees for dashboard", err);
      }
    };

    fetchEmployees();
  }, []);

  const newJoiners = useMemo(() => {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    return employees
      .filter(
        (employee) =>
          employee.createdAt && new Date(employee.createdAt) >= monthAgo
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [employees]);

  const quickLinks = [
    { label: "Employee records", to: "/employees", icon: Users },
    { label: "Attendance & work hours", to: "/attendance", icon: Clock3 },
    { label: "Leave management", to: "/leave", icon: CalendarDays },
    { label: "Payroll & payslips", to: "/payslip", icon: FileBarChart },
  ];

  const statusCounts = useMemo(() => {
    return ["Open", "In Progress", "Resolved", "Closed"].map((status) => ({
      name: status,
      value: tickets.filter((ticket) => ticket.status === status).length,
    }));
  }, [tickets]);

  const totalTickets = tickets.length;
  const openCount =
    statusCounts.find((item) => item.name === "Open")?.value || 0;
  const progressCount =
    statusCounts.find((item) => item.name === "In Progress")?.value || 0;
  const resolvedCount =
    statusCounts.find((item) => item.name === "Resolved")?.value || 0;
  const closedCount =
    statusCounts.find((item) => item.name === "Closed")?.value || 0;

  const statusBarData = statusCounts.map((item) => ({
    ...item,
    value: item.value,
  }));

  const recentTickets = [...tickets]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <UserLayout>
      <div className="space-y-6">
        <div className="bg-linear-to-r from-slate-900 to-teal-700 rounded-3xl p-8 text-white shadow-lg">
          <h1 className="text-4xl font-bold">
            {ROLE_TITLES[userRole] || ROLE_TITLES.user}
          </h1>
          <p className="mt-3 text-slate-200">
            Welcome back {user?.name || "User"}, Here is a summary of your
            documents and statuses.
          </p>
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl shadow p-12 text-center text-slate-500">
            Loading dashboard...
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl shadow p-12 text-center">
            <p className="text-red-500 font-semibold">{error}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="bg-white rounded-2xl p-6 shadow">
                <p className="text-slate-500">Total Employee</p>
                <h2 className="text-4xl font-bold text-teal-700">
                  {totalTickets}
                </h2>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow">
                <p className="text-slate-500">Active</p>
                <h2 className="text-4xl font-bold text-teal-700">
                  {openCount}
                </h2>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow">
                <p className="text-slate-500">New Joiners</p>
                <h2 className="text-4xl font-bold text-blue-500">
                  {progressCount}
                </h2>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow">
                <p className="text-slate-500">Departures</p>
                <h2 className="text-4xl font-bold text-teal-600">
                  {resolvedCount}
                </h2>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow">
                <p className="text-slate-500">Closed</p>
                <h2 className="text-4xl font-bold text-slate-500">
                  {closedCount}
                </h2>
              </div>
            </div>


            <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Today&apos;s attendance</h2>
                <p className="mt-1 text-sm text-slate-500">Live workforce availability.</p>
              </div>
              <Clock3 className="text-teal-600" size={22} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {["Present", "Late", "Absent", "On leave", "Currently working"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">{item}</span>
                  <span className="font-bold text-slate-400">—</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Connect an attendance source to populate today&apos;s figures.
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Pending approvals</h2>
                <p className="mt-1 text-sm text-slate-500">Items that need HR attention.</p>
              </div>
              <CheckCircle2 className="text-teal-600" size={22} />
            </div>
            <div className="space-y-3">
              {["Leave requests", "Attendance corrections", "Payroll reviews", "Employee requests"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                  <span className="text-sm text-slate-600">{item}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400">
                    Not connected
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Upcoming HR activities</h2>
                <p className="mt-1 text-sm text-slate-500">Important dates to keep on your radar.</p>
              </div>
              <Bell className="text-teal-600" size={22} />
            </div>
            <EmptyState
              icon={CalendarDays}
              title="No upcoming activities available"
              description="Birthdays, probation reviews, renewals, interviews and training deadlines will appear here when those records are connected."
            />
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Quick links</h2>
                <p className="mt-1 text-sm text-slate-500">Jump straight to common HR tasks.</p>
              </div>
              <ArrowRight className="text-teal-600" size={22} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickLinks.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-teal-200 hover:bg-teal-50"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <Icon className="text-teal-600" size={18} />
                    {label}
                  </span>
                  <ArrowRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-600" size={16} />
                </Link>
              ))}
            </div>
          </section>
        </div>

        {newJoiners.length > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <h2 className="text-xl font-bold text-slate-800">Recent joiners</h2>
            <p className="mt-1 text-sm text-slate-500">People added to the employee directory recently.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {newJoiners.slice(0, 6).map((employee) => (
                <div key={employee._id || employee.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="grid h-10 w-10 place-content-center rounded-full bg-teal-100 font-bold text-teal-700">
                    {(employee.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">{employee.name || "Unnamed employee"}</p>
                    <p className="text-xs text-slate-500">Joined {formatDate(employee.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="bg-slate-100 rounded-3xl shadow p-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-slate-800">
                     Status Breakdown
                  </h2>
                  <p className="text-slate-500 mt-1">
                    Pie chart of  statuses
                  </p>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusCounts}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={65}
                        paddingAngle={3}
                      >
                        {statusCounts.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[entry.name] || "#cbd5e1"}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-100 rounded-3xl shadow p-6">
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-slate-800">
                    Status Graph
                  </h2>
                  <p className="text-slate-500 mt-1">
                    Bar graph of the same status summary....
                  </p>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusBarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {statusBarData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[entry.name] || "#94a3b8"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow p-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">
                Recent Documents
              </h2>

              {recentTickets.length === 0 ? (
                <p className="text-slate-500">No documents available</p>
              ) : (
                <div className="space-y-4">
                  {recentTickets.map((ticket) => (
                    <div
                      key={ticket._id}
                      className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div>
                        <h3 className="font-semibold text-slate-800">
                          {ticket.title}
                        </h3>
                        <p className="text-slate-500 text-sm">
                          {ticket.ticketNumber} • {ticket.category}
                        </p>
                      </div>

                      <span
                        className={`inline-flex w-fit px-3 py-1 rounded-full text-sm font-medium ${
                          ticket.status === "Open"
                            ? "bg-teal-100 text-teal-700"
                            : ticket.status === "In Progress"
                              ? "bg-blue-100 text-blue-600"
                              : ticket.status === "Resolved"
                                ? "bg-teal-100 text-teal-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </UserLayout>
  );
};

export default Dashboard;
