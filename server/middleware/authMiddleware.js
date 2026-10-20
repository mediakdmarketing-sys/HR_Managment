import jwt from "jsonwebtoken";


 const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(req.headers.authorization);

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  const token =
    authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

export default authMiddleware;



export const verifyToken = (
  req,
  res,
  next
) => {
  // Accept token from cookie or Authorization header (Bearer)
  const cookieToken = req.cookies?.token;
  const authHeader = req.headers?.authorization;

  let token = cookieToken;

  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token found",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};