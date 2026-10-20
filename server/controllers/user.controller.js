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