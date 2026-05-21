import Link from "next/link";

export default function NotFound() {
  return (
    <main className="bg-grain flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-lg text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          404 — Off the map
        </p>
        <h1 className="mt-6 font-display text-6xl tracking-tight">
          We couldn't find that page.
        </h1>
        <p className="mt-4 text-muted-foreground">
          It may have moved, or perhaps it was never there. Either way, here's the way back.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Return home →
        </Link>
      </div>
    </main>
  );
}
