const SettingsLoading = () => (
  <section
    aria-label="正在加载设置"
    className="relative left-1/2 w-full max-w-4xl -translate-x-1/2"
    aria-busy="true"
    data-slot="settings-loading"
  >
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="lg:hidden">
          <div className="bg-muted h-9 w-24 animate-pulse rounded-md" />
        </div>
        <div className="hidden flex-col gap-5 lg:flex">
          {[0, 1, 2].map((group) => (
            <div className="grid gap-2" key={group}>
              <div className="bg-muted h-3 w-16 animate-pulse rounded-md" />
              <div className="bg-muted/70 h-7 w-full animate-pulse rounded-md" />
              <div className="bg-muted/70 h-7 w-4/5 animate-pulse rounded-md" />
            </div>
          ))}
        </div>
      </aside>
      <div className="grid min-w-0 gap-6">
        <div className="grid gap-2">
          <div className="bg-muted h-9 w-56 animate-pulse rounded-md" />
          <div className="bg-muted h-4 w-80 max-w-full animate-pulse rounded-md" />
        </div>
        <div className="grid gap-4 rounded-xl border p-4">
          <div className="bg-muted h-5 w-32 animate-pulse rounded-md" />
          <div className="bg-muted/70 h-24 animate-pulse rounded-md" />
          <div className="bg-muted/70 h-24 animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  </section>
);

export default SettingsLoading;
