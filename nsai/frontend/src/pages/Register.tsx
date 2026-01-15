import { useAuth } from "../contexts/authContext.tsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignupForm } from "@/components/registrationForm.tsx"

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({});

  // Keeps your original logic for updating the state object
  const handleFieldChange = (key: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await register(form);
    navigate("/login");
  };

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignupForm 
          onSubmit={submit} 
          onFieldChange={handleFieldChange} 
        />
      </div>
    </div>
  )
}