import "dotenv/config";
import pool from "../config/db.js";
import { firebaseAuth, firestore, storageBucket } from "../config/firebase.js";

const writeDocuments = async (collection, documents) => {
  for (let index = 0; index < documents.length; index += 400) {
    const batch = firestore.batch();
    documents.slice(index, index + 400).forEach(({ id, data }) => {
      batch.set(firestore.collection(collection).doc(String(id)), data, { merge: true });
    });
    await batch.commit();
  }
};

const migrate = async () => {
  const employees = (await pool.query("SELECT * FROM employees")).rows;
  const usersToImport = employees.map((employee) => ({
    uid: employee.id,
    email: employee.email.toLowerCase(),
    displayName: employee.name,
    passwordHash: Buffer.from(employee.password),
    disabled: employee.status !== "Active",
  }));
  if (usersToImport.length) {
    const result = await firebaseAuth.importUsers(usersToImport, {
      hash: { algorithm: "BCRYPT" },
    });
    if (result.failureCount) {
      console.warn(`Firebase Auth imported with ${result.failureCount} failures.`);
      result.errors.forEach((failure) => console.warn(failure.error.message));
    }
  }

  await writeDocuments("employees", employees.map((employee) => ({
    id: employee.id,
    data: {
      uid: employee.id,
      name: employee.name,
      email: employee.email.toLowerCase(),
      department: employee.department,
      status: employee.status,
      role: employee.role,
      assignedTeamLead: employee.assigned_team_lead,
      workingHours: Number(employee.working_hours),
      totalBreakHours: Number(employee.total_break_hours),
      monthlyTotalWorkingHours: Number(employee.monthly_total_working_hours),
      createdAt: employee.created_at?.toISOString?.() || new Date().toISOString(),
    },
  })));

  const departments = (await pool.query("SELECT * FROM departments")).rows;
  await writeDocuments("departments", departments.map((row) => ({
    id: row.id,
    data: { name: row.name, createdAt: row.created_at?.toISOString?.() },
  })));

  const attendance = (await pool.query("SELECT * FROM attendance")).rows;
  await writeDocuments("attendance", attendance.map((row) => ({
    id: row.id,
    data: {
      name: row.name, email: row.email, department: row.department, status: row.status,
      workingHours: Number(row.working_hours), totalBreakTime: Number(row.total_break_time),
      monthlyTotalWorkingHours: Number(row.monthly_total_working_hours),
      createdAt: row.created_at?.toISOString?.(),
    },
  })));

  const tickets = (await pool.query("SELECT * FROM tickets")).rows;
  await writeDocuments("tickets", tickets.map((row) => ({
    id: row.id,
    data: {
      ...row.data,
      ticketNumber: row.ticket_number,
      createdAt: row.created_at?.toISOString?.(),
    },
  })));

  const leaves = (await pool.query("SELECT * FROM leave_requests")).rows;
  for (const leave of leaves) {
    const data = {
      employeeId: leave.employee_id,
      type: leave.leave_type,
      startDate: leave.start_date.toISOString().slice(0, 10),
      endDate: leave.end_date.toISOString().slice(0, 10),
      days: leave.days,
      reason: leave.reason,
      attachment: leave.attachment || null,
      attachmentMime: leave.attachment_mime || null,
      status: leave.status,
      createdAt: leave.created_at?.toISOString?.(),
    };
    if (leave.attachment_data) {
      const path = `leave-attachments/${leave.id}-${(leave.attachment || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await storageBucket.file(path).save(Buffer.from(leave.attachment_data, "base64"), {
        metadata: { contentType: leave.attachment_mime || "application/octet-stream" },
      });
      const [url] = await storageBucket.file(path).getSignedUrl({ action: "read", expires: "03-01-2035" });
      data.attachmentPath = path;
      data.attachmentUrl = url;
    }
    await firestore.collection("leaveRequests").doc(String(leave.id)).set(data, { merge: true });
  }

  const notifications = (await pool.query("SELECT * FROM notifications")).rows;
  await writeDocuments("notifications", notifications.map((row) => ({
    id: row.id,
    data: {
      recipientEmployeeId: row.recipient_employee_id,
      type: row.type,
      title: row.title,
      message: row.message,
      entityId: row.entity_id ? String(row.entity_id) : null,
      isRead: row.is_read,
      createdAt: row.created_at?.toISOString?.(),
    },
  })));

  console.log("PostgreSQL data migrated to Firebase.");
};

migrate()
  .catch((error) => {
    console.error("Firebase migration failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
