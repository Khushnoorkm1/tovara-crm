import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[5fr_6fr]">
      {/* Brand panel */}
      <aside className="bg-grain relative hidden flex-col justify-between overflow-hidden bg-foreground p-12 lg:flex">
        <div>
          <Link href="/" className="inline-flex items-center gap-2">
            <BrandMark className="text-background" />
            <span className="font-display text-2xl tracking-tight text-background">{APP_NAME}</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-background/60">
            For modern restaurants
          </p>
          <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight text-background">
            Reservations, guests, and growth — in one quiet place.
          </h1>
          <p className="mt-6 text-background/70">{APP_TAGLINE}</p>
        </div>

        <p className="font-mono text-xs uppercase tracking-[0.2em] text-background/40">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 16h12M16 10v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
