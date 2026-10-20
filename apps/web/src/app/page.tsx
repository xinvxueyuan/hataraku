import { ApiStatus } from "#src/components/api-status.tsx";

const HomePage = () => (
  <section className="grid gap-10 sm:py-8">
    <div className="grid gap-5">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        API
        <ApiStatus />
      </div>
      <h1 className="text-5xl font-semibold tracking-tighter text-balance break-words sm:text-7xl">
        hataraku
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg text-pretty">
        Next.js, Hono, oRPC, PostgreSQL, Drizzle, Better Auth and Expo on Vite+.
      </p>
    </div>
    <p className="text-muted-foreground border-t pt-6 text-sm">
      Edit{" "}
      <code className="text-foreground font-mono">
        apps/web/src/app/page.tsx
      </code>{" "}
      and save to see it change.
    </p>
  </section>
);

export default HomePage;
