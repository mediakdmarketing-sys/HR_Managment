import { useMemo, useState } from "react";
import {
  Award,
  BookOpenCheck,
  ClipboardCheck,
  LockKeyhole,
  MessageSquare,
  Plus,
  Target,
  UserCheck,
} from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import mockEmployees from "../assets/mockEmployees";
import { getUser } from "../utils/auth";

const initialGoals = [
  { id: 1, employeeId: "EMP003", employee: "Tharshihan", title: "Deliver sprint features", progress: 72, due: "Oct 31, 2026", status: "On track" },
  { id: 2, employeeId: "EMP004", employee: "Arun Prakash", title: "Improve code review quality", progress: 48, due: "Nov 15, 2026", status: "Needs attention" },
  { id: 3, employeeId: "EMP009", employee: "Madhan", title: "Grow campaign conversion", progress: 84, due: "Nov 10, 2026", status: "On track" },
];

const courses = [
  { id: 1, title: "Workplace communication", category: "Professional skills", assigned: 14, completed: 9, certificate: true },
  { id: 2, title: "Data privacy and security", category: "Compliance", assigned: 18, completed: 15, certificate: true },
  { id: 3, title: "Leadership essentials", category: "Leadership", assigned: 6, completed: 3, certificate: true },
];

const initialPlans = [
  { id: 1, employee: "Arun Prakash", employeeId: "EMP004", milestone: "Complete weekly mentoring sessions", reviewDate: "Nov 05, 2026", progress: 50 },
  { id: 2, employee: "Karthik", employeeId: "EMP005", milestone: "Return-to-work performance review", reviewDate: "Nov 12, 2026", progress: 25 },
];

const statusClasses = {
  "On track": "bg-emerald-100 text-emerald-700",
  "Needs attention": "bg-amber-100 text-amber-700",
};

const StatCard = ({ label, value, detail, icon: Icon, color }) => (
  <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
    <div className="flex items-start justify-between">
      <div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-800">{value}</p></div>
      <div className={`rounded-xl p-3 ${color}`}><Icon size={21} /></div>
    </div>
    <p className="mt-4 text-xs text-slate-500">{detail}</p>
  </div>
);

const ProgressBar = ({ value }) => (
  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
    <div className="h-full rounded-full bg-teal-600" style={{ width: `${value}%` }} />
  </div>
);

const SectionHeader = ({ title, description, icon: Icon }) => (
  <div className="mb-5 flex items-center justify-between">
    <div><h2 className="text-xl font-bold text-slate-800">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
    <Icon className="text-teal-600" size={22} />
  </div>
);

function Performance() {
  const user = getUser();
  const role = user?.role || "Employees";
  const isHr = role.toLowerCase() === "hr";
  const isManager = role === "Managers" || role === "Team Lead";
  const currentEmployee = mockEmployees.find((employee) => employee.id === user?.id || employee.email === user?.email) || mockEmployees[2];
  const [goals, setGoals] = useState(initialGoals);
  const [plans] = useState(initialPlans);
  const [activeTab, setActiveTab] = useState("overview");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");

  const visibleGoals = isHr || isManager ? goals : goals.filter((goal) => goal.employeeId === currentEmployee.id);
  const visiblePlans = isHr || isManager ? plans : plans.filter((plan) => plan.employeeId === currentEmployee.id);
  const completedCourses = isHr ? courses.reduce((sum, course) => sum + course.completed, 0) : 2;

  const addGoal = (event) => {
    event.preventDefault();
    if (!goalTitle.trim()) return;
    setGoals((current) => [{ id: Date.now(), employeeId: currentEmployee.id, employee: currentEmployee.name, title: goalTitle.trim(), progress: 0, due: "Dec 15, 2026", status: "On track" }, ...current]);
    setGoalTitle("");
    setShowGoalForm(false);
  };

  const updateProgress = (id, progress) => {
    setGoals((current) => current.map((goal) => goal.id === id ? { ...goal, progress: Number(progress), status: Number(progress) < 40 ? "Needs attention" : "On track" } : goal));
  };

  const teamCount = useMemo(() => mockEmployees.filter((employee) => employee.assignedTeamLead === currentEmployee.name).length, [currentEmployee.name]);

  return (
    <UserLayout>
      <div className="space-y-6">
        <section className="rounded-3xl bg-linear-to-r from-slate-900 to-teal-700 p-8 text-white shadow-lg">
          <p className="text-sm font-medium text-teal-200">{isHr ? "HR operations" : isManager ? "Manager workspace" : "Employee self-service"}</p>
          <h1 className="mt-2 text-4xl font-bold">Performance & Training</h1>
          <p className="mt-3 text-slate-200">{isHr ? "Manage review cycles, training, goals and sensitive employee records." : isManager ? "Support your team goals, feedback and development plans." : "Track your goals, courses, reviews and professional development."}</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={isHr ? "Review cycle" : "My review"} value={isHr ? "Q4" : "Dec 15"} detail={isHr ? "Current review period" : "Next review date"} icon={ClipboardCheck} color="bg-teal-50 text-teal-700" />
          <StatCard label={isHr ? "Active goals" : "Goal progress"} value={isHr ? goals.length : `${visibleGoals[0]?.progress || 72}%`} detail={isHr ? "Across the organisation" : "Average completion"} icon={Target} color="bg-blue-50 text-blue-700" />
          <StatCard label="Courses completed" value={completedCourses} detail={isHr ? "Across all assigned courses" : "This year"} icon={BookOpenCheck} color="bg-emerald-50 text-emerald-700" />
          <StatCard label={isHr ? "Improvement plans" : "Recognition"} value={isHr ? plans.length : "3"} detail={isHr ? "Plans requiring milestones" : "Recent acknowledgements"} icon={Award} color="bg-amber-50 text-amber-700" />
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
          {[["overview", "Overview"], ["goals", "Goals & KPIs"], ["training", "Training"], ...(isHr || isManager ? [["plans", "Improvement plans"]] : []), ["reviews", "Reviews & feedback"]].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setActiveTab(value)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === value ? "border-teal-700 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <SectionHeader title="Review cycle" description="Goals, KPIs and manager feedback for the current cycle." icon={ClipboardCheck} />
              <div className="space-y-4">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Goal reviews completed</span><span className="font-semibold text-slate-700">68%</span></div><ProgressBar value={68} />
                <div className="flex justify-between text-sm"><span className="text-slate-500">Manager feedback submitted</span><span className="font-semibold text-slate-700">54%</span></div><ProgressBar value={54} />
                <div className="flex justify-between text-sm"><span className="text-slate-500">Employee comments received</span><span className="font-semibold text-slate-700">81%</span></div><ProgressBar value={81} />
              </div>
            </section>
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <SectionHeader title="Recognition" description="Recent achievements and team appreciation." icon={Award} />
              <div className="space-y-3">{["Customer success champion", "Reliable team contributor", "Knowledge sharing award"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><div className="grid h-9 w-9 place-content-center rounded-full bg-amber-100 text-amber-700"><Award size={17} /></div><div><p className="font-semibold text-slate-700">{item}</p><p className="text-xs text-slate-500">{index + 1} recognition record · Q4 2026</p></div></div>)}</div>
            </section>
          </div>
        )}

        {activeTab === "goals" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-5 flex items-center justify-between"><SectionHeader title="Goals & KPIs" description="Track measurable objectives and review progress." icon={Target} /><button type="button" onClick={() => setShowGoalForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"><Plus size={17} /> Add goal</button></div>
            <div className="space-y-4">{visibleGoals.map((goal) => <div key={goal.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><p className="font-semibold text-slate-800">{goal.title}</p>{(isHr || isManager) && <p className="mt-1 text-xs text-slate-500">{goal.employee}</p>}</div><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[goal.status]}`}>{goal.status}</span></div><div className="mt-3 flex items-center justify-between text-sm"><span className="text-slate-500">Progress</span><span className="font-semibold text-slate-700">{goal.progress}% · Due {goal.due}</span></div><ProgressBar value={goal.progress} />{(isHr || isManager) && <input type="range" min="0" max="100" value={goal.progress} onChange={(event) => updateProgress(goal.id, event.target.value)} className="mt-3 w-full accent-teal-700" />}</div>)}</div>
          </section>
        )}

        {activeTab === "training" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <SectionHeader title="Training catalogue" description="Assigned courses, attendance, completion and certificates." icon={BookOpenCheck} />
            <div className="grid gap-4 md:grid-cols-3">{courses.map((course) => <div key={course.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between"><BookOpenCheck className="text-teal-700" size={21} />{course.certificate && <span className="text-xs font-semibold text-emerald-700">Certificate</span>}</div><h3 className="mt-4 font-semibold text-slate-800">{course.title}</h3><p className="mt-1 text-sm text-slate-500">{course.category}</p><div className="mt-4 flex justify-between text-xs text-slate-500"><span>{isHr ? `${course.completed}/${course.assigned} completed` : "Assigned to you"}</span><span>{isHr ? Math.round((course.completed / course.assigned) * 100) : "In progress"}</span></div>{isHr && <ProgressBar value={(course.completed / course.assigned) * 100} />}</div>)}</div>
          </section>
        )}

        {activeTab === "plans" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <SectionHeader title="Performance improvement plans" description="Milestones, support actions and review dates." icon={UserCheck} />
            <div className="space-y-3">{visiblePlans.map((plan) => <div key={plan.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold text-slate-800">{plan.milestone}</p><p className="mt-1 text-sm text-slate-500">{plan.employee} · Review {plan.reviewDate}</p></div><span className="text-sm font-semibold text-teal-700">{plan.progress}%</span></div><ProgressBar value={plan.progress} /></div>)}</div>
          </section>
        )}

        {activeTab === "reviews" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <SectionHeader title="Reviews & feedback" description="Access is limited to authorised managers and HR." icon={MessageSquare} />
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><LockKeyhole className="mt-0.5 text-slate-500" size={20} /><div><p className="font-semibold text-slate-700">{isHr || isManager ? "Authorised review access" : "Employee review access"}</p><p className="mt-1 text-sm text-slate-500">{isHr ? `You can review sensitive records for all employees. ${teamCount} team member(s) are assigned to you.` : isManager ? "You can review sensitive records for employees assigned to your team." : "You can view your own review summary and submit comments. Manager-only notes remain restricted."}</p></div></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">Manager feedback</p><p className="mt-2 text-sm text-slate-500">Strong collaboration and consistent delivery during the current review cycle.</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">Employee comments</p><p className="mt-2 text-sm text-slate-500">Comments and acknowledgement can be added during the review window.</p></div></div>
          </section>
        )}

        {showGoalForm && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"><form onSubmit={addGoal} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-800">Add goal</h2><button type="button" onClick={() => setShowGoalForm(false)} className="text-slate-400">×</button></div><label className="mt-5 block text-sm font-semibold text-slate-700">Goal title<input required value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-600" placeholder="Improve quarterly KPI" /></label><button type="submit" className="mt-5 w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800">Add goal</button></form></div>}
      </div>
    </UserLayout>
  );
}

export default Performance;
