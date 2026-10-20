import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Navigate,
} from "react-router-dom";

//import Header from "./pages/Header/Header";
//import Home from "./pages/Home";
import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import Employees from "./pages/Employees";
import Leave from "./pages/Leave";
import Payslip from "./pages/Payslip";
 import Attendance from "./pages/Attendance";
import Performance from "./pages/Performance";
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

          <Route path="/login" element={<Login />}></Route>
          <Route path="/attendance" element={<Attendance />}></Route>
          <Route path="/employees" element={<Employees />}></Route>
          <Route path="/leave" element={<Leave />}></Route>
          <Route path="/payslip" element={<Payslip />}></Route>
          <Route path="/performance" element={<Performance />}></Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
