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

export const listLeaves = async (req, res) => {
  try {
    const requests = await leaveService.getLeaveRequests(req.user);
    return res.json({ success: true, data: requests });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

export const createLeave = async (req, res) => {
  try {
    const {
      type,
      startDate,
      endDate,
      days,
      reason,
      attachment,
      attachmentData,
      attachmentMime,
    } = req.body;
    if (!type || !startDate || !endDate || !days || !reason) {
      return res.status(400).json({
        success: false,
        message: "Leave type, dates, days and reason are required",
      });
    }
    const allowedAttachmentTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
    ];
    if (attachmentData) {
      if (!attachment || !allowedAttachmentTypes.includes(attachmentMime)) {
        return res.status(400).json({
          success: false,
          message: "Only PDF, PNG and JPEG attachments are allowed",
        });
      }
      if (attachmentData.length > 7_000_000) {
        return res.status(400).json({
          success: false,
          message: "Attachment must be 5 MB or smaller",
        });
      }
    }
    const request = await leaveService.createLeaveRequest({
      employeeId: req.user.id,
      type,
      startDate,
      endDate,
      days,
      reason,
      attachment,
      attachmentData,
      attachmentMime,
    });
    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
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
