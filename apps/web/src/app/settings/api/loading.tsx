const Loading = () => (
  <div className="grid gap-6" data-slot="settings-api-loading">
    <div className="grid gap-2">
      <div className="bg-muted h-9 w-40 animate-pulse rounded-md" />
      <div className="bg-muted h-4 w-80 max-w-full animate-pulse rounded-md" />
    </div>
    <div className="rounded-xl border p-4">
      <div className="bg-muted mb-4 h-5 w-28 animate-pulse rounded-md" />
      <div className="grid gap-3">
        {[0, 1, 2].map((row) => (
          <div
            className="bg-muted/60 h-10 animate-pulse rounded-md"
            key={row}
          />
        ))}
      </div>
    </div>
  </div>
);

export default Loading;
