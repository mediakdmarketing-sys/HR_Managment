import * as authService from "../services/authService.js";
import { success, error } from "../utils/apiResponse.js";
import generateToken from "../utils/generateToken.js";

export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const user = await authService.registerUser(name, email, phone, password);

    success(res, "User registered successfully", user, 201);
  } catch (err) {
    error(res, err.message);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await authService.loginUser(email, password);

    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    success(res, "Login successful", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    error(res, err.message);
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    success(res, "Logout successful", null, 200);
  } catch (err) {
    error(res, err.message);
  }
};
