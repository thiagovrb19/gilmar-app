export default function AgendarLoading() {
  return (
    <div className="min-h-screen bg-bg-base px-4 pt-6 max-w-2xl mx-auto space-y-4 animate-pulse" role="status" aria-label="Carregando">
      <div className="h-14 rounded-2xl bg-surface-1 border border-border-subtle" />
      <div className="h-7 w-52 rounded-lg bg-surface-2" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-surface-1 border border-border-subtle" />
      ))}
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
