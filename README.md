# HRMS – HR Management Portal

A role-based HR management system for KD Marketing Group. Each role gets its own dashboard and sidebar. HR manages employees, leave and letter templates. Employees request leave and track their requests.

- **Frontend:** React 19 + Vite + Tailwind CSS (`client/`), deployed on **Vercel**
- **Backend:** Node.js + Express 5 (`server/`), deployed on **Render**
- **Database & auth:** Firebase Authentication (email/password) + Cloud Firestore
- **Letters:** generated as `.docx` in the browser and opened in **Google Docs** via the Google Drive API

---

## Features

| Area | What it does |
|---|---|
| **Role-based access** | The sidebar and dashboard change with the user's role: HR, Manager, Team Lead, Employee, Recruiter or Finance. |
| **Dashboards** | HR sees live headcount, active employees, new joiners (added in the last 14 days), departures, people on leave today and pending leave approvals. Other roles see their own leave summary, profile, recent requests and upcoming leave. |
| **Employee management** (HR) | Add, view, edit and disable employees. |
| **Leave management** | Employees submit leave with an optional PDF/PNG/JPEG attachment (max 5 MB). Requests are approved or rejected according to the routing rules below. |
| **Notifications** | The bell shows real notifications. New ones also appear as toasts (green for approved, red for rejected). The app checks for new ones every 10 seconds. |
| **Letter templates** (HR) | Offer letter and service letter. HR uploads or replaces a company logo, which appears in the letter header. Each letter opens as a new Google Doc in the HR user's Drive, with yellow-highlighted `[placeholders]` to fill in. It can also be downloaded as `.docx`. |
| **Attendance** | Uses mock data for now. |
| **Payroll** | Not built yet; still under discussion. |

### Leave approval routing

| Request from | Who can view and approve or reject it |
|---|---|
| HR | Any **Manager** |
| Everyone else | **HR** and the employee's **assigned team lead** |

No one can approve their own request. The requester is notified when a decision is made.

---

## Project structure

```
HR_Portal/
├── client/                 React frontend (Vercel)
│   ├── src/Pages/          Dashboard, Employees, Leave, Templates, Attendance, ...
│   ├── src/components/     Sidebar, NavBar (notifications)
│   ├── src/layouts/        UserLayout (notification polling)
│   ├── src/api/            Axios API clients
│   ├── src/utils/          auth helpers, letter templates (.docx), Google Docs upload
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
| `settings/letterLogo` | Company logo used in letter templates |

> Ticket-related files (`ticket.*`) are left over from an earlier project and are not used.

---

## Running locally

**Requirements:** Node.js 20.19 or newer, a Firebase project, and a Google Cloud OAuth client (only needed for Google Docs).

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
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID for Google Docs (see below). Without it, letters can only be downloaded as `.docx`. |

> Vite reads `.env` only when it starts. Restart `npm run dev` after changing it.

### 4. Google Docs for letter templates (once)

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and select the same project as Firebase.
2. **APIs & Services → Library**: enable the **Google Drive API**.
3. **Google Auth Platform → Branding**: set the app name and support email.
4. **Google Auth Platform → Audience**: either add each HR user's Google account under **Test users**, or click **Publish app**. The app only uses the `drive.file` scope (files it creates itself), so Google does not require a review.
5. **Google Auth Platform → Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** `http://localhost:5173`, plus your Vercel URL once deployed
   - **Authorized redirect URIs:** leave empty (the app uses a popup to get a token)
6. Copy the client ID into `VITE_GOOGLE_CLIENT_ID`.

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
| **Google Auth Platform** → Clients → your web client → Authorized JavaScript origins | `https://<your-app>.vercel.app` (keep `http://localhost:5173`). The Client ID stays the same. It can take a few minutes to take effect. |
| **Firebase Console** → Authentication → Settings → Authorized domains | `<your-app>.vercel.app` |
| **Google Cloud** → APIs & Services → Credentials → *Browser key (auto created by Firebase)* | Only if the key has **HTTP referrer** restrictions: add `https://<your-app>.vercel.app/*` |

The Render URL does **not** need to be added to Google Auth Platform or Firebase. Google Drive and Firebase Auth are called from the browser, not from the server.

If you add a custom domain later, add it in the same four places.

### Deployment checklist

- [ ] `/api/health` on Render returns `{"success":true}`
- [ ] Logging in on the Vercel URL works (if not, check the browser console for CORS errors, then check `CLIENT_URL`)
- [ ] Refreshing a page such as `/leave` works (handled by `client/vercel.json`)
- [ ] Letter templates open in Google Docs (if not: `origin_mismatch` means the JavaScript origin is missing; `access_denied` means the account is not a test user)

---

## Security notes

- **Never commit `.env` files or the service-account JSON.** They are listed in `.gitignore`. Use `.env.example` for placeholders.
- The service-account private key was pushed to GitHub in an earlier commit. Replace it: in **Firebase → Project settings → Service accounts**, generate a new key. Then go to **Google Cloud → IAM & Admin → Service accounts → firebase-adminsdk → Keys** and delete the old one.
- Demo employees have known passwords from `mockEmployees.js`. Change them, or disable those accounts, before real use.

## Known limitations / next steps

- `/api/users` routes (employee management) are not yet protected by login or role checks on the server.
- The Firebase ID token stored at login expires after 1 hour and is not refreshed automatically.
- Attendance uses mock data; payroll is not implemented yet.
