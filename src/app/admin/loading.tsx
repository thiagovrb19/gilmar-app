/**
 * Esqueleto exibido NA HORA ao navegar entre as telas do admin.
 * Sem isso o celular fica "parado" até o servidor terminar de buscar os dados.
 */
export default function AdminLoading() {
  return (
    <div className="w-full space-y-5 animate-pulse" role="status" aria-label="Carregando">
      <div className="h-7 w-56 rounded-lg bg-surface-2" />
      <div className="h-4 w-80 max-w-full rounded bg-surface-2/70" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-1 border border-border-subtle" />
        ))}
      </div>

      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface-1 border border-border-subtle" />
        ))}
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
