import { success, error } from "../utils/apiResponse.js";
import { firebaseAuth, firestore } from "../config/firebase.js";

// export const register = async (req, res) => {
//   try {
//     const { name, email, phone, password } = req.body;

//     const user = await authService.registerUser(name, email, phone, password);

//     success(res, "User registered successfully", user, 201);
//   } catch (err) {
//     error(res, err.message);
//   }
// };

export const login = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return error(res, "Firebase ID token is required", 400);
    }

    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const snapshot = await firestore
      .collection("employees")
      .where("uid", "==", decoded.uid)
      .limit(1)
      .get();
    if (snapshot.empty || snapshot.docs[0].data().status !== "Active") {
      return error(res, "User not found or inactive", 401);
    }
    const user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    success(res, "Login successful", {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token: idToken,
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
