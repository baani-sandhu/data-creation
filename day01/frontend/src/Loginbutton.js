import { useContext } from "react";
import { AuthContext } from "./AuthContext";

function Loginbutton() {
  const { user, login } = useContext(AuthContext);
  if (user) {
    return null;
  }

  return (
    <div class="flex items-center justify-center gap-4 p-4 bg-gray-100 rounded">
      <button
        onClick={login}
        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded shadow"
      >
        Login
      </button>
    </div>
  );
}

export default Loginbutton;
