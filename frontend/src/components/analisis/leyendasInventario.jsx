import ComoSeCalcula from '../common/ComoSeCalcula'

// Explicaciones de los cálculos de inventario quieto. Reflejan la lógica de la
// vista analitica.v_inventario_salud y del endpoint /analisis/inventario-quieto;
// si esa lógica cambia, actualizar aquí.

const Lista = ({ children }) => <ul className="list-disc pl-4 mt-1 space-y-0.5">{children}</ul>

export const LEYENDAS = {
  inventario: {
    titulo: 'Inventario a costo',
    texto: <>Existencia actual × costo promedio del ERP, en la foto más reciente del inventario. Solo cuenta artículos con existencia mayor a cero.</>,
  },
  inmovilizado: {
    titulo: 'Inmovilizado',
    texto: <>
      Stock que no se ha movido en mucho tiempo:
      <Lista>
        <li><strong>Producto</strong> sin ventas en los últimos 180 días.</li>
        <li><strong>Materia prima</strong> sin compras en los últimos 365 días.</li>
        <li>Artículos <strong>sin ningún movimiento</strong> registrado.</li>
      </Lista>
    </>,
  },
  lento: {
    titulo: 'Lento',
    texto: <>
      Se sigue moviendo, pero hay de más: el stock alcanza para <strong>más de 180 días</strong> al ritmo
      actual, o no tuvo consumo en la ventana reciente. Ver “Cobertura” para cómo se mide el ritmo.
    </>,
  },
  activo: {
    titulo: 'Activo',
    texto: <>Se mueve y su stock alcanza para 180 días o menos al ritmo actual.</>,
  },
  quieto: {
    titulo: 'Capital quieto',
    texto: <>Capital quieto = inmovilizado + lento. <br />% quieto = capital quieto ÷ inventario a costo.</>,
  },
  cobertura: {
    titulo: 'Cobertura (días)',
    texto: <>
      Cuántos días alcanza el stock al ritmo de consumo actual: valor del stock ÷ consumo diario.
      <Lista>
        <li><strong>Producto:</strong> costo vendido en los últimos 180 días ÷ 180.</li>
        <li><strong>Materia prima:</strong> compras de los últimos 365 días ÷ 365 (no hay datos de consumo en producción; lo comprado se usa como aproximación).</li>
      </Lista>
      <span className="block mt-1">En un grupo se suman el valor y el consumo de sus artículos; los que no tienen consumo suben la cobertura.</span>
    </>,
  },
  articulos: {
    titulo: 'Artículos quietos',
    texto: <>Artículos en estado lento o inmovilizado, sobre el total de artículos con existencia.</>,
  },
  tipo: {
    titulo: 'Tipo de inventario',
    texto: <>
      Se clasifica por la historia de cada artículo:
      <Lista>
        <li><strong>Producto:</strong> se ha vendido alguna vez.</li>
        <li><strong>Materia prima:</strong> nunca se ha vendido, pero se compra.</li>
        <li><strong>Sin movimiento:</strong> no tiene ventas ni compras registradas.</li>
      </Lista>
    </>,
  },
  antiguedad: {
    titulo: 'Antigüedad',
    texto: <>
      Días desde el último movimiento: la última <strong>venta</strong> para producto y la última <strong>compra</strong> para
      materia prima. “Sin registro” son artículos sin ventas ni compras.
    </>,
  },
  corte: {
    titulo: 'Foto al corte',
    texto: <>
      Es el stock de la última carga del ERP. No depende del filtro de período: las ventas y compras se miden
      en ventanas fijas (180 y 365 días) contadas desde hoy.
    </>,
  },
  categoria: {
    titulo: 'Categoría › Subcategoría › Sublínea',
    texto: <>Agrupación del catálogo del ERP: categoría = campo “marca” (Laminados, Liners…), subcategoría = “línea” y sublínea = “sublínea”. Es la misma que se usa en Ventas.</>,
  },
}

// <Leyenda k="inmovilizado" />
export function Leyenda({ k, className }) {
  const l = LEYENDAS[k]
  if (!l) return null
  return <ComoSeCalcula titulo={l.titulo} className={className}>{l.texto}</ComoSeCalcula>
}
