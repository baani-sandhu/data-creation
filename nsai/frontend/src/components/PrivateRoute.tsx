import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext.tsx";

export default function PrivateRoute({ children }: any) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return isAuthenticated ? children : <Navigate to="/login" />;
}
