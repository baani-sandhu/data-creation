import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/authContext";

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: string[]; // Add this prop
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <div className="p-6">Verifying Session...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;