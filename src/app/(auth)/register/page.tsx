import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Create your account",
};

export default function RegisterPage() {
  return (
    <div>
      <div className="mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          New restaurant
        </p>
        <h1 className="mt-3 text-4xl tracking-tight">Set up your account</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Already have one?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in instead
          </Link>
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
