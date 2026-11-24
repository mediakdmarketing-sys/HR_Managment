import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, Building2, FileSignature, LockKeyhole, Settings2, Mail } from "lucide-react";
import UserLayout from "../layouts/UserLayout";
import { getRecruitmentStatus } from "../api/recruitmentApi";
import RecruitmentEmailSettings from "../components/RecruitmentEmailSettings";

const SettingCard = ({ id, title, description, icon: Icon, children }) => (
  <section id={id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-content-center rounded-xl bg-teal-50 text-teal-700">
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-slate-800">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  </section>
);

const Status = ({ label, enabled }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
    <span className="text-sm text-slate-600">{label}</span>
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
      enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
    }`}>
      {enabled ? "Configured" : "Unavailable"}
    </span>
  </div>
);

const Settings = () => {
  const [recruitmentStatus, setRecruitmentStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getRecruitmentStatus()
      .then((response) => {
        if (active) setRecruitmentStatus(response.data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Unable to load configuration status.");
      });
    return () => { active = false; };
  }, []);

  return (
    <UserLayout>
      <main className="space-y-6">
        <header>
          <p className="text-sm font-semibold text-teal-700">HRMS</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-800">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage available HRMS configuration from one place.</p>
        </header>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 xl:grid-cols-2">
          <SettingCard
            title="General and branding"
            description="Company details, logo, signature and document appearance."
            icon={Building2}
          >
            <Link to="/templates" className="text-sm font-semibold text-teal-700 hover:underline">
              Open letter and document settings
            </Link>
          </SettingCard>

          <SettingCard
            title="HRMS modules"
            description="Module-specific policies and settings are managed in their existing authorized screens."
            icon={Settings2}
          >
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-teal-700">
              <Link to="/attendance">Attendance</Link>
              <Link to="/leave">Leave policies</Link>
              <Link to="/payslip">Payroll</Link>
              <Link to="/templates">Documents</Link>
            </div>
          </SettingCard>

          <SettingCard
            id="recruitment"
            title="Recruitment integrations"
            description="Configuration status only. Provider credentials remain server-side and cannot be changed here."
            icon={BriefcaseBusiness}
          >
            {recruitmentStatus ? (
              <div>
                <Status label="Firebase recruitment database" enabled={recruitmentStatus.firebase} />
                <Status label="Groq AI screening" enabled={recruitmentStatus.groq} />
                <Status label="Email delivery" enabled={recruitmentStatus.email} />
                <Status label="GHL messaging" enabled={recruitmentStatus.ghl} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Loading configuration status...</p>
            )}
            <Link to="/recruitment/jobs" className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline">
              Open Recruitment
            </Link>
          </SettingCard>

          <SettingCard
            title="Security"
            description="Firebase HR authentication and profile security are managed by existing HRMS workflows."
            icon={LockKeyhole}
          >
            <Link to="/profile" className="text-sm font-semibold text-teal-700 hover:underline">
              Open HR profile
            </Link>
          </SettingCard>
        </div>

        {/* Recruitment Email Integration */}
        <RecruitmentEmailSettings />
      </main>
    </UserLayout>
  );
};

export default Settings;
