import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import type { User } from "firebase/auth";
import { router } from "./routes";
import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { AuthContext } from "./lib/AuthContext";
import { LoginPage } from "./components/LoginPage";
import { resetAppState } from "./state";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser((prevUser) => {
        const isSignOut = !nextUser;
        const isUserSwitch = Boolean(prevUser && nextUser && prevUser.uid !== nextUser.uid);
        if (isSignOut || isUserSwitch) {
          resetAppState();
        }
        return nextUser;
      });
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--base-bg)" }}>
        <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>Loading...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user }}>
      {user ? <RouterProvider router={router} /> : <LoginPage />}
    </AuthContext.Provider>
  );
}
