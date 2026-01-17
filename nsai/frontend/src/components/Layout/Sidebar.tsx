import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/authContext";
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  FolderKanban, 
  Database, 
  Cpu, 
  Activity, 
  LogOut 
} from "lucide-react";

export const Sidebar = () => {
  const { user, logout } = useAuth();

  const navLinks = [
    { to: "/dashboard", label: "Dashboard", roles: ["super", "admin", "user"], icon: LayoutDashboard },
    { to: "/register", label: "Create New", roles: ["super", "admin"], icon: UserPlus },
    { to: "/manage", label: "Manage Team", roles: ["super", "admin"], icon: Users },
    { to: "/projects", label: "Projects", roles: ["user"], icon: FolderKanban },
    { to: "/datasets", label: "Datasets", roles: ["user"], icon: Database },
    { to: "/models", label: "Models", roles: ["user"], icon: Cpu },
    { to: "/training", label: "Training", roles: ["user"], icon: Activity },
  ];

  const filteredLinks = navLinks.filter((link) => 
    user && link.roles.includes(user.role)
  );

  return (
    <aside className="w-64 bg-slate-950 text-slate-200 h-screen flex flex-col border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/50">
        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          NSAI Platform
        </h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 mt-4">
        {filteredLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                    : "hover:bg-slate-900 text-slate-400 hover:text-slate-100"
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className="font-medium text-sm">{link.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / Profile Section */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        {user && (
          <div className="mb-4 px-3 py-2 bg-slate-900/50 rounded-lg border border-slate-800">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Logged in as</p>
            <p className="text-xs text-blue-400 font-medium truncate">{user.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300 uppercase">
              {user.role}
            </span>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:bg-red-950/30 hover:text-red-400 transition-all duration-200"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};