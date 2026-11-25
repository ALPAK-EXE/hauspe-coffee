// Lotes IoT (estado por lote con sparklines) y Telemetría (lecturas de humedad y CO2)
import { useEffect, useRef, useState } from 'react'
import { ArrowClockwise, Thermometer } from '@phosphor-icons/react'
import Field from '../../components/Field'
import { Aviso, Badge, Btn, Card, Empty, Estado, Spark, Tabla } from '../../components/admin/ui'
import { sealChange } from '../../data/chain'
import { passports } from '../../data/passports'
import { HUMIDITY_RANGE, addReadings, getReadings, outOfRange, seriesFor, simulateReadings } from '../../data/telemetry'
import { api, useDatos } from '../../db/data'
import useTitle from '../../useTitle'
import { ETAPAS } from './util'

const fmtDate = (ms) => new Date(ms).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
const opciones = passports.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)
const chipHumedad = (h) => (h == null ? <span className="muted">Sin lectura</span> : <Badge tono={outOfRange(h) ? 'alerta' : 'ok'}>{String(h).replace('.', ',')} %{outOfRange(h) ? ' fuera de rango' : ''}</Badge>)

export function LotesIoT() {
  useTitle('Lotes IoT')
  const r = useDatos(() => api.dashboardLotes())
  const primera = useRef(true)
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    // Cada vez que se abre la sección, los sensores simulados envían una lectura nueva por lote
    if (!primera.current) return
    primera.current = false
    api.simularSensores().catch((e) => setError(e.message))
  }, [])
  const leer = async () => {
    setLeyendo(true)
    setError('')
    try {
      await api.simularSensores()
    } catch (e) {
      setError(e.message)
    } finally {
      setLeyendo(false)
    }
  }
  if (!r.data) return <Estado r={r} que="los lotes" n={6} />
  const lotes = r.data
  const alertas = lotes.filter((l) => l.alerta)
  return (
    <>
      <Aviso error={r.error || error} />
      {alertas.map((a) => (
        <div key={a.codigo_lote} className="a-strip a-strip--bad" role="alert">
          <div>
            <strong>Alerta: humedad de {a.humedad} % en {a.codigo_lote}.</strong>
            <span>Se notificó al panel y por WhatsApp al inspector. Rango recomendado: {HUMIDITY_RANGE[0]} a {HUMIDITY_RANGE[1]} %.</span>
          </div>
        </div>
      ))}
      <Card
        flush
        titulo="Estado de los lotes"
        accion={<Btn variante="secondary" size="sm" onClick={leer} disabled={leyendo}><ArrowClockwise size={16} aria-hidden="true" /> {leyendo ? 'Leyendo sensores...' : 'Leer sensores ahora'}</Btn>}
      >
        <Tabla
          columns={[
            { k: 'lote', t: 'Lote' }, { k: 'finca', t: 'Finca y variedad' },
            { k: 'sca', t: 'SCA', num: true }, { k: 'humedad', t: 'Humedad' }, { k: 'tendencia', t: 'Tendencia' }, { k: 'co2', t: 'CO2 (ppm)', num: true },
            { k: 'etapa', t: 'Etapa actual' }, { k: 'bloques', t: 'Bloques', num: true }, { k: 'qr', t: 'QR', num: true },
          ]}
          rows={lotes.map((l) => {
            const serie = passports.find((p) => p.code === l.codigo_lote)?.humidity
            return {
              key: l.codigo_lote,
              lote: <span className="a-two"><strong>{l.codigo_lote}</strong><small>{l.tipo === 'VERDE' ? 'Café verde' : 'Tostado'}</small></span>,
              finca: <span className="a-two"><span>{l.finca_origen}</span><small title={l.variedad}>{l.variedad}</small></span>,
              sca: l.puntaje_sca,
              humedad: chipHumedad(l.humedad),
              tendencia: serie && l.humedad != null ? <Spark data={[...serie, l.humedad]} alerta={l.alerta} /> : <span className="muted">Sin serie</span>,
              co2: l.co2 ?? '',
              etapa: ETAPAS.find((e) => e.id === l.etapa_actual)?.label ?? 'Sin etapas',
              bloques: l.etapas,
              qr: l.unidades,
            }
          })}
          vacio={<Empty Icon={Thermometer} titulo="No hay lotes registrados">Los lotes con sensores aparecerán aquí.</Empty>}
        />
      </Card>
      <p className="a-note">Los sensores Agro-IoT son simulados y escriben en la tabla TelemetriaIoT. La franja verde de cada gráfico marca el rango de humedad recomendado.</p>
    </>
  )
}

// Telemetría IoT simulada: lecturas manuales o generadas por un sensor simulado
export function Telemetria() {
  useTitle('Telemetría')
  const [batch, setBatch] = useState(passports[0].code)
  const [v, setV] = useState({ humidity: '', co2: '' })
  const [errors, setErrors] = useState({})
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [, refresh] = useState(0)
  const rows = getReadings().slice(-30).reverse()
  const porLote = passports.map((p) => {
    const s = seriesFor(p)
    const ultima = getReadings(p.code).at(-1)?.humidity ?? s.humidity.at(-1)
    return { code: p.code, serie: s.humidity, ultima }
  })
  const alertas = porLote.filter((x) => outOfRange(x.ultima))

  const save = async (list, text) => {
    setBusy(true)
    await sealChange(batch, 'Lecturas de sensores registradas', () => addReadings(list))
    setBusy(false)
    setOk(text)
    refresh((n) => n + 1)
  }
  const set = (k) => (e) => {
    setV((x) => ({ ...x, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
    setOk('')
  }
  const submit = (e) => {
    e.preventDefault()
    const found = {}
    if (!Number.isFinite(Number(v.humidity)) || v.humidity.trim() === '' || Number(v.humidity) < 0 || Number(v.humidity) > 40) found.humidity = 'La humedad va entre 0% y 40%.'
    if (!Number.isFinite(Number(v.co2)) || v.co2.trim() === '' || Number(v.co2) < 300 || Number(v.co2) > 5000) found.co2 = 'El CO2 va entre 300 y 5 000 ppm.'
    setErrors(found)
    if (Object.keys(found).length || busy) return
    save([{ batch, at: Date.now(), humidity: Number(v.humidity), co2: Math.round(Number(v.co2)) }], `Lectura registrada para ${batch}.`)
    setV({ humidity: '', co2: '' })
  }

  return (
    <div className="a-grid a-grid--side">
      <Card titulo="Registrar una lectura">
        <div className="a-form">
          <Field label="Lote" as="select" value={batch} onChange={(e) => { setBatch(e.target.value); setOk('') }}>{opciones}</Field>
          <form onSubmit={submit} noValidate className="a-form">
            <Field label="Humedad (%)" inputMode="decimal" value={v.humidity} onChange={set('humidity')} error={errors.humidity} hint={`Rango recomendado: ${HUMIDITY_RANGE[0]} a ${HUMIDITY_RANGE[1]}%.`} autoComplete="off" />
            <Field label="CO2 (ppm)" inputMode="numeric" value={v.co2} onChange={set('co2')} error={errors.co2} autoComplete="off" />
            <Btn type="submit" block disabled={busy}>Registrar lectura</Btn>
          </form>
          <Btn variante="secondary" block disabled={busy} onClick={() => save(simulateReadings(batch), `Sensor simulado: 6 lecturas nuevas para ${batch}.`)}>Simular sensor</Btn>
          {ok && <div className="a-strip a-strip--ok" role="status"><div>{ok}</div></div>}
        </div>
      </Card>
      <div className="a-stack">
        {alertas.map((a) => (
          <div key={a.code} className="a-strip a-strip--bad" role="alert">
            <div><strong>Humedad fuera de rango en {a.code}: {a.ultima}%.</strong><span>Rango {HUMIDITY_RANGE[0]} a {HUMIDITY_RANGE[1]}%.</span></div>
          </div>
        ))}
        <Card flush titulo="Humedad por lote">
          <Tabla
            columns={[{ k: 'lote', t: 'Lote' }, { k: 'ultima', t: 'Última lectura' }, { k: 'tendencia', t: 'Tendencia' }]}
            rows={porLote.map((x) => ({ key: x.code, lote: <strong>{x.code}</strong>, ultima: chipHumedad(x.ultima), tendencia: <Spark data={x.serie} alerta={outOfRange(x.ultima)} /> }))}
          />
        </Card>
        <Card flush titulo="Últimas lecturas registradas">
          <Tabla
            columns={[{ k: 'lote', t: 'Lote' }, { k: 'fecha', t: 'Fecha' }, { k: 'hum', t: 'Humedad', num: true }, { k: 'co2', t: 'CO2 (ppm)', num: true }]}
            rows={rows.map((r) => ({
              key: r.id,
              lote: <strong>{r.batch}</strong>,
              fecha: fmtDate(r.at),
              hum: <Badge tono={outOfRange(r.humidity) ? 'alerta' : 'ok'}>{String(r.humidity).replace('.', ',')} %</Badge>,
              co2: r.co2,
            }))}
            vacio={<Empty chico titulo="Sin lecturas registradas">Registra una lectura o simula el sensor. Se suman a los gráficos del pasaporte.</Empty>}
          />
        </Card>
      </div>
    </div>
  )
}
