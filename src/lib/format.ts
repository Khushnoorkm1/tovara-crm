import { format, formatDistanceToNow, parseISO } from "date-fns";

export function formatDate(d: Date | string, pattern = "MMM d, yyyy"): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, pattern);
}

export function formatDateTime(d: Date | string, pattern = "MMM d, yyyy 'at' h:mm a"): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, pattern);
}

export function formatTime(d: Date | string, pattern = "h:mm a"): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, pattern);
}

export function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // US format: +1 (212) 555-0100
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/**
 * "Mario Romano" → "MR"
 */
export function initials(name: string | null | undefined): string {
  if (!name) return "??";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
