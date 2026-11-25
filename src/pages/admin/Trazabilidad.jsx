// Trazabilidad por etapas (cadena de bloques simulada): formulario a la izquierda, ruta del lote a la derecha
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Hash, SealCheck, ShieldCheck, ShieldWarning } from '@phosphor-icons/react'
import Field from '../../components/Field'
import { Aviso, Btn, Card, Empty, Estado, Skeleton } from '../../components/admin/ui'
import { useAuth } from '../../context/AuthContext'
import { api, useDatos } from '../../db/data'
import { esInspector } from '../../permisos.js'
import useTitle from '../../useTitle'
import { ETAPAS, hora } from './util'

export default function Trazabilidad() {
  useTitle('Trazabilidad')
  const { staff } = useAuth()
  const inspector = esInspector(staff.rol)
  const rl = useDatos(async () => ({ lotes: await api.listarLotes(), empleados: await api.listarEmpleados(true) }))
  const [elegido, setElegido] = useState('')
  const lote = elegido || rl.data?.lotes[0]?.codigo_lote || ''
  const rr = useDatos(() => (lote ? api.rutaLote(lote) : []), [lote])
  // Un inspector solo firma con su propio código; el administrador elige el inspector
  const [v, setV] = useState({ tipo: 'DELIVERY', ubicacion: '', emp: inspector ? staff.codigo : 'RD1' })
  const [ver, setVer] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const firmar = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await api.registrarEtapa({ codigo_lote: lote, tipo: v.tipo, ubicacion: v.ubicacion || null, codigo_empleado: v.emp })
      setMsg(`Bloque ${r.orden} sellado por ${r.inspector}.`)
      setVer(null)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }
  const verificar = async () => {
    setBusy(true)
    try {
      setVer(await api.verificarCadena(lote))
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!rl.data) return <Estado r={rl} que="los lotes" n={5} />
  const { lotes } = rl.data
  const empleados = inspector ? rl.data.empleados.filter((e) => e.codigo === staff.codigo) : rl.data.empleados
  const ruta = rr.data ?? []

  return (
    <div className="a-grid a-grid--side">
      <Card titulo="Firmar una etapa">
        <div className="a-form">
          <Field label="Lote" as="select" value={lote} onChange={(e) => { setElegido(e.target.value); setVer(null); setMsg('') }}>
            {lotes.map((l) => <option key={l.codigo_lote} value={l.codigo_lote}>{l.codigo_lote} ({l.tipo === 'VERDE' ? 'café verde' : 'tostado'})</option>)}
          </Field>
          <form className="a-form" onSubmit={firmar}>
            <Field label="Etapa" as="select" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
              {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </Field>
            <Field label="Ubicación" value={v.ubicacion} onChange={(e) => setV({ ...v, ubicacion: e.target.value })} placeholder="Ej. Miraflores, Lima" />
            <Field label="Inspector que firma" as="select" value={v.emp} disabled={inspector} hint={inspector ? 'Solo puedes firmar con tu propio código.' : undefined} onChange={(e) => setV({ ...v, emp: e.target.value })}>
              {empleados.map((x) => <option key={x.codigo} value={x.codigo}>{x.codigo} · {x.nombre} ({x.rol.replace(/_/g, ' ').toLowerCase()})</option>)}
            </Field>
            <Btn type="submit" block disabled={busy}>{busy ? 'Sellando...' : 'Firmar y sellar etapa'}</Btn>
          </form>
          {msg && <div className="a-strip a-strip--ok" role="status"><SealCheck size={18} weight="fill" aria-hidden="true" /><div>{msg}</div></div>}
        </div>
      </Card>

      <Card titulo={`Ruta del lote ${lote}`} accion={<Link className="a-btn a-btn--secondary a-btn--sm" to={`/qr/${lote}`}>Ver pasaporte del lote</Link>}>
        <div className="a-stack">
          {ver ? (
            <div className={`a-strip a-strip--${ver.ok ? 'ok' : 'bad'}`} role="status">
              {ver.ok ? <ShieldCheck size={20} weight="fill" aria-hidden="true" /> : <ShieldWarning size={20} weight="fill" aria-hidden="true" />}
              <div>
                <strong>{ver.ok ? `Cadena íntegra: ${ver.bloques} bloques verificados con SHA-256.` : `Cadena alterada en el bloque ${ver.rotoEn} (${ver.etapa}).`}</strong>
                <span>{ver.ok ? 'Ninguna etapa fue modificada después de firmarse.' : 'Alguien cambió una etapa después de firmarla. Revisa el bloque indicado.'}</span>
              </div>
            </div>
          ) : (
            <div className="a-strip" role="status">
              <ShieldCheck size={20} aria-hidden="true" />
              <div style={{ flex: 1 }}>Verifica que ninguna etapa haya cambiado desde que se firmó.</div>
              <Btn variante="secondary" size="sm" onClick={verificar} disabled={busy || !ruta.length}>Verificar integridad de la cadena</Btn>
            </div>
          )}
          {ver && <div><Btn variante="ghost" size="sm" onClick={verificar} disabled={busy}>Verificar integridad de la cadena</Btn></div>}
          <Aviso error={rr.error} />
          {rr.cargando && !rr.data ? <Skeleton n={3} /> : ruta.length ? (
            <ol className="a-route">
              {ruta.map((r) => {
                const et = ETAPAS.find((e) => e.id === r.tipo)
                const Icono = et?.Icon || Hash
                return (
                  <li key={r.orden}>
                    <span className="a-seal"><Icono size={20} aria-hidden="true" /></span>
                    <div className="a-route__body">
                      <strong>{r.orden}. {et?.label || r.tipo}</strong>
                      <span>{r.ubicacion || 'Sin ubicación'}</span>
                      <span className="muted">Firmó {r.codigo_inspector} · {r.inspector}, {hora(r.firmado_en)}</span>
                      <code className="a-hash" title={r.hash}><Hash size={12} aria-hidden="true" />{r.hash.slice(0, 12)}… desde {r.hash_anterior.slice(0, 8)}…</code>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <Empty Icon={ShieldCheck} titulo="Este lote aún no tiene etapas">Firma la primera etapa con el formulario y aparecerá en la ruta.</Empty>
          )}
        </div>
      </Card>
    </div>
  )
}
