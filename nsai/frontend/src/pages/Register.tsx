import { RegistrationForm } from "@/components/registrationForm.tsx"

export default function Register() {
  return (
    <div className="bg-slate-50 flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <RegistrationForm />
      </div>
    </div>
  )
}