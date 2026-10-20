import User from "../models/user.model.js";

export const getUsersService = async (
  page = 1,
  limit = 10,
  role = "all"
) => {

  const query = {};

  if (role !== "all") {
    query.role = role;
  }

  const users = await User.find(query)
    .select("-password")
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total =
    await User.countDocuments(query);

  return {
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};