import * as attendanceService from "../services/attendanceService.js";

export const listAttendance = async (req, res) => {
  try {
    const records = await attendanceService.getAttendanceRecords();
    return res.json({ success: true, data: records });
  } catch (error) {
    console.error("Could not load attendance records.", error);
    return res.status(500).json({
      success: false,
      message: "Could not load attendance records.",
    });
  }
};

export const importAttendance = async (req, res) => {
  try {
    const result = await attendanceService.importAttendanceRecords(
      req.body?.records,
      req.user.id,
    );
    return res.json({ success: true, data: result });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode === 500) console.error("Could not import attendance records.", error);
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 500 ? "Could not import attendance records." : error.message,
    });
  }
};
