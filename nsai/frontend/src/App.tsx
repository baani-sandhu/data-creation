import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import Layout from "./components/Layout/Layout";
import ProtectedRoute from "./components/PrivateRoute";
import { AuthProvider } from "./contexts/authContext";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const Datasets = lazy(() => import("./pages/Datasets"));
const Models = lazy(() => import("./pages/Models"));
const Training = lazy(() => import("./pages/Training"));
const Manage = lazy(() => import("./pages/ManageUsers"));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="p-6 text-center">Loading Application...</div>}>
          <Routes>
            {/* PUBLIC ROUTE */}
            <Route path="/login" element={<Login />} />

            {/* PROTECTED ROUTES - Authenticated Users Only */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["super", "admin", "user"]}>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/datasets" element={<Datasets />} />
              <Route path="/models" element={<Models />} />
              <Route path="/training" element={<Training />} />
            </Route>

            {/* HIGHLY PROTECTED ROUTE - Only Super or Admin can Register others */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["super", "admin"]}>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/register" element={<Register />} />
              <Route path="/manage" element={<Manage />} />
            </Route>

            {/* CATCH ALL */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}