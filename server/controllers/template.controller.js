import * as templateService from "../services/templateService.js";

const allowedLogoTypes = ["image/png", "image/jpeg"];

export const getLogo = async (req, res) => {
  try {
    const logo = await templateService.getLogo();
    return res.json({ success: true, data: logo });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveLogo = async (req, res) => {
  try {
    const { fileName, mime, data } = req.body;
    if (!fileName || !data || !allowedLogoTypes.includes(mime)) {
      return res.status(400).json({
        success: false,
        message: "Only PNG and JPEG logos are allowed",
      });
    }
    // Stored inline in a Firestore document, which is capped at 1 MiB.
    if (data.length > 700_000) {
      return res.status(400).json({
        success: false,
        message: "Logo must be 500 KB or smaller",
      });
    }
    const logo = await templateService.saveLogo({ fileName, mime, data }, req.user);
    return res.json({ success: true, data: logo });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
