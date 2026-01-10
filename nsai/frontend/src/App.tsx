import { Navigate, BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import Layout from "./components/Layout/Layout";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const Datasets = lazy(() => import("./pages/Datasets"));
const Models = lazy(() => import("./pages/Models"));
const Training = lazy(() => import("./pages/Training"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <Routes>
          {/* Public Routes for anyone visiting the app*/}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes visible to authenticated user only */}
          <Route element={<Layout />}>
            <Route path="*" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/datasets" element={<Datasets />} />
            <Route path="/models" element={<Models />} />
            <Route path="/training" element={<Training />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
