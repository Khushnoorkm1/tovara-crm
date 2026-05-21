import { UserMenu } from "./user-menu";

export function Topbar({
  user,
  tenant,
}: {
  user: { name: string | null; email: string; image: string | null; role: string };
  tenant: { name: string };
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md lg:px-10">
      <div className="flex items-center gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {tenant.name}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
