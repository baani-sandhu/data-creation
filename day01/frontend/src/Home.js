import React, { useState } from "react";
import { AuthContext } from "./AuthContext";
import Navbar from "./Navbar";
import Loginbutton from "./Loginbutton";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  function login() {
    setUser({ name: "testuser" });
  }
  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div className="min-h-screen bg-gray-100 p-6">
        <h2 className="text-4xl font-bold text-center mb-4 text-blue-600">
          Homepage
        </h2>
        <h3 className="text-xl text-center mb-6 text-gray-700">
          Context API Example
        </h3>
        <Navbar />

        <div className="flex justify-center my-4">
          <Loginbutton />
        </div>

        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={() => navigate("/about-page")}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded shadow"
          >
            Go to About Page
          </button>
        </div>

        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={() => navigate("/scrolling-page")}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded shadow"
          >
            Go to UnlimitedScroll Page
          </button>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
