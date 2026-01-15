// basic ui

// import { useState } from "react";
// import { useAuth } from "../contexts/authContext.tsx";
// import { useNavigate } from "react-router-dom";

// export default function Login() {
//   const { login } = useAuth();
//   const navigate = useNavigate();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   const submit = async (e: any) => {
//     e.preventDefault();
//     await login({email, password});
//     navigate("/dashboard");
//   };

//   return (
//     <form onSubmit={submit}>
//       <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
//       <input
//         type="password"
//         placeholder="Password"
//         onChange={e => setPassword(e.target.value)}
//       />
//       <button type="submit">Login</button>
//     </form>
//   );
// }


// shadcn implementation
import { useState } from "react";
import { useAuth } from "../contexts/authContext.tsx";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/loginPage.tsx"

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ email, password });
    navigate("/dashboard");
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
          Acme Inc.
        <LoginForm 
          onSubmit={handleSubmit}
          setEmail={setEmail}
          setPassword={setPassword}
        />
      </div>
    </div>
  )
}