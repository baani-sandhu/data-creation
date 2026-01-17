import { useEffect } from "react";
import { useState } from "react";
import { useAuth } from "../contexts/authContext.tsx";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/loginPage.tsx"

export default function LoginPage() {
  const { login, user } = useAuth(); // Grab user from context
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await login({ email, password });
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (user) {
      if (user.role === 'super') {
        navigate("/register"); 
      } else if (user.role === 'admin') {
        navigate("/register"); 
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, navigate]);

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm 
          onSubmit={handleSubmit}
          setEmail={setEmail}
          setPassword={setPassword}
          isLoading={isSubmitting}
        />
      </div>
    </div>
  )
}