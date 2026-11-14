import * as leaveService from "../services/leaveService.js";

export const listLeavePolicies = async (req, res) => {
  try {
    const policies = await leaveService.getLeavePolicies();
    return res.json({ success: true, data: policies });
  } catch (error) {
    console.error("Could not load leave policies.", error);
    return res.status(500).json({
      success: false,
      message: "Could not load leave policies.",
    });
  }
};

export const addLeavePolicy = async (req, res) => {
  try {
    const policy = await leaveService.createLeavePolicy({
      name: req.body?.name,
      createdBy: req.user.id,
    });
    return res.status(201).json({ success: true, data: policy });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode === 500) console.error("Could not save leave policy.", error);
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 500 ? "Could not save leave policy." : error.message,
    });
  }
};

export const previewLeaveAllocation = async (req, res) => {
  try {
    const allocation = await leaveService.getLeaveAllocationPreview(
      req.params.id,
      req.user,
    );
    if (!allocation) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }
    return res.json({ success: true, data: allocation });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode === 500) console.error("Could not calculate leave allocation.", error);
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 500 ? "Could not calculate leave allocation." : error.message,
    });
  }
};

export const listLeaves = async (req, res) => {
  try {
    const requests = await leaveService.getLeaveRequests(req.user);
    return res.json({ success: true, data: requests });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const listLeaveEmployees = async (_req, res) => {
  try {
    const employees = await leaveService.getLeaveEmployeesForHR();
    return res.json({ success: true, data: employees });
  } catch (error) {
    console.error("Could not load employees for leave requests.", error);
    return res.status(500).json({
      success: false,
      message: "Could not load employees for leave requests.",
    });
  }
};

export const createLeave = async (req, res) => {
  try {
    const {
      attachment,
      attachmentData,
      attachmentMime,
    } = req.body || {};
    if (attachmentData) {
      const allowedAttachmentTypes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
      ];
      if (
        typeof attachmentData !== "string" ||
        !attachment ||
        !allowedAttachmentTypes.includes(attachmentMime)
      ) {
        return res.status(400).json({
          success: false,
          message: "Only PDF, PNG and JPEG attachments are allowed",
        });
      }
      if (
        attachmentData.length > 7_000_000 ||
        Buffer.from(attachmentData, "base64").length > 5 * 1024 * 1024
      ) {
        return res.status(400).json({
          success: false,
          message: "Attachment must be 5 MB or smaller",
        });
      }
    }
    const request = await leaveService.createLeaveRequest({
      employeeId: req.body?.employeeId,
      employeeEmail: req.body?.employeeEmail,
      type: req.body?.leaveType || req.body?.type,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      days: req.body?.days,
      reason: req.body?.reason,
      sourceReference: req.body?.sourceReference,
      attachment,
      attachmentData,
      attachmentMime,
      createdBy: req.user.id,
    });
    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode === 500) console.error("Could not create leave request.", error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Could not create leave request." : error.message,
    });
  }
};

export const importLeaveCsv = async (req, res) => {
  try {
    const result = await leaveService.importLeaveRequests({
      content: req.body?.content,
      sourceType: req.body?.sourceType,
      sourceName: req.body?.sourceName,
      dateFormat: req.body?.dateFormat,
      createdBy: req.user.id,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode === 500) console.error("Could not import leave CSV.", error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500 ? "Could not import leave CSV." : error.message,
    });
  }
};

export const changeLeaveStatus = async (req, res) => {
  try {
    if (!["Approved", "Rejected"].includes(req.body.status)) {
      return res.status(400).json({ success: false, message: "Invalid leave status" });
    }
    const request = await leaveService.updateLeaveStatus(
      req.params.id,
      req.body.status,
      req.user,
      req.body.expectedAllocation,
    );
    if (!request) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }
    return res.json({ success: true, data: request });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const downloadLeaveAttachment = async (req, res) => {
  try {
    const attachment = await leaveService.getLeaveAttachment(req.params.id, req.user);
    if (!attachment) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }
    res.setHeader("Content-Type", attachment.mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(attachment.name)}"`,
    );
    return res.send(attachment.buffer);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
