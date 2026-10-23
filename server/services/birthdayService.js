import { firestore } from "../config/firebase.js";

const employees = firestore.collection("employees");
const notifications = firestore.collection("notifications");

// Reminders start this many days before a birthday and continue until the day itself,
// so HR still gets one if nobody logs in on the exact day.
const REMINDER_DAYS = 2;
const TIME_ZONE = process.env.BIRTHDAY_TIMEZONE || "Asia/Colombo";
const RUN_INTERVAL_MS = 60 * 60 * 1000;
const ALREADY_EXISTS = 6;

let lastRunAt = 0;
let running = null;

// Today's date (year, month, day) in the company time zone, as a UTC-midnight Date.
const todayInTimeZone = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00Z`);
};

// Next occurrence of a yyyy-mm-dd birthday on or after `today`. Feb 29 falls on Feb 28
// in non-leap years.
const nextBirthday = (dateOfBirth, today) => {
  const [, month, day] = dateOfBirth.split("-").map(Number);
  const onYear = (year) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const safeDay = month === 2 && day === 29 && !leap ? 28 : day;
    return new Date(Date.UTC(year, month - 1, safeDay));
  };
  const thisYear = onYear(today.getUTCFullYear());
  return thisYear >= today ? thisYear : onYear(today.getUTCFullYear() + 1);
};

const describe = (name, daysAway, date) => {
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  if (daysAway === 0) return `${name}'s birthday is today (${when}).`;
  if (daysAway === 1) return `${name}'s birthday is tomorrow (${when}).`;
  return `${name}'s birthday is in ${daysAway} days (${when}).`;
};

const createReminders = async () => {
  const today = todayInTimeZone();
  const snapshot = await employees.where("status", "==", "Active").get();
  const active = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const hrStaff = active.filter((employee) => employee.role === "HR");

  const upcoming = active
    .filter((employee) => /^\d{4}-\d{2}-\d{2}$/.test(employee.dateOfBirth || ""))
    .map((employee) => {
      const birthday = nextBirthday(employee.dateOfBirth, today);
      return { employee, birthday, daysAway: Math.round((birthday - today) / 86400000) };
    })
    .filter(({ daysAway }) => daysAway <= REMINDER_DAYS);

  const writes = upcoming.flatMap(({ employee, birthday, daysAway }) =>
    hrStaff
      .filter((hr) => hr.id !== employee.id)
      .map(async (hr) => {
        // One reminder per HR user, per employee, per birthday year.
        const id = `birthday_${employee.id}_${birthday.getUTCFullYear()}_${hr.id}`;
        try {
          await notifications.doc(id).create({
            recipientEmployeeId: hr.id,
            type: "birthday_reminder",
            title: "Upcoming birthday",
            message: describe(employee.name, daysAway, birthday),
            entityId: employee.id,
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        } catch (error) {
          if (error.code !== ALREADY_EXISTS) throw error;
        }
      }),
  );
  await Promise.all(writes);
};

// Lets a newly entered date of birth take effect on the next check instead of within the hour.
export const resetBirthdayReminderCheck = () => {
  lastRunAt = 0;
};

// Called when an HR user loads notifications; runs at most once an hour per server.
export const ensureBirthdayReminders = async () => {
  if (Date.now() - lastRunAt < RUN_INTERVAL_MS) return;
  if (!running) {
    running = createReminders()
      .then(() => {
        lastRunAt = Date.now();
      })
      .finally(() => {
        running = null;
      });
  }
  await running;
};
