import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

//import Header from "./pages/Header/Header";
import Home from "./Pages/Home";
import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import Employees from "./Pages/Employees";
import EmployeeDetails from "./Pages/EmployeeDetails";
import EmployeeEdit from "./Pages/EmployeeEdit";
import Leave from "./Pages/Leave";
import Payslip from "./Pages/Payslip";
import Attendance from "./Pages/Attendance";
import Performance from "./Pages/Performance";
import Templates from "./Pages/Templates";
// import Profile from "./pages/Profile";
import { ToastContainer } from "react-toastify";
import ProtectedRoute from "./components/ProtectedRoute";

const DIRECTORY_ROLES = ["HR", "Manager", "Team Lead", "Recruiter"];
const TEAM_ROLES = ["HR", "Manager", "Team Lead", "Employee"];

function App() {
  return (
    <>
      <BrowserRouter>
        <ToastContainer position="top-center" autoClose={3000} />

        <Routes>
          <Route path="/" element={<Home />}></Route>
          <Route path="/login" element={<Login />}></Route>

          {/* Roles match the links each role sees in the sidebar. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />}></Route>
          </Route>
          <Route element={<ProtectedRoute roles={DIRECTORY_ROLES} />}>
            <Route path="/employees" element={<Employees />}></Route>
            <Route path="/employees/:id" element={<EmployeeDetails />}></Route>
          </Route>
          <Route element={<ProtectedRoute roles={["HR"]} />}>
            <Route path="/employees/:id/edit" element={<EmployeeEdit />}></Route>
            <Route path="/templates" element={<Templates />}></Route>
          </Route>
          <Route element={<ProtectedRoute roles={TEAM_ROLES} />}>
            <Route path="/attendance" element={<Attendance />}></Route>
            <Route path="/leave" element={<Leave />}></Route>
            <Route path="/performance" element={<Performance />}></Route>
          </Route>
          <Route element={<ProtectedRoute roles={["HR", "Finance", "Employee"]} />}>
            <Route path="/payslip" element={<Payslip />}></Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />}></Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
