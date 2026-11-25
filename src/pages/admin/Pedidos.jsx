// Barista (tablero kanban) y Dark store (reparto con cuenta regresiva de 24 h)
import { useEffect, useRef, useState } from 'react'
import { Coffee, MapPin, Plus, Truck, X } from '@phosphor-icons/react'
import Field from '../../components/Field'
import { Aviso, Badge, Btn, Card, Empty, Estado, EstadoBadge, Skeleton, Tabla } from '../../components/admin/ui'
import { updateOrder } from '../../context/CartContext'
import { makeAlert } from '../../data/ops'
import { fmtPEN } from '../../data/products'
import { api, useDatos } from '../../db/data'
import useTitle from '../../useTitle'
import { BOTON, LEGACY, cuenta, hora, money, soloHora } from './util'

async function avanzar(codigo) {
  const p = await api.avanzarPedido(codigo)
  const legacy = LEGACY[p.estado]
  if (legacy) updateOrder(codigo, (cur) => ({ status: legacy, alerts: [...(cur.alerts || []), makeAlert(legacy, codigo)] }))
  return p
}

// La cuenta regresiva se calcula en el servidor: se vuelve a leer cada 30 s
function useRefrescoPeriodico(recargar) {
  const ref = useRef(recargar)
  useEffect(() => {
    ref.current = recargar
  })
  useEffect(() => {
    const t = setInterval(() => ref.current(), 30000)
    return () => clearInterval(t)
  }, [])
}

// Perfil de sabor del cliente en una franja discreta (solo si existe)
function Sabor({ id_cliente }) {
  const r = useDatos(() => (id_cliente ? api.fichaCliente(id_cliente) : null), [id_cliente])
  const f = r.data
  if (!id_cliente || !f?.perfil) return null
  const p = f.perfil
  return (
    <p className="a-ticket__flavor">
      {p.notas_preferidas}, {p.metodo_extraccion}, molienda {p.tipo_molienda?.toLowerCase()}, intensidad {p.intensidad}/5
    </p>
  )
}

function Ticket({ p, movido, ocupado, onMover }) {
  const accion = BOTON[p.estado]
  return (
    <li className={`a-ticket${movido ? ' is-moved' : ''}`}>
      <div className="a-ticket__head">
        <strong>{p.codigo}</strong>
        <time>{soloHora(p.fecha)}</time>
      </div>
      <span className="a-ticket__who">{p.cliente || 'Venta en barra'}</span>
      <div className="a-ticket__lines">
        {p.items.map((it) => (
          <span key={it.id_detalle}>
            {it.cantidad} x {it.nombre} {it.descripcion}
            {it.configuracion?.molienda ? <em>, molienda {it.configuracion.molienda}</em> : null}
          </span>
        ))}
      </div>
      <Sabor id_cliente={p.id_cliente} />
      <div className="a-ticket__foot">
        {p.estado === 'LISTO' ? (
          <Btn variante="secondary" block disabled>Esperando al reparto</Btn>
        ) : (
          <Btn block disabled={ocupado} onClick={() => onMover(p.codigo)}>{ocupado ? 'Guardando...' : accion}</Btn>
        )}
      </div>
    </li>
  )
}

const COLUMNAS = [
  { estado: 'PAGADO', titulo: 'Nuevos', vacio: 'No hay pedidos por preparar. Las ventas web y de barra aparecerán aquí.' },
  { estado: 'EN_PREPARACION', titulo: 'En preparación', vacio: 'Nada en preparación. Empieza un pedido nuevo y se moverá a esta columna.' },
  { estado: 'LISTO', titulo: 'Listos', vacio: 'Los pedidos listos esperan aquí a que el reparto los recoja.' },
]

function VentaBarra({ dialogRef }) {
  const r = useDatos(() => api.listarVariantes('BEBIDA'))
  const bebidas = r.data ?? []
  const [elegido, setElegido] = useState('')
  const id = elegido || bebidas[0]?.id_variante || ''
  const [qty, setQty] = useState(1)
  const [res, setRes] = useState({ ok: true, texto: '' })
  const [busy, setBusy] = useState(false)
  const vender = async (e) => {
    e.preventDefault()
    const n = Math.max(1, Number(qty) || 1)
    setBusy(true)
    setRes({ ok: true, texto: '' })
    try {
      const p = await api.crearPedido({ canal: 'POS', items: [{ id_variante: Number(id), cantidad: n }], metodoPago: 'EFECTIVO' })
      const receta = await api.recetaDe(Number(id))
      const usado = receta.filter((x) => x.unidad !== 'u').map((x) => `${x.cantidad * n} ${x.unidad} de ${x.nombre.toLowerCase()}`)
      setRes({ ok: true, texto: `Venta ${p.codigo} registrada: ${fmtPEN(p.total)}, ${p.numero_comprobante}. Se descontó del almacén: ${usado.join(', ')}.` })
    } catch (err) {
      setRes({ ok: false, texto: /check/i.test(err.message) ? 'No alcanzan los insumos del almacén para esta venta.' : err.message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <dialog ref={dialogRef} className="a-modal" aria-labelledby="venta-titulo" onClose={() => setRes({ ok: true, texto: '' })}>
      <form onSubmit={vender}>
        <div className="a-modal__head">
          <h2 className="a-h" id="venta-titulo">Venta en barra</h2>
          <button type="button" className="a-iconbtn" aria-label="Cerrar" onClick={() => dialogRef.current?.close()}><X size={20} /></button>
        </div>
        <Estado r={r} que="las bebidas" n={2} />
        <Field label="Producto" as="select" value={id} onChange={(e) => setElegido(e.target.value)}>
          {bebidas.map((v) => <option key={v.id_variante} value={v.id_variante}>{v.nombre} {v.descripcion} ({fmtPEN(v.precio)})</option>)}
        </Field>
        <Field label="Cantidad" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
        {res.texto && <div className={`a-strip a-strip--${res.ok ? 'ok' : 'bad'}`} role="status"><div>{res.texto}</div></div>}
        <div className="a-modal__foot">
          <Btn variante="secondary" onClick={() => dialogRef.current?.close()}>Cerrar</Btn>
          <Btn type="submit" disabled={busy || !bebidas.length}>{busy ? 'Registrando venta...' : 'Cobrar en efectivo'}</Btn>
        </div>
      </form>
    </dialog>
  )
}

function Insumos({ insumos }) {
  const rows = insumos.map((i) => {
    const tope = Math.max(i.stock_minimo * 3, i.stock, 1)
    return {
      key: i.nombre,
      insumo: i.nombre,
      nivel: (
        <div className={`a-level${i.bajo ? ' a-level--low' : ''}`} role="img" aria-label={`Nivel de ${i.nombre}: ${Math.round((i.stock / tope) * 100)} % del tope`}>
          <i style={{ width: `${Math.min(100, (i.stock / tope) * 100)}%` }} />
          <b style={{ left: `${(i.stock_minimo / tope) * 100}%` }} />
        </div>
      ),
      stock: `${Math.round(i.stock).toLocaleString('es-PE')} ${i.unidad}`,
      minimo: `${Math.round(i.stock_minimo).toLocaleString('es-PE')} ${i.unidad}`,
      estado: i.bajo ? <Badge tono="alerta">Bajo el mínimo</Badge> : <Badge tono="ok">Suficiente</Badge>,
    }
  })
  const bajos = insumos.filter((i) => i.bajo)
  return (
    <Card flush titulo="Almacén de insumos" className="a-insumos">
      {bajos.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <div className="a-strip a-strip--bad" role="alert">
            <div>
              <strong>{bajos.length === 1 ? '1 insumo bajo el mínimo' : `${bajos.length} insumos bajo el mínimo`}</strong>
              <span>{bajos.map((i) => i.nombre).join(', ')}. Pide reposición al almacén.</span>
            </div>
          </div>
        </div>
      )}
      <Tabla
        columns={[
          { k: 'insumo', t: 'Insumo' }, { k: 'nivel', t: 'Nivel' }, { k: 'stock', t: 'Stock', num: true },
          { k: 'minimo', t: 'Mínimo', num: true }, { k: 'estado', t: 'Estado' },
        ]}
        rows={rows}
        vacio={<Empty chico Icon={Coffee} titulo="Sin insumos registrados">El almacén de la barra aparecerá aquí.</Empty>}
      />
    </Card>
  )
}

export function Barista() {
  useTitle('Barista')
  const r = useDatos(async () => {
    const [pedidos, insumos] = await Promise.all([api.listarPedidos({ estados: ['PAGADO', 'EN_PREPARACION', 'LISTO'] }), api.listarInsumos()])
    return { pedidos, insumos }
  })
  const [accion, setAccion] = useState({ codigo: null, error: '' })
  const [movidos, setMovidos] = useState([])
  const dialogo = useRef(null)
  useRefrescoPeriodico(r.recargar)

  const mover = async (codigo) => {
    setAccion({ codigo, error: '' })
    try {
      await avanzar(codigo)
      setAccion({ codigo: null, error: '' })
      setMovidos((m) => [...m, codigo])
      setTimeout(() => setMovidos((m) => m.filter((c) => c !== codigo)), 900)
    } catch (e) {
      setAccion({ codigo: null, error: e.message })
    }
  }

  if (!r.data) return <Estado r={r} que="los pedidos" tipo="tarjetas" n={3} />
  // Las ventas de barra que ya salieron de preparación no esperan reparto: no ocupan la columna Listos
  const pedidos = r.data.pedidos.filter((p) => !(p.canal === 'POS' && p.estado === 'LISTO'))
  return (
    <>
      <div className="a-toolbar">
        <p className="a-note grow">Cada tarjeta avanza un paso por vez. El perfil de sabor viene del CRM.</p>
        <Btn onClick={() => dialogo.current?.showModal()}><Plus size={16} weight="bold" aria-hidden="true" /> Nueva venta en barra</Btn>
      </div>
      <Aviso error={r.error || accion.error} />
      <div className="a-kanban">
        {COLUMNAS.map((c) => {
          const lista = pedidos.filter((p) => p.estado === c.estado)
          return (
            <section key={c.estado} className="a-col" data-col={c.estado} aria-labelledby={`col-${c.estado}`}>
              <div className="a-col__head">
                <h2 id={`col-${c.estado}`}>{c.titulo}</h2>
                <span className="a-count" aria-label={`${lista.length} pedidos`}>{lista.length}</span>
              </div>
              {lista.length ? (
                <ul className="a-col__list">
                  {lista.map((p) => (
                    <Ticket key={p.codigo} p={p} movido={movidos.includes(p.codigo)} ocupado={accion.codigo === p.codigo} onMover={mover} />
                  ))}
                </ul>
              ) : (
                <Empty chico titulo="Sin pedidos">{c.vacio}</Empty>
              )}
            </section>
          )
        })}
      </div>
      <Insumos insumos={r.data.insumos} />
      <VentaBarra dialogRef={dialogo} />
    </>
  )
}

export function DarkStore() {
  useTitle('Dark store')
  const r = useDatos(async () => {
    const [pedidos, cola, inventario, zonas] = await Promise.all([
      api.listarPedidos({ estados: ['LISTO', 'DESPACHADO'] }), api.colaDarkStore(), api.listarInventario(), api.listarZonas(),
    ])
    return { pedidos, cola, inventario, zonas }
  })
  const [accion, setAccion] = useState({ codigo: null, error: '' })
  useRefrescoPeriodico(r.recargar)

  const mover = async (codigo) => {
    setAccion({ codigo, error: '' })
    try {
      await avanzar(codigo)
      setAccion({ codigo: null, error: '' })
    } catch (e) {
      setAccion({ codigo: null, error: e.message })
    }
  }

  if (!r.data) return <Skeleton n={6} />
  const { cola, inventario, zonas } = r.data
  const filas = r.data.pedidos
    .filter((p) => p.canal !== 'POS')
    .map((p) => ({ p, c: cola.find((x) => x.codigo === p.codigo) }))
    .sort((a, b) => (a.c?.restanteMin ?? 1e9) - (b.c?.restanteMin ?? 1e9))
  return (
    <>
      <Aviso error={r.error || accion.error} />
      <Card flush titulo="Entregas por despachar" accion={<span className="muted">{filas.length} {filas.length === 1 ? 'pedido' : 'pedidos'}, el más urgente primero</span>}>
        <Tabla
          columns={[
            { k: 'pedido', t: 'Pedido' }, { k: 'cliente', t: 'Cliente' }, { k: 'distrito', t: 'Distrito' }, { k: 'estado', t: 'Estado' },
            { k: 'cuenta', t: 'Plazo de 24 h' }, { k: 'total', t: 'Total', num: true }, { k: 'accion', t: 'Acción', act: true },
          ]}
          rows={filas.map(({ p, c }) => {
            const q = cuenta(c)
            return {
              key: p.codigo,
              pedido: <><strong>{p.codigo}</strong><br /><span className="muted">{hora(p.fecha)}</span></>,
              cliente: p.cliente || 'Cliente sin nombre',
              distrito: p.distrito ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={14} aria-hidden="true" />{p.distrito}</span> : <span className="muted">Sin zona</span>,
              estado: <EstadoBadge estado={p.estado} />,
              cuenta: q ? <Badge tono={q.tono}>{q.texto}</Badge> : <span className="muted">Sin plazo</span>,
              total: money(p),
              accion: BOTON[p.estado] && (
                <Btn size="sm" disabled={accion.codigo === p.codigo} onClick={() => mover(p.codigo)}>
                  {accion.codigo === p.codigo ? 'Guardando...' : BOTON[p.estado]}
                </Btn>
              ),
            }
          })}
          vacio={<Empty Icon={Truck} titulo="No hay pedidos para repartir">Los pedidos listos aparecerán aquí con su cuenta regresiva de 24 horas.</Empty>}
        />
      </Card>
      <div className="a-grid a-grid--2">
        <Card flush titulo="Zonas de reparto">
          <Tabla
            columns={[{ k: 'distrito', t: 'Distrito' }, { k: 'costo', t: 'Costo de envío', num: true }]}
            rows={zonas.map((z) => ({ key: z.distrito, distrito: z.distrito, costo: fmtPEN(z.costo_envio) }))}
            vacio={<Empty chico titulo="Sin zonas">Las zonas de reparto aparecerán aquí.</Empty>}
          />
        </Card>
        <Card flush titulo="Inventario">
          <Tabla
            columns={[{ k: 'ubicacion', t: 'Ubicación' }, { k: 'producto', t: 'Producto' }, { k: 'cantidad', t: 'Cantidad', num: true }]}
            rows={inventario.map((i, n) => ({ key: n, ubicacion: i.ubicacion, producto: `${i.nombre} ${i.descripcion}`, cantidad: i.cantidad }))}
            vacio={<Empty chico titulo="Sin inventario">El stock de la dark store aparecerá aquí.</Empty>}
          />
        </Card>
      </div>
    </>
  )
}
