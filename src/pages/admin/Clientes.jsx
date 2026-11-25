// CRM (lista de clientes con ficha) y Recordatorios predictivos de WhatsApp
import { useState } from 'react'
import { Bell, MagnifyingGlass, Users } from '@phosphor-icons/react'
import Field from '../../components/Field'
import ReminderChat from '../../components/ReminderChat'
import { Aviso, Badge, Btn, Card, Empty, Estado, EstadoBadge, Skeleton, Tabla } from '../../components/admin/ui'
import { useAuth } from '../../context/AuthContext'
import { REMINDER_DAYS, daysUntil, fmtDay, getAllSubs, isDue, pushChat, reminderText, subInfo, updateSub } from '../../data/subs'
import { api, useDatos } from '../../db/data'
import useTitle from '../../useTitle'
import { hora, iniciales, money } from './util'

export function Crm() {
  useTitle('CRM')
  const { staff } = useAuth()
  const rc = useDatos(() => api.listarClientes())
  const [elegido, setElegido] = useState('')
  const [q, setQ] = useState('')
  const id = elegido || rc.data?.[0]?.id_cliente || ''
  const rf = useDatos(() => (id ? api.fichaCliente(Number(id)) : null), [id])
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!rc.data) return <Estado r={rc} que="los clientes" n={6} />
  const clientes = rc.data
  const visibles = clientes.filter((c) => `${c.nombre} ${c.email}`.toLowerCase().includes(q.trim().toLowerCase()))
  const f = rf.data
  const c = f?.cliente
  const guardar = async (e) => {
    e.preventDefault()
    if (!nota.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.agregarNota(c.id_cliente, nota.trim(), staff.codigo)
      setNota('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="a-crm">
      <Card flush titulo={`Clientes (${clientes.length})`}>
        <div style={{ padding: '12px 12px 4px', position: 'relative' }}>
          <label className="sr-only" htmlFor="crm-q">Buscar cliente</label>
          <MagnifyingGlass size={16} aria-hidden="true" style={{ position: 'absolute', left: 24, top: 25, color: '#566558' }} />
          <input id="crm-q" className="a-input" style={{ paddingLeft: 34 }} type="search" placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        <div className="a-people">
          {visibles.map((x) => (
            <button key={x.id_cliente} type="button" className="a-person" aria-pressed={String(x.id_cliente) === String(id)} onClick={() => setElegido(x.id_cliente)}>
              <strong>{x.nombre}</strong>
              <small>{x.email}</small>
            </button>
          ))}
          {!visibles.length && <Empty chico Icon={Users} titulo="Sin resultados">Prueba con otro nombre o correo.</Empty>}
        </div>
      </Card>

      <div className="a-stack">
        <Aviso error={rf.error || error} />
        {!c ? <Skeleton n={4} /> : (
          <>
            <Card>
              <div className="a-profile">
                <span className="a-avatar" aria-hidden="true">{iniciales(c.nombre)}</span>
                <div>
                  <h2 className="a-h">{c.nombre}</h2>
                  <span className="muted">{c.email}{c.empresa ? ` · ${c.empresa}` : ''}</span>
                </div>
              </div>
              <dl className="a-facts" style={{ marginTop: 16 }}>
                <div><dt>Segmento</dt><dd>{c.tipo_segmento}{c.tipo_b2b ? ` · ${c.tipo_b2b}` : ''}</dd></div>
                <div><dt>Plan</dt><dd>{c.plan}</dd></div>
                <div><dt>País</dt><dd>{c.pais}</dd></div>
                <div><dt>WhatsApp</dt><dd>{c.telefono || 'Sin registrar'}</dd></div>
              </dl>
            </Card>
            <div className="a-grid a-grid--2">
              <Card titulo="Perfil de sabor">
                {f.perfil ? (
                  <dl className="a-facts">
                    <div><dt>Notas preferidas</dt><dd>{f.perfil.notas_preferidas}</dd></div>
                    <div><dt>Extracción</dt><dd>{f.perfil.metodo_extraccion}</dd></div>
                    <div><dt>Molienda</dt><dd>{f.perfil.tipo_molienda}</dd></div>
                    <div><dt>Intensidad</dt><dd>{f.perfil.intensidad} de 5</dd></div>
                  </dl>
                ) : <Empty chico titulo="Sin perfil de sabor">El cliente aún no hizo el matcher de sabor.</Empty>}
              </Card>
              <Card titulo="Notas">
                <form className="a-form" onSubmit={guardar}>
                  <Field label="Nueva nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. prefiere leche de avena" />
                  <Btn type="submit" size="sm" disabled={busy || !nota.trim()}>{busy ? 'Guardando...' : 'Guardar nota'}</Btn>
                </form>
                <ul className="a-stack" style={{ marginTop: 12 }}>
                  {f.notas.map((n, i) => (
                    <li key={i} className="a-note-item"><span>{n.nota}</span><span className="muted">{n.empleado || 'Sistema'}, {hora(n.creada_en)}</span></li>
                  ))}
                </ul>
                {!f.notas.length && <p className="muted" style={{ marginTop: 12 }}>Todavía no hay notas para este cliente.</p>}
              </Card>
            </div>
            <Card flush titulo="Historial de pedidos">
              <Tabla
                columns={[{ k: 'pedido', t: 'Pedido' }, { k: 'canal', t: 'Canal' }, { k: 'estado', t: 'Estado' }, { k: 'total', t: 'Total', num: true }, { k: 'fecha', t: 'Fecha' }]}
                rows={f.pedidos.map((p) => ({ key: p.codigo, pedido: <strong>{p.codigo}</strong>, canal: p.canal, estado: <EstadoBadge estado={p.estado} />, total: money(p), fecha: hora(p.fecha) }))}
                vacio={<Empty chico titulo="Sin pedidos">Las compras de este cliente aparecerán aquí.</Empty>}
              />
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

// Recordatorios predictivos de WhatsApp para las suscripciones activas
export function Recordatorios() {
  useTitle('Recordatorios')
  const [, refresh] = useState(0)
  const subs = getAllSubs().filter((s) => s.status === 'active')
  const send = (s) => {
    pushChat(s.id, [{ from: 'bot', text: reminderText(s, daysUntil(s.nextDelivery)) }])
    updateSub(s.id, { replied: false })
    refresh((n) => n + 1)
  }
  const advance = (s) => {
    updateSub(s.id, { nextDelivery: Date.now() + (REMINDER_DAYS - 0.5) * 24 * 3600 * 1000, chat: [], replied: false })
    refresh((n) => n + 1)
  }

  if (!subs.length) {
    return (
      <Card>
        <Empty Icon={Bell} titulo="No hay suscripciones activas">Cuando un cliente compre café con frecuencia semanal, quincenal o mensual, su aviso aparecerá aquí.</Empty>
      </Card>
    )
  }
  return (
    <>
      <p className="a-note">
        El aviso se calcula con la próxima entrega: cuando faltan {REMINDER_DAYS} días o menos se ofrece enviar el café. Los mensajes son simulados, no se envía nada.
      </p>
      <div className="a-grid a-grid--2">
        {subs.map((s) => {
          const { product } = subInfo(s)
          const days = daysUntil(s.nextDelivery)
          const due = isDue(s)
          return (
            <Card key={s.id} className="a-sub">
              <div className="a-card__head" style={{ marginBottom: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <h2 className="a-h a-h--s">{s.name}</h2>
                  <p className="muted">{product.name}, {s.qty} x, entrega {fmtDay(s.nextDelivery)} (en {days} d)</p>
                </div>
                <Badge tono={due ? 'cuidado' : 'neutro'}>{due ? 'Aviso pendiente' : 'Aún no toca'}</Badge>
              </div>
              <div className="a-toolbar">
                <Btn size="sm" onClick={() => send(s)} disabled={!due}>Enviar recordatorio</Btn>
                <Btn variante="secondary" size="sm" onClick={() => advance(s)}>Adelantar a {REMINDER_DAYS} días (demo)</Btn>
              </div>
              <details>
                <summary>Ver conversación</summary>
                <ReminderChat sub={s} interactive={false} />
              </details>
            </Card>
          )
        })}
      </div>
    </>
  )
}
