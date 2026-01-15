import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

interface SignupFormProps extends React.ComponentProps<"div"> {
  onSubmit: (e: React.FormEvent) => void
  onFieldChange: (key: string, value: string) => void
}

export function SignupForm({
  className,
  onSubmit,
  onFieldChange,
  ...props
}: SignupFormProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={onSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Create your account</h1>
                <p className="text-muted-foreground text-sm">
                  Join us today by filling out the details below.
                </p>
              </div>

              {/* Email Field */}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  onChange={(e) => onFieldChange("email", e.target.value)}
                />
              </Field>

              {/* Username Field */}
              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  placeholder="johndoe123"
                  required
                  onChange={(e) => onFieldChange("username", e.target.value)}
                />
              </Field>

              {/* Name Row */}
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="first_name">First Name</FieldLabel>
                  <Input
                    id="first_name"
                    placeholder="John"
                    required
                    onChange={(e) => onFieldChange("first_name", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="last_name">Last Name</FieldLabel>
                  <Input
                    id="last_name"
                    placeholder="Doe"
                    required
                    onChange={(e) => onFieldChange("last_name", e.target.value)}
                  />
                </Field>
              </div>

              {/* Password Field */}
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  required
                  onChange={(e) => onFieldChange("password", e.target.value)}
                />
              </Field>

              <Button type="submit" className="w-full">
                Register
              </Button>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card text-xs">
                Or continue with
              </FieldSeparator>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" type="button" className="w-full">Google</Button>
                <Button variant="outline" type="button" className="w-full">Apple</Button>
              </div>

              <FieldDescription className="text-center">
                Already have an account? <a href="/login" className="underline underline-offset-4">Sign in</a>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="bg-muted relative hidden md:block">
            <img
              src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80"
              alt="Registration background"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2]"
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center text-xs text-balance">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}