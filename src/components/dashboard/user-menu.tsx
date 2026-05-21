"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun, Monitor } from "lucide-react";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserMenu({
  user,
}: {
  user: { name: string | null; email: string; image: string | null; role: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-full border border-border bg-card px-2 py-1 transition hover:bg-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="hidden text-right sm:block">
          <span className="block text-xs font-medium text-foreground">{user.name ?? user.email}</span>
          <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            {user.role}
          </span>
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {initials(user.name ?? user.email)}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 origin-top-right animate-fade-in rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          <div className="border-b border-border p-3">
            <p className="text-sm font-medium">{user.name ?? "Signed in"}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>

          <div className="border-b border-border p-1">
            <p className="px-2 pb-1 pt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Theme
            </p>
            <div className="flex gap-1">
              <ThemeButton active={theme === "light"} onClick={() => setTheme("light")} icon={<Sun className="h-3.5 w-3.5" />} label="Light" />
              <ThemeButton active={theme === "dark"} onClick={() => setTheme("dark")} icon={<Moon className="h-3.5 w-3.5" />} label="Dark" />
              <ThemeButton active={theme === "system"} onClick={() => setTheme("system")} icon={<Monitor className="h-3.5 w-3.5" />} label="System" />
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            role="menuitem"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] transition",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
