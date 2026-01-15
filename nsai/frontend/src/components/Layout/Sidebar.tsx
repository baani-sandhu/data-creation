import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/authContext.tsx";
const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/projects", label: "Projects" },
  { to: "/datasets", label: "Datasets" },
  { to: "/models", label: "Models" },
  { to: "/training", label: "Training" },
];

export default function Sidebar() {
  const { logout, user } = useAuth();
  return (
    <aside className="w-64 bg-gray-900 text-white p-4">
      <h2 className="text-lg font-bold mb-6">NSAI</h2>
      <nav className="space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block px-3 py-2 rounded ${
                isActive ? "bg-gray-700" : "hover:bg-gray-800"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-gray-800 pt-4">
        {user && (
          <div className="px-3 py-2 mb-2 text-sm text-gray-400">
            Logged in as <span className="text-white block truncate">{user.email}</span>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full text-left px-3 py-2 rounded text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
        >
          Logout
        </button>
        </div>
    </aside>
  );
}
