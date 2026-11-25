// Cosecha (registro por lote) y QR por empaque (etiquetas imprimibles)
import { useState } from 'react'
import { Plant, Printer } from '@phosphor-icons/react'
import Field from '../../components/Field'
import QrImage from '../../components/QrImage'
import { Btn, Card, Empty, Tabla } from '../../components/admin/ui'
import { passportUrl } from '../../config'
import { sealChange } from '../../data/chain'
import { addHarvest, getHarvests } from '../../data/ops'
import { passports } from '../../data/passports'
import useTitle from '../../useTitle'

const hoy = () => new Date().toISOString().slice(0, 10)
const opciones = passports.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)

// Registro de cosecha: se asocia a un lote, se muestra en su pasaporte y se sella en un bloque nuevo
export function Cosecha() {
  useTitle('Cosecha')
  const vacio = { batch: passports[0].code, date: hoy(), kg: '', humidity: '' }
  const [v, setV] = useState(vacio)
  const [errors, setErrors] = useState({})
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [, refresh] = useState(0)
  const rows = getHarvests()
  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
    setOk('')
  }
  const num = (x, min, max) => x !== '' && Number(x) >= min && Number(x) <= max

  const submit = async (e) => {
    e.preventDefault()
    const found = {}
    if (!v.date) found.date = 'Elige la fecha.'
    if (!num(v.kg, 1, 100000)) found.kg = 'Escribe los kilos (1 a 100 000).'
    if (!num(v.humidity, 5, 30)) found.humidity = 'La humedad va entre 5% y 30%.'
    setErrors(found)
    if (Object.keys(found).length || busy) return
    setBusy(true)
    const chain = await sealChange(v.batch, 'Cosecha registrado', () => addHarvest(v))
    setBusy(false)
    setV(vacio)
    setOk(`Cosecha registrado para el lote ${v.batch} (bloque ${chain.length - 1} sellado).`)
    refresh((n) => n + 1)
  }

  return (
    <div className="a-grid a-grid--side">
      <Card titulo="Registrar cosecha">
        <form onSubmit={submit} noValidate className="a-form">
          <Field label="Lote" as="select" value={v.batch} onChange={set('batch')}>{opciones}</Field>
          <Field label="Fecha" type="date" value={v.date} onChange={set('date')} error={errors.date} />
          <Field label="Kilos de cereza" inputMode="numeric" value={v.kg} onChange={set('kg')} error={errors.kg} autoComplete="off" />
          <Field label="Humedad inicial (%)" inputMode="decimal" value={v.humidity} onChange={set('humidity')} error={errors.humidity} autoComplete="off" />
          {ok && <div className="a-strip a-strip--ok" role="status"><div>{ok}</div></div>}
          <Btn type="submit" block disabled={busy}>{busy ? 'Sellando...' : 'Registrar cosecha'}</Btn>
        </form>
      </Card>
      <Card flush titulo="Registros de cosecha">
        <Tabla
          columns={[{ k: 'lote', t: 'Lote' }, { k: 'fecha', t: 'Fecha' }, { k: 'kg', t: 'Kilos', num: true }, { k: 'hum', t: 'Humedad (%)', num: true }]}
          rows={rows.map((r) => ({ key: r.id, lote: <strong>{r.batch}</strong>, fecha: r.date, kg: Number(r.kg).toLocaleString('es-PE'), hum: r.humidity }))}
          vacio={<Empty Icon={Plant} titulo="Todavía no hay registros">Cada cosecha que registres aparecerá aquí y en el pasaporte del lote.</Empty>}
        />
      </Card>
    </div>
  )
}

// Códigos QR reales para cada empaque de un lote
export function QrPorEmpaque() {
  useTitle('QR por empaque')
  const [batch, setBatch] = useState(passports[0].code)
  const [count, setCount] = useState(4)
  const n = Math.min(12, Math.max(1, Math.floor(Number(count)) || 1))
  return (
    <>
      <Card className="a-noprint">
        <div className="a-toolbar" style={{ alignItems: 'flex-end' }}>
          <div style={{ minWidth: 220, flex: '1 1 220px' }}><Field label="Lote" as="select" value={batch} onChange={(e) => setBatch(e.target.value)}>{opciones}</Field></div>
          <div style={{ minWidth: 200, flex: '1 1 200px' }}><Field label="Cantidad de etiquetas (1 a 12)" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} /></div>
          <Btn variante="secondary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Imprimir etiquetas</Btn>
        </div>
      </Card>
      <ul className="a-labels">
        {Array.from({ length: n }, (_, i) => {
          const code = `${batch}-U${String(i + 1).padStart(3, '0')}`
          return (
            <li key={code} className="a-label">
              <QrImage value={passportUrl(code)} label={`QR del empaque ${i + 1} del lote ${batch}`} filename={`qr-${code}`} className="label__qr" download />
              <strong>{batch}</strong>
              <span className="muted">Empaque {String(i + 1).padStart(3, '0')}</span>
              <span className="a-label__url">{passportUrl(code)}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}
