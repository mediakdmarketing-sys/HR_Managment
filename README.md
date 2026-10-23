# HRMS – HR Management Portal

A role-based HR management system for KD Marketing Group. Each role gets its own dashboard and sidebar. HR manages employees, leave and letter templates. Employees request leave and track their requests.

- **Frontend:** React 19 + Vite + Tailwind CSS (`client/`), deployed on **Vercel**
- **Backend:** Node.js + Express 5 (`server/`), deployed on **Render**
- **Database & auth:** Firebase Authentication (email/password) + Cloud Firestore
- **Letters:** offer and service letters generated as PDF in the browser with `@react-pdf/renderer`

---

## Features

| Area | What it does |
|---|---|
| **Role-based access** | The sidebar and dashboard change with the user's role: HR, Manager, Team Lead, Employee, Recruiter or Finance. |
| **Dashboards** | HR sees live headcount, active employees, new joiners (added in the last 14 days), departures, people on leave today and pending leave approvals. Other roles see their own leave summary, profile, recent requests and upcoming leave. |
| **Employee management** (HR) | Add, view, edit and disable employees. |
| **Leave management** | Employees submit leave with an optional PDF/PNG/JPEG attachment (max 5 MB). Requests are approved or rejected according to the routing rules below. |
| **Birthday reminders** (HR) | From 2 days before an employee's birthday (based on the date of birth in their profile), every HR user gets one "Upcoming birthday" notification. The check runs when HR's notifications load, at most once an hour, so it works on Render's free plan without a scheduled job. |
| **Notifications** | The bell shows real notifications. New ones also appear as toasts (green for approved, red for rejected). The app checks for new ones every 10 seconds. |
| **Letter templates** (HR) | Offer and service letters for any employee. HR sets the logo, an optional signature and the company details once. Picking an employee opens an editor pre-filled from their record, with a live preview of the exact PDF; every field and clause can be edited before downloading. |
| **Expense tracker** (HR) | Record income and expense entries (name, description, value, date). Shows total income, total expenses and the net balance, with a from–to date range picker (presets: this month, last month, last 30 days, this year, all time). Entries can be edited or deleted. |
| **Attendance** | Uses mock data for now. |
| **Payslips** | Payslips use the letterhead logo and company details. Earnings table: basic salary, full days, half days and other hours (count × rate), with gross pay. Counts come from mock data or an imported CSV (see `client/src/assets/samplePayslips.csv` for the columns). |

### Leave approval routing

| Request from | Who can view and approve or reject it |
|---|---|
| HR | Any **Manager** |
| Everyone else | **HR** and the employee's **assigned team lead** |

No one can approve their own request. The requester is notified when a decision is made. A request can only be decided once. Submitting a request that overlaps one of your own pending or approved requests is rejected.

### Access control

- **Pages:** every page except `/` and `/login` requires login. Each page is limited to the roles that see it in the sidebar. Other URLs redirect to the dashboard.
- **API:** all `/api` routes (except `/api/auth` and `/api/health`) require a valid Firebase ID token. Adding, editing and disabling employees is HR only. The employee directory is limited to HR, Managers, Team Leads and Recruiters. Everyone can read their own record.
- **Sessions:** Firebase ID tokens always expire after 1 hour, so the client requests a fresh token from Firebase before each API call. A session lasts until logout, or `VITE_SESSION_HOURS` (default 12 hours), whichever comes first. An expired or rejected session sends the user back to the login page.

---

## Project structure

```
HR_Portal/
├── client/                 React frontend (Vercel)
│   ├── src/Pages/          Dashboard, Employees, Leave, Templates, Attendance, ...
│   ├── src/components/     Sidebar, NavBar (notifications)
│   ├── src/layouts/        UserLayout (notification polling)
│   ├── src/api/            Axios API clients
│   ├── src/letters/        offer & service letter content and PDF layout
│   ├── src/utils/          auth, session and theme helpers
│   └── vercel.json         SPA rewrite so deep links work on refresh
└── server/                 Express API (Render)
    ├── routes/ controllers/ services/
    ├── middleware/         Firebase token auth, role checks
    ├── config/firebase.js  Firebase Admin SDK setup
    └── database/init.js    Seeds demo employees into Firebase on startup
```

### Where data is stored (Firestore)

| Collection | Contents |
|---|---|
| `employees` | Employee records (document ID = employee ID, e.g. `EMP001`). `uid` links to Firebase Auth. |
| `leaveRequests` | Leave requests |
| `leaveAttachments` | Attachment files, stored in chunks of about 900 KB (so Firebase Storage is not needed) |
| `notifications` | In-app notifications |
| `transactions` | Expense tracker income and expense entries |
| `settings/letterLogo`, `settings/letterSignature`, `settings/letterCompany` | Letterhead logo, authorised signature and company details used in letters |

> Ticket-related files (`ticket.*`) are left over from an earlier project and are not used.

---

## Running locally

**Requirements:** Node.js 20.19 or newer and a Firebase project.

### 1. Firebase setup (once)

1. In the [Firebase Console](https://console.firebase.google.com/), open the project (currently `hr-portal-604a1`).
2. **Build → Authentication → Get started**, then enable **Email/Password**.
3. **Build → Firestore Database**: create a database.
4. **Project settings → Service accounts → Generate new private key.** This downloads a JSON file with the backend credentials. Never commit it.
5. **Project settings → General → Your apps**: add a **Web app** and copy its config values (for the frontend).

### 2. Backend

```bash
cd server
cp .env.example .env      # then fill in the values
npm install
npm run dev               # http://localhost:5000 (restarts automatically on file changes)
```

| Variable | Value |
|---|---|
| `PORT` | `5000` |
| `BIRTHDAY_TIMEZONE` | Optional. Time zone used to decide "today" for birthday reminders (default `Asia/Colombo`). |
| `CLIENT_URL` | Allowed frontend origin(s), comma-separated. Not needed locally, because localhost:5173 is always allowed. |
| `FIREBASE_PROJECT_ID` | `project_id` from the service-account JSON |
| `FIREBASE_CLIENT_EMAIL` | `client_email` from the service-account JSON |
| `FIREBASE_PRIVATE_KEY` | `private_key` from the service-account JSON, in quotes, with `\n` line breaks |
| `FIREBASE_STORAGE_BUCKET` | `<project-id>.firebasestorage.app`. Required at startup, even though new attachments are stored in Firestore. |

On first start, the server creates the demo employees from `server/mockEmployees.js` in Firebase Auth and Firestore if they don't exist yet.

### 3. Frontend

```bash
cd client
cp .env.example .env      # then fill in the values
npm install
npm run dev               # http://localhost:5173
```

| Variable | Value |
|---|---|
| `VITE_API_URL` | `http://localhost:5000/api` |
| `VITE_FIREBASE_*` | Values from the Firebase web app config |
| `VITE_SESSION_HOURS` | Optional. Maximum login session length in hours (default `12`). |

> Vite reads `.env` only when it starts. Restart `npm run dev` after changing it.

---

## Deployment (Render + Vercel)

Do the steps in this order. The frontend needs the backend URL, and the backend needs the frontend URL.

### Step 1 – Backend on Render

1. In [Render](https://render.com/), go to **New → Web Service** and connect the GitHub repo.
2. Settings:

   | Setting | Value |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` |

3. **Environment variables**: add `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` and `FIREBASE_STORAGE_BUCKET`. For `FIREBASE_PRIVATE_KEY`, paste the whole key, including the `-----BEGIN/END PRIVATE KEY-----` lines. Either real line breaks or `\n` work. Don't set `PORT`; Render provides it.
4. Deploy, then open `https://<your-service>.onrender.com/api/health`. It should return `{"success":true}`.

> On Render's free plan, the service sleeps after about 15 minutes without traffic. The first request after that can take about a minute.

### Step 2 – Frontend on Vercel

1. In [Vercel](https://vercel.com/), click **Add New → Project** and import the GitHub repo.
2. Settings:

   | Setting | Value |
   |---|---|
   | Root Directory | `client` |
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

3. **Environment variables**: add all the `VITE_*` values from `client/.env`, but set the API URL to Render:
   ```
   VITE_API_URL=https://<your-service>.onrender.com/api
   ```
4. Deploy. If you change an environment variable later, **redeploy**, because Vite builds the values into the app.

### Step 3 – Connect them

| Where | What to add |
|---|---|
| **Render** → Environment | `CLIENT_URL=https://<your-app>.vercel.app` (no trailing slash; separate several with commas). Render redeploys automatically. |
| **Firebase Console** → Authentication → Settings → Authorized domains | `<your-app>.vercel.app` |
| **Google Cloud** → APIs & Services → Credentials → *Browser key (auto created by Firebase)* | Only if the key has **HTTP referrer** restrictions: add `https://<your-app>.vercel.app/*` |

The Render URL does **not** need to be added to Firebase. Firebase Auth is called from the browser, not from the server.

If you add a custom domain later, add it in the same places.

### Deployment checklist

- [ ] `/api/health` on Render returns `{"success":true}`
- [ ] Logging in on the Vercel URL works (if not, check the browser console for CORS errors, then check `CLIENT_URL`)
- [ ] Refreshing a page such as `/leave` works (handled by `client/vercel.json`)
- [ ] Letter templates: an offer letter preview appears and downloads as PDF

---

## Security notes

- **Never commit `.env` files or the service-account JSON.** They are listed in `.gitignore`. Use `.env.example` for placeholders.
- The service-account private key was pushed to GitHub in an earlier commit. Replace it: in **Firebase → Project settings → Service accounts**, generate a new key. Then go to **Google Cloud → IAM & Admin → Service accounts → firebase-adminsdk → Keys** and delete the old one.
- Demo employees have known passwords from `mockEmployees.js`. Change them, or disable those accounts, before real use.

## Known limitations / next steps

- Attendance uses mock data; payroll is not implemented yet.
