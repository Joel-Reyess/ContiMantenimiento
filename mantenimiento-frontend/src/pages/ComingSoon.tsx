interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-card p-8 border-l-4 border-l-continental-yellow/80">
        <div className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.3em] text-continental-gray-1">Vista en construccion</p>
          <h1 className="text-3xl font-semibold text-continental-black">{title}</h1>
          <p className="text-continental-gray-1">
            {description || 'Estamos trabajando para habilitar esta seccion pronto.'}
          </p>
          <div className="mt-3 rounded-lg bg-continental-yellow/10 border border-continental-yellow px-4 py-3 text-continental-black">
            Si necesitas priorizar esta vista, avisa al equipo para adelantarla.
          </div>
        </div>
      </div>
    </div>
  );
}
