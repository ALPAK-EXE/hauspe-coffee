import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SealCheck, SealWarning, Warning, Coffee, MapPin, CalendarBlank, Fire, Package } from '@phosphor-icons/react'
import useTitle from '../useTitle'
import Field from '../components/Field'
import QrImage from '../components/QrImage'
import { passportUrl } from '../config'
import { ZERO_HASH, ensureChain, getChain, verifyChain } from '../data/chain'
import { addLead, getHarvests, getRoasts } from '../data/ops'
import { getPassport, unitOf } from '../data/passports'
import { getProduct } from '../data/products'
import { getDB, useDBVersion } from '../db/browser'
import * as repo from '../db/repo'
import { HUMIDITY_RANGE, humidityAlert, outOfRange, seriesFor } from '../data/telemetry'

const short = (h) => `0x${h.slice(0, 10)}…${h.slice(-6)}`

// Gráfico de lecturas; con `range` dibuja la banda aceptable y marca en rojo las lecturas fuera de ella
function Spark({ data, unit, title, range }) {
  const w = 300
  const h = 90
  const pts = data.slice(-12)
  const lo = Math.min(...pts, ...(range || []))
  const hi = Math.max(...pts, ...(range || []))
  const y = (v) => h - 8 - ((v - lo) / (hi - lo || 1)) * (h - 20)
  const x = (i) => (pts.length > 1 ? (i / (pts.length - 1)) * w : w / 2)
  const last = pts[pts.length - 1]
  const bad = range && outOfRange(last)
  return (
    <figure className="spark">
      <figcaption>
        <span>{title}</span>
        <strong className={bad ? 'is-error' : ''}>{last} {unit}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${title}: última lectura ${last} ${unit}${bad ? ', fuera de rango' : ''}`}>
        {range && <rect x="0" y={y(range[1])} width={w} height={y(range[0]) - y(range[1])} fill="var(--sand-soft)" />}
        <polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {range && pts.map((v, i) => outOfRange(v) && <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--error)" />)}
      </svg>
      <small className="muted">
        Últimas {pts.length} lecturas{range ? `, rango ${range[0]} a ${range[1]}${unit}` : ''}
      </small>
    </figure>
  )
}

// Captura de leads desde el QR de la bolsa (O2O)
function LeadForm({ code }) {
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    const digits = whatsapp.replace(/\D/g, '')
    if (!/^\+?[\d\s-]+$/.test(whatsapp.trim()) || digits.length < 9 || digits.length > 15) {
      setError('Escribe solo números, de 9 a 15 dígitos, con código de país (51987654321).')
      return
    }
    addLead({ whatsapp: whatsapp.trim(), source: code })
    try { repo.registrarLead(getDB(), { whatsapp: whatsapp.trim(), codigo_qr: code, origen: 'QR' }) } catch { /* el lead ya quedó en el registro local */ }
    setError('')
    setDone(true)
  }

  return (
    <section className="lead-box" aria-label="Recibe novedades">
      <h2 className="display-m">¿Te gustó este café?</h2>
      <p className="measure">Déjanos tu WhatsApp y te avisamos cuando haya una nueva cosecha de este lote.</p>
      {done ? (
        <p className="form-ok" role="status">Listo, te escribiremos por WhatsApp.</p>
      ) : (
        <form onSubmit={submit} noValidate className="newsletter__form">
          <Field label="WhatsApp" type="tel" inputMode="numeric" value={whatsapp} onChange={(e) => { setWhatsapp(e.target.value); setError('') }} error={error} hint="Con código de país, por ejemplo 51987654321." autoComplete="tel" />
          <button type="submit" className="btn btn--primary">Quiero novedades</button>
        </form>
      )}
      <p className="muted">
        ¿Prefieres tu café en casa? <Link to="/registro" className="text-link">Crear cuenta de suscriptor</Link>
      </p>
    </section>
  )
}

// Cadena de bloques del lote con verificación de integridad (SHA-256)
function Chain({ code, base }) {
  const [chain, setChain] = useState(() => getChain(code))
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ensureChain(code).then((c) => alive && setChain(c))
    return () => {
      alive = false
    }
  }, [code])

  const verify = async () => {
    setBusy(true)
    setResult(await verifyChain(code))
    setChain(getChain(code))
    setBusy(false)
  }

  const blocks = [...chain].reverse()
  return (
    <section className="chain">
      <h2 className="display-m">Registro en blockchain</h2>
      <p className="muted measure">
        Cada cambio del lote (cosecha, tueste, lecturas) crea un bloque nuevo con el SHA-256 de sus datos y del bloque anterior.
        Cadena local simulada.
      </p>
      <ol className="blocks" aria-label="Bloques del lote">
        {blocks.map((b) => (
          <li key={b.index} className="block">
            <div className="block__head">
              <strong>Bloque {base + b.index}</strong>
              <span className="muted">{new Date(b.at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
            <p className="muted">{b.reason}</p>
            <dl>
              <div><dt>Bloque anterior</dt><dd className="hash">{b.prev === ZERO_HASH ? 'Génesis (sin anterior)' : short(b.prev)}</dd></div>
              <div><dt>Hash</dt><dd className="hash" data-hash={b.hash}>{b === blocks[0] ? `0x${b.hash}` : short(b.hash)}</dd></div>
            </dl>
          </li>
        ))}
      </ol>
      <div className="chain__verify">
        <button type="button" className="btn btn--ghost" onClick={verify} disabled={busy || !chain.length}>
          {busy ? 'Verificando...' : 'Verificar integridad'}
        </button>
        {result && (
          <p className={result.ok ? 'verified' : 'is-error chain__bad'} role="status">
            {result.ok ? <SealCheck size={20} weight="fill" /> : <SealWarning size={20} weight="fill" />}
            {result.ok
              ? `Integridad verificada: ${result.blocks} ${result.blocks === 1 ? 'bloque coincide' : 'bloques coinciden'} con sus datos.`
              : result.problems.join(' ')}
          </p>
        )}
      </div>
    </section>
  )
}

const ETAPA = { FINCA: 'Finca (cosecha)', DARK_STORE: 'Dark store / almacén', TUESTE: 'Tueste', EXPORTACION: 'Exportación', DELIVERY: 'Delivery' }

// Ruta completa del lote leída de la base de datos: cada etapa firmada por un inspector y encadenada con SHA-256
function RutaFirmada({ codigo, lote }) {
  useDBVersion()
  const [data, setData] = useState(null)
  useEffect(() => {
    let vivo = true
    repo.pasaporte(getDB(), codigo).then((d) => vivo && setData(d || null))
    return () => { vivo = false }
  }, [codigo])
  if (!data) return null
  const v = data.verificacion
  const l = data.lote
  return (
    <section className="registry">
      <h2 className="display-m">Ruta del lote</h2>
      {data.vista === 'TECNICA' && (
        <dl className="dbx__ficha dbx__mt">
          <dt><strong>Ficha técnica para el importador</strong></dt>
          <dd className="muted">{l.finca_origen} · Productor {l.productor} · {l.altura_msnm} msnm · {l.variedad} · Proceso {l.proceso?.toLowerCase()} · SCA {l.puntaje_sca} · Cosecha {l.fecha_cosecha}{data.unidad ? ` · Costal ${data.unidad.peso_kg} kg, estado ${data.unidad.estado.toLowerCase().replace('_', ' ')}` : ''}</dd>
        </dl>
      )}
      {data.pedido && <p className="muted">Este empaque pertenece al pedido {data.pedido.codigo}.</p>}
      <p className={v.ok ? 'form-ok' : 'notice notice--warn'}>
        {v.ok ? `Cadena íntegra: ${v.bloques} etapas firmadas y verificadas con SHA-256.` : `Alerta: la cadena del lote ${lote} fue alterada en la etapa ${v.rotoEn}.`}
      </p>
      <ol className="dbx__ruta">
        {data.ruta.map((r) => (
          <li key={r.orden}>
            <strong>{r.orden}. {ETAPA[r.tipo] || r.tipo}</strong>
            <span>{r.ubicacion || 'Sin ubicación'}{r.detalle ? `, ${r.detalle}` : ''}</span>
            <span className="muted">Firmó {r.codigo_inspector} · {r.inspector}, {new Date(r.firmado_en.replace(' ', 'T')).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            <code>{r.hash.slice(0, 24)}…</code>
          </li>
        ))}
      </ol>
      {data.guia && <p className="muted">Guía recomendada: {data.guia.titulo}, proporción {data.guia.proporcion}.</p>}
    </section>
  )
}

export default function QrPassport() {
  const { codigo } = useParams()
  const pass = getPassport(codigo)
  useTitle(pass ? `Pasaporte ${codigo.toUpperCase()}` : 'Código no reconocido')

  if (!pass) {
    return (
      <div className="container page empty">
        <h1 className="display-l">Código no reconocido</h1>
        <p className="muted">Revisa el código impreso junto al QR, por ejemplo HP-ORI-0925.</p>
        <Link to="/catalogo" className="btn btn--primary">Ver cafés</Link>
      </div>
    )
  }
  const unit = unitOf(codigo)
  const product = getProduct(pass.productId)
  const isGreen = product.kind === 'b2b'
  const harvests = getHarvests().filter((h) => h.batch === pass.code)
  const roasts = getRoasts().filter((r) => r.batch === pass.code)
  const series = seriesFor(pass)
  const wet = humidityAlert(series)
  const isSack = /-s\d{3}$/i.test(codigo)
  const shownCode = unit ? `${pass.code}-${isSack ? 'S' : 'U'}${unit}` : pass.code

  return (
    <div className="container page">
      <header className="page__head passport__head">
        <div>
          <p className="verified"><SealCheck size={20} weight="fill" /> Verificado</p>
          <h1 className="display-l">Pasaporte digital</h1>
          <p className="lead">
            {isGreen ? `${product.finca}, café verde` : `Café ${product.name}`}. Lote {pass.code}.
          </p>
          {unit && <p className="muted"><Package size={16} aria-hidden="true" /> {isSack ? `Costal ${unit} de 60 kg (vista técnica)` : `Empaque ${unit}`}</p>}
        </div>
        <QrImage className="passport__qr" value={passportUrl(shownCode)} label={`QR de ${unit ? 'este empaque' : 'este lote'}, ${shownCode}`} filename={`qr-${shownCode}`} download />
      </header>

      <dl className="timeline">
        <div>
          <MapPin size={22} />
          <dt>Finca de origen</dt>
          <dd>{pass.finca}, Villa Rica, Pasco</dd>
        </div>
        <div>
          <CalendarBlank size={22} />
          <dt>Cosecha</dt>
          <dd>{pass.harvest}</dd>
        </div>
        <div>
          <Fire size={22} />
          <dt>Tueste</dt>
          <dd>{pass.roasted}</dd>
        </div>
        <div>
          <Coffee size={22} />
          <dt>Producto</dt>
          <dd>{product.name}{isGreen ? `, SCA ${product.sca}` : `, tueste ${product.roast.toLowerCase()}`}</dd>
        </div>
      </dl>

      <RutaFirmada codigo={codigo.toUpperCase()} lote={pass.code} />

      {(harvests.length > 0 || roasts.length > 0) && (
        <section className="registry">
          <h2 className="display-m">Registro de producción</h2>
          <ul className="ops__list">
            {harvests.map((h) => (
              <li key={h.id} className="ops__item ops__item--flat">
                <strong>Cosecha, {h.date}</strong>
                <span className="muted">{h.kg} kg de cereza, humedad inicial {h.humidity}%</span>
              </li>
            ))}
            {roasts.map((r) => (
              <li key={r.id} className="ops__item ops__item--flat">
                <strong>Tueste, {r.date}</strong>
                <span className="muted">{r.profile}, {r.temp} °C, {r.minutes} min</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="display-m">Almacenamiento</h2>
        <p className="muted measure">
          Lecturas simuladas de sensores IoT en la bodega{series.registered ? `, con ${series.registered} registradas en el panel interno` : ''}.
        </p>
        {wet !== null && (
          <p className="notice notice--warn" role="alert">
            <span><Warning size={18} aria-hidden="true" /> Humedad fuera de rango: {wet}% (recomendado {HUMIDITY_RANGE[0]} a {HUMIDITY_RANGE[1]}%).</span>
          </p>
        )}
        <div className="sparks">
          <Spark data={series.humidity} unit="%" title="Humedad del grano" range={HUMIDITY_RANGE} />
          <Spark data={series.co2} unit="ppm" title="CO2 en bodega" />
        </div>
      </section>

      <Chain code={pass.code} base={pass.block} />

      <LeadForm code={shownCode} />

      <div className="actions">
        <Link to={`/catalogo/${product.id}`} className="btn btn--primary">Ver {isGreen ? 'el lote' : 'este café'}</Link>
        <Link to={isGreen ? '/catalogo?tab=b2b' : '/catalogo'} className="btn btn--ghost">Ver el catálogo</Link>
      </div>
    </div>
  )
}
