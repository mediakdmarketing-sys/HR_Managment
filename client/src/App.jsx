
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./Pages/Home";
import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import Employees from "./Pages/Employees";
import EmployeeDetails from "./Pages/EmployeeDetails";
import EmployeeEdit from "./Pages/EmployeeEdit";
import Leave from "./Pages/Leave";
import Payslip from "./Pages/Payslip";
import ForgotPassword from "./Pages/ForgotPassword";
import ResetPassword from "./Pages/ResetPassword";
import Attendance from "./Pages/Attendance";
import Performance from "./Pages/Performance";
import Templates from "./Pages/Templates";
import ExpenseTracker from "./Pages/ExpenseTracker";
import Profile from "./Pages/Profile";

import { ToastContainer } from "react-toastify";
import ProtectedRoute from "./components/ProtectedRoute";

const HR_ROLES = ["HR"];

function App() {
  return (
    <>
      <BrowserRouter>
        <ToastContainer position="top-center" autoClose={3000} />

        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* HR-only routes */}
          <Route element={<ProtectedRoute roles={HR_ROLES} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />

            <Route path="/employees" element={<Employees />} />
            <Route path="/employees/:id" element={<EmployeeDetails />} />
            <Route path="/employees/:id/edit" element={<EmployeeEdit />} />

            <Route path="/attendance" element={<Attendance />} />
            <Route path="/leave" element={<Leave />} />

            {/* Temporarily retained until final module review */}
            <Route path="/performance" element={<Performance />} />

            <Route path="/payslip" element={<Payslip />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/expenses" element={<ExpenseTracker />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;