import * as templateService from "../services/templateService.js";

const allowedImageTypes = ["image/png", "image/jpeg"];

export const getSettings = async (req, res) => {
  try {
    const data = await templateService.getLetterSettings();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Logo and company details only (no signature), for documents any role can print, like payslips.
export const getLetterhead = async (req, res) => {
  try {
    const { logo, company } = await templateService.getLetterSettings();
    return res.json({ success: true, data: { logo, company } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Handles both the letterhead logo and the authorised signature image.
export const saveImage = (kind) => async (req, res) => {
  try {
    const { fileName, mime, data } = req.body;
    if (!fileName || !data || !allowedImageTypes.includes(mime)) {
      return res.status(400).json({
        success: false,
        message: "Only PNG and JPEG images are allowed",
      });
    }
    // Stored inline in a Firestore document, which is capped at 1 MiB.
    if (data.length > 700_000) {
      return res.status(400).json({
        success: false,
        message: "Image must be 500 KB or smaller",
      });
    }
    const image = await templateService.saveImage(kind, { fileName, mime, data }, req.user);
    return res.json({ success: true, data: image });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const removeImage = (kind) => async (req, res) => {
  try {
    await templateService.removeImage(kind);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveCompany = async (req, res) => {
  try {
    if (!req.body?.name?.trim()) {
      return res.status(400).json({ success: false, message: "Company name is required" });
    }
    const company = await templateService.saveCompany(req.body);
    return res.json({ success: true, data: company });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
