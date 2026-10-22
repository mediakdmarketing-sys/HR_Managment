import { firebaseAuth, firestore } from "../config/firebase.js";

// export const registerUser = async (name, email, phone, password) => {
  
//   const existingUserResult = await pool.query(
//     "SELECT id FROM employees WHERE email = $1",
//     [email],
//   );

//   if (existingUserResult.rowCount > 0) {
//     throw new Error("Email already exists");
//   }

//   const hashedPassword = await bcrypt.hash(password, 10);

//   const { rows } = await pool.query(
//     `
//       INSERT INTO employees (id, name, email, password, role, department)
//       SELECT
//         'EMP' || LPAD((COALESCE(MAX(CAST(SUBSTRING(id, 4) AS INTEGER)), 0) + 1)::text, 3, '0'),
//         $1, $2, $3, 'Employee', 'Software'
//       FROM employees
//       )
//       RETURNING id AS "_id", name, email, role
//     `,
//     [name, email, hashedPassword],
//   );

//   return rows[0];
// };

export const loginUser = async (email, password) => {
  const snapshot = await firestore
    .collection("employees")
    .where("email", "==", email.trim().toLowerCase())
    .limit(1)
    .get();
  if (snapshot.empty || snapshot.docs[0].data().status !== "Active") {
    throw new Error("User not found");
  }
  const user = { _id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  const firebaseUser = await firebaseAuth.getUserByEmail(user.email);
  return { ...user, uid: firebaseUser.uid };
};
