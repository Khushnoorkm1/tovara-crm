"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { cn } from "@/lib/utils";

export function RegisterForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      restaurantName: "",
      slug: "",
      contactEmail: "",
    },
  });

  // Auto-derive slug from restaurant name on first edit
  const restaurantName = watch("restaurantName");
  const slug = watch("slug");

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { error?: string; field?: keyof RegisterInput };

      if (!res.ok) {
        if (data.field) {
          setError(data.field, { message: data.error });
        } else {
          toast.error(data.error ?? "Registration failed");
        }
        return;
      }

      // Auto sign-in
      const signInRes = await signIn("credentials", {
        email: values.email,
        password: values.password,
        tenantSlug: values.slug,
        redirect: false,
      });
      if (signInRes?.error) {
        toast.success("Account created — please sign in");
        router.push("/login");
        return;
      }
      toast.success("Welcome aboard!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  });

  function handleNameBlur() {
    if (!slug && restaurantName) {
      const generated = restaurantName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 40);
      setValue("slug", generated, { shouldValidate: true });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      <Section label="You">
        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" {...register("name")} aria-invalid={!!errors.name} />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
            aria-invalid={!!errors.email}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters with letters and numbers"
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
            aria-invalid={!!errors.password}
          />
        </Field>
      </Section>

      <Section label="Your restaurant">
        <Field label="Restaurant name" htmlFor="restaurantName" error={errors.restaurantName?.message}>
          <Input
            id="restaurantName"
            {...register("restaurantName", { onBlur: handleNameBlur })}
            aria-invalid={!!errors.restaurantName}
          />
        </Field>

        <Field
          label="Subdomain"
          htmlFor="slug"
          error={errors.slug?.message}
          hint="Where guests will book — lowercase letters, numbers and hyphens"
        >
          <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-card focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background">
            <Input
              id="slug"
              {...register("slug")}
              className="rounded-none border-0 focus:ring-0 focus:ring-offset-0"
              aria-invalid={!!errors.slug}
              placeholder="marios-bistro"
            />
            <span className="flex items-center border-l border-border bg-secondary px-3 font-mono text-xs text-muted-foreground">
              .tavola.app
            </span>
          </div>
        </Field>
      </Section>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create account
      </button>

      <p className="text-center text-xs text-muted-foreground">
        By creating an account you agree to our terms and privacy policy.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background aria-[invalid=true]:border-destructive",
        className,
      )}
    />
  );
}
