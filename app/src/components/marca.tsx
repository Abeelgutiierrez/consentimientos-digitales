// Identidad común de los productos: monograma ΛИΛ (un solo trazo, puntas redondas) y
// el icono de producto. La empresa firma solo con el monograma, nunca con su nombre.
// Geometría original en Logo/monograma-ana/generar-ana.js (trazo 52, caja 620×205).

const MONOGRAMA = "M74 327 L148 174 L222 327 M284 174 L284 327 L432 174 L432 327 M494 327 L568 174 L642 327";

export function Monograma({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      className={className}
      viewBox="48 148 620 205"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={MONOGRAMA} fill="none" stroke="currentColor" strokeWidth={52} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Icono de Firma: un trazo de firma sobre su línea, con el mismo remate que el monograma.
export function IconoFirma({ className }: { className?: string }) {
  return (
    <span className={`app-icon ${className ?? ""}`} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <path d="M6 26 C10 10 14 30 19 18 S26 8 28 22 L34 16" />
        <path className="acc" d="M6 33 L34 33" />
      </svg>
    </span>
  );
}

// Nombre del producto con su icono; `firma` añade el monograma debajo como sello de la casa.
export function Producto({ firma = false, sub }: { firma?: boolean; sub?: string }) {
  return (
    <div className="producto">
      <IconoFirma />
      <div>
        <b>Firma</b>
        {sub ? <small>{sub}</small> : null}
        {firma ? <Monograma className="producto-sello" title="ΛИΛ" /> : null}
      </div>
    </div>
  );
}

// Pie discreto para las pantallas del cliente final (formulario, gracias).
export function SelloCasa() {
  return (
    <div className="sello-casa">
      <Monograma className="sello-mono" title="ΛИΛ" />
      <span>Firma</span>
    </div>
  );
}
