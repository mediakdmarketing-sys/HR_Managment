import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Navigate,
} from "react-router-dom";

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

function App() {
  const ProtectedRoute = () => {
    const user = true;
    return user ? <Outlet /> : <Navigate to="/login" />;
  };

  return (
    <>
      <BrowserRouter>
        <ToastContainer position="top-center" autoClose={3000} />

        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />}></Route>
          </Route>
          
          <Route path="/" element={<Home />}></Route>
          <Route path="/login" element={<Login />}></Route>
          <Route path="/attendance" element={<Attendance />}></Route>
          <Route path="/employees" element={<Employees />}></Route>
          <Route path="/employees/:id/edit" element={<EmployeeEdit />}></Route>
          <Route path="/employees/:id" element={<EmployeeDetails />}></Route>
          <Route path="/leave" element={<Leave />}></Route>
          <Route path="/payslip" element={<Payslip />}></Route>
          <Route path="/performance" element={<Performance />}></Route>
          <Route path="/templates" element={<Templates />}></Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
