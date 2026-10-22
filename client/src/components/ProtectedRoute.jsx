import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getRole, isLoggedIn } from "../utils/auth";

// Without `roles`, any logged-in user may open the route.
const ProtectedRoute = ({ roles }) => {
  const location = useLocation();

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(getRole())) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
