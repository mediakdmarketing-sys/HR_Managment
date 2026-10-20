import bcrypt from "bcrypt";
import User from "../models/user.model.js";

export const registerUser = async (name, email, phone, password) => {
  
    const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error("Email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    phone,
    password: hashedPassword,
  });

  return user;
};

export const loginUser = async (email,password) => {
  
    const user = await User.findOne({ email });

  if (!user) {
    throw new Error("User not found");
  }

  const isMatch = await bcrypt.compare(
      password,
      user.password
    );

  if (!isMatch) {
    throw new Error("Invalid password");
  }

  return user;
};

