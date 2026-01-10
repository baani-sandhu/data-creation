import { useContext } from "react";
import { AuthContext } from "./AuthContext";

function Navbar() {
  const { user, logout } = useContext(AuthContext);

  if (user) {
    return (
      <div>
        <div class="flex items-center justify-center gap-4 p-4 bg-gray-100 rounded shadow">
          <h3 class="text-lg font-semibold text-black">Welcome {user.name}</h3>
        </div>
        <div class="flex items-center justify-center gap-4 p-4 bg-gray-100 rounded">
          <button
            onClick={logout}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded shadow"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="flex items-center justify-center gap-4 p-4 bg-gray-100 rounded shadow">
      <h3 class="text-lg font-semibold text-black">Not logged in</h3>
    </div>
  );
}

export default Navbar;
