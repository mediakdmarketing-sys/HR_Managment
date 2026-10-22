import * as userService
from "../services/userService.js";
export const getUsers = async (
  req,
  res
) => {

  try {

    const page =
      parseInt(req.query.page) || 1;

    const limit =
      parseInt(req.query.limit) || 10;

    const role =
      req.query.role || "all";

    const data =
      await userService.getUsersService(
        page,
        limit,
        role
      );

    res.status(200).json({
      success: true,
      data,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

export const getEmployeeOptions = async (req, res) => {
  try {
    const options = await userService.getEmployeeOptionsService();
    return res.status(200).json({ success: true, data: options });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password || !role || !department) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, role and department are required",
      });
    }

    const user = await userService.createUserService({
      name,
      email,
      password,
      role,
      department,
    });
    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An employee with this email already exists",
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserByIdService(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await userService.updateUserService(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An employee with this email already exists",
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const disableUser = async (req, res) => {
  try {
    const user = await userService.disableUserService(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};