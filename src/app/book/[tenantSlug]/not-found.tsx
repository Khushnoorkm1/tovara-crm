import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function BookNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-grain px-6 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Restaurant not found
      </p>
      <h1 className="mt-4 font-display text-4xl tracking-tight md:text-5xl">
        We couldn't find that restaurant
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The booking link you followed may be wrong, or this restaurant is no
        longer accepting online reservations.
      </p>
      <Link
        href="/"
        className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
      >
        Powered by {APP_NAME}
      </Link>
    </div>
  );
}
