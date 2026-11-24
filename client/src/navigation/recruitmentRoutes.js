export const RECRUITMENT_NAVIGATION = [
  {
    label: "Recruitment Overview",
    path: "/recruitment/overview",
    page: "dashboard",
  },
  {
    label: "Jobs",
    path: "/recruitment/jobs",
    page: "jobs",
  },
  {
    label: "Candidates",
    path: "/recruitment/candidates",
    page: "candidates",
  },
  {
    label: "Applications",
    path: "/recruitment/applications",
    page: "applications",
  },
  {
    label: "Interviews",
    children: [
      {
        label: "Schedule Interview",
        path: "/recruitment/schedule-manage/schedule-interview",
        page: "schedule-interview",
      },
      {
        label: "All Interviews",
        path: "/recruitment/schedule-manage/all-interviews",
        page: "all-interviews",
      },
    ],
  },
  {
    label: "Conversations / Messages",
    children: [
      {
        label: "Chats",
        path: "/recruitment/conversations/chats",
        page: "chats",
      },
      {
        label: "Bulk Send",
        path: "/recruitment/conversations/bulk-send",
        page: "bulk-send",
      },
      {
        label: "Send History",
        path: "/recruitment/conversations/send-history",
        page: "send-history",
      },
      {
        label: "Mail Inbox",
        path: "/recruitment/conversations/mail-inbox",
        page: "mail-inbox",
      },
    ],
  },
  {
    label: "Hiring Alerts",
    path: "/recruitment/alerts",
    page: "notifications",
  },
  {
    label: "Email Settings",
    path: "/recruitment/email-settings",
    page: "email-settings",
  },
];

export const getRecruitmentPage = (pathname) => {
  if (pathname === "/recruitment/dashboard" || pathname === "/recruitment/overview") return "dashboard";
  if (pathname === "/recruitment/notifications" || pathname === "/recruitment/alerts") return "notifications";
  if (pathname === "/recruitment/applications") return "applications";
  if (pathname === "/recruitment/interviews") return "all-interviews";

  for (const item of RECRUITMENT_NAVIGATION) {
    if (item.path === pathname) return item.page;
    const child = item.children?.find(({ path }) => path === pathname);
    if (child) return child.page;
  }
  if (/^\/recruitment\/jobs\/[^/]+$/.test(pathname)) return "job-details";
  if (/^\/recruitment\/candidates\/[^/]+\/chat$/.test(pathname)) return "candidate-chat";
  if (/^\/recruitment\/candidates\/[^/]+\/profile$/.test(pathname)) return "candidate-profile";
  if (/^\/recruitment\/candidates\/[^/]+\/ai-analysis$/.test(pathname)) return "candidate-ai-analysis";
  if (/^\/recruitment\/candidates\/[^/]+$/.test(pathname)) return "candidate-details";
  if (/^\/recruitment\/resumes\/[^/]+$/.test(pathname)) return "resume-viewer";
  if (/^\/recruitment\/ai-analysis\/resume-upload$/.test(pathname)) return "resume-upload";
  if (/^\/recruitment\/ai-analysis\/ai-results$/.test(pathname)) return "ai-results";
  return null;
};

export const getRecruitmentGroupForPath = (pathname) =>
  RECRUITMENT_NAVIGATION.find((item) =>
    item.children?.some((child) => child.path === pathname),
  )?.label || (pathname.startsWith("/recruitment/candidates/") ? "Candidates" : null);

export const getRecruitmentRecordId = (pathname, page) => {
  const expressions = {
    "job-details": /^\/recruitment\/jobs\/([^/]+)$/,
    "candidate-details": /^\/recruitment\/candidates\/([^/]+)$/,
    "candidate-profile": /^\/recruitment\/candidates\/([^/]+)\/profile$/,
    "candidate-chat": /^\/recruitment\/candidates\/([^/]+)\/chat$/,
    "candidate-ai-analysis": /^\/recruitment\/candidates\/([^/]+)\/ai-analysis$/,
    "resume-viewer": /^\/recruitment\/resumes\/([^/]+)$/,
  };
  const match = pathname.match(expressions[page] || /$a/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const getRecruitmentRecordRoute = (type) => {
  if (type?.includes("interview")) return "/recruitment/schedule-manage/all-interviews";
  if (type?.includes("candidate") || type?.includes("application")) return "/recruitment/candidates";
  if (type?.includes("job")) return "/recruitment/jobs";
  return "/recruitment";
};
