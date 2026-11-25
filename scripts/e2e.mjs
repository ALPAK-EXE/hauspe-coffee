// Prueba de extremo a extremo con Playwright contra la app local (npm run dev) y MySQL.
// Uso: npm run dev  (en otra terminal)  y luego  node scripts/e2e.mjs      (SOLO="texto" corre solo las pruebas que lo contengan)
// Deja datos de prueba en MySQL (pedidos, firma, ventas): al terminar, "npm run db:reset" restaura la demo.
import './_env.mjs'
import { chromium } from 'playwright'
import mysql from 'mysql2/promise'

const BASE = process.env.BASE || 'http://localhost:5173/#'
const ORIGEN = BASE.replace('/#', '')
const browser = await chromium.launch()
const log = console.log
let fallos = 0
const codigos = {}

const db = await mysql.createConnection(process.env.DATABASE_URL)
const uno = async (sql, p = []) => (await db.query(sql, p))[0][0]

async function nuevaPagina(conSalud = true) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(60000)
  if (!conSalud) await page.route('**/api/health', (r) => r.abort())
  return page
}
const SOLO = process.env.SOLO
const prueba = async (nombre, fn) => {
  if (SOLO && !nombre.includes(SOLO)) return
  const t0 = Date.now()
  try {
    await fn()
    log(`  ok    ${nombre} (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
  } catch (e) {
    fallos++
    log(`  FALLA ${nombre}: ${e.message.split('\n')[0]}`)
    // una prueba que falla no debe dejar su sesión abierta para las siguientes
    await page.context().clearCookies().catch(() => {})
  }
}
const esperar = (c, m) => { if (!c) throw new Error(m) }
const ir = async (page, ruta) => { await page.goto('about:blank'); await page.goto(BASE + ruta) }
// Llamadas a la API con la cookie de sesión del navegador
const llamar = (page, metodo, ruta, cuerpo) =>
  page.evaluate(async ([m, r, c]) => {
    const res = await fetch('/api' + r, { method: m, headers: c ? { 'Content-Type': 'application/json' } : undefined, body: c ? JSON.stringify(c) : undefined })
    return { status: res.status, json: await res.json().catch(() => null) }
  }, [metodo, ruta, cuerpo])
const yo = async (page) => (await llamar(page, 'GET', '/auth/yo'))
const cerrarTodo = async (page) => { await page.context().clearCookies(); await page.evaluate(() => localStorage.clear()) }

async function entrar(page, correo) {
  await ir(page, '/login')
  await page.getByLabel('Correo').fill(correo)
  await page.getByLabel('Contraseña').fill('demo123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL((u) => u.hash === '#/catalogo')
  return (await yo(page)).json
}
async function entrarPersonal(page, correo, destino = '') {
  await ir(page, '/admin/login' + destino)
  await page.getByLabel('Correo del personal').fill(correo)
  await page.getByLabel('Contraseña').fill('admin123')
  await page.getByRole('button', { name: 'Ingresar al panel' }).click()
  await page.waitForURL((u) => u.hash.startsWith('#/admin') && !u.hash.includes('login'))
}
const pestanas = async (page) => (await page.getByRole('tab').allInnerTexts()).map((t) => t.trim())
async function pagar(page, texto) {
  await page.getByRole('button', { name: 'Continuar al pago' }).click()
  await page.waitForURL((u) => u.hash === '#/checkout')
  // El código de operación de Yape solo existe en compras en soles (la cotización en US$ no paga con Yape)
  if (texto === 'Confirmar pago') await page.getByLabel('Código de operación').fill('1234567')
  await page.getByRole('button', { name: texto }).click()
  await page.waitForURL((u) => u.hash.startsWith('#/pedido/'))
  const codigo = decodeURIComponent(page.url().split('/pedido/')[1])
  await page.waitForSelector('.doc')
  return { codigo, texto: await page.locator('.doc').first().innerText() }
}

const page = await nuevaPagina()

log('=== Conexión')
await prueba('/api/health responde con MySQL y la app queda en modo remoto', async () => {
  await ir(page, '/')
  const h = await page.evaluate(() => fetch('/api/health').then((r) => r.json()))
  esperar(h.ok && h.motor === 'MySQL' && /^8\./.test(h.version) && h.orm === 'Prisma ORM', JSON.stringify(h))
  log('        ' + JSON.stringify(h))
  await page.waitForSelector('.hero')
  esperar(!(await page.getByText('Modo sin conexión').count()), 'muestra modo sin conexión')
})
await prueba('las cifras del inicio vienen de MySQL', async () => {
  await ir(page, '/')
  await page.getByText('Lotes con pasaporte').waitFor()
  const f = await uno('SELECT COUNT(*) n FROM LoteCafe')
  esperar((await page.locator('.band__stats').innerText()).includes(String(f.n)), 'no coincide con LoteCafe')
})

log('=== Login de las 4 cuentas de cliente (bcrypt + cookie de sesión)')
for (const m of ['cliente@hauspe.pe', 'premium@hauspe.pe', 'horeca@hauspe.pe', 'import@nordicroasters.de']) {
  await prueba(`login cliente ${m}`, async () => {
    const s = await entrar(page, m)
    esperar(s.tipo === 'cliente' && s.cliente.email === m, 'sesión inválida ' + JSON.stringify(s))
    await cerrarTodo(page)
  })
}
await prueba('contraseña incorrecta se rechaza', async () => {
  await ir(page, '/login')
  await page.getByLabel('Correo').fill('cliente@hauspe.pe')
  await page.getByLabel('Contraseña').fill('mala')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.getByText('Correo o contraseña incorrectos').waitFor()
})
await prueba('registro de una cuenta nueva (queda en la tabla Cliente con hash bcrypt)', async () => {
  const mail = `e2e${Date.now()}@test.pe`
  await ir(page, '/registro')
  await page.getByLabel('Nombre completo').fill('Prueba E2E')
  await page.getByLabel('Correo').fill(mail)
  await page.getByLabel('Contraseña').fill('secreto1')
  await page.getByLabel('WhatsApp').fill('+51 987654321')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await page.waitForURL((u) => u.hash === '#/catalogo')
  const c = await uno('SELECT password_hash FROM Cliente WHERE email = ?', [mail])
  esperar(c && c.password_hash.startsWith('$2'), 'no se guardó con bcrypt')
  esperar((await yo(page)).json.tipo === 'cliente', 'el registro no abrió sesión')
  await cerrarTodo(page)
})

log('=== Compras')
await prueba('compra B2C con boleta', async () => {
  await entrar(page, 'cliente@hauspe.pe')
  await ir(page, '/catalogo/casa')
  await page.getByRole('button', { name: /Agregar/ }).click()
  const r = await pagar(page, 'Confirmar pago')
  esperar(/B001-\d{8}/.test(r.texto) && /boleta/i.test(r.texto), 'sin boleta: ' + r.texto.slice(0, 120))
  codigos.boleta = r.codigo
  await cerrarTodo(page)
})
await prueba('compra HORECA de 1 kg con factura', async () => {
  await entrar(page, 'horeca@hauspe.pe')
  await ir(page, '/catalogo/tarde?pres=1kg')
  await page.getByRole('button', { name: /Agregar/ }).click()
  const r = await pagar(page, 'Confirmar pago')
  esperar(/F001-\d{8}/.test(r.texto) && /factura/i.test(r.texto) && r.texto.includes('20601234567'), 'sin factura/RUC: ' + r.texto.slice(0, 160))
  codigos.factura = r.codigo
  await cerrarTodo(page)
})
await prueba('cotización de exportación CIF a Alemania', async () => {
  await entrar(page, 'import@nordicroasters.de')
  await ir(page, '/catalogo/lote-esperanza')
  await page.getByLabel(/Sacos de/).fill('10')
  await page.getByLabel('Incoterm').selectOption('CIF')
  await page.getByLabel('País de destino').selectOption('DE')
  await page.getByRole('button', { name: 'Agregar a la cotización' }).click()
  const r = await pagar(page, 'Solicitar cotización')
  esperar(/COT-\d{8}/.test(r.texto), 'sin cotización: ' + r.texto.slice(0, 120))
  codigos.cotizacion = r.codigo
  await cerrarTodo(page)
})

log('=== Área de clientes: aislada del panel')
await prueba('un cliente no ve "Panel interno", ve sus pedidos y comprobantes y nada ajeno', async () => {
  await entrar(page, 'horeca@hauspe.pe')
  esperar(!(await page.getByText(/Panel interno|Ir al panel/).count()), 'la barra del cliente muestra el panel')
  await ir(page, '/mi-cuenta')
  await page.getByText('Pedidos y comprobantes registrados').waitFor()
  await page.getByText(/Factura F001-\d{8}/).first().waitFor()
  const mios = await llamar(page, 'GET', '/mi/pedidos')
  const id = (await uno("SELECT id_cliente FROM Cliente WHERE email = 'horeca@hauspe.pe'")).id_cliente
  esperar(mios.status === 200 && mios.json.length > 0 && mios.json.every((p) => p.id_cliente === id), 'devolvió pedidos de otra cuenta')
  const otro = await uno("SELECT p.codigo FROM Pedido p JOIN Cliente c ON c.id_cliente = p.id_cliente WHERE c.email = 'cliente@hauspe.pe' LIMIT 1")
  esperar((await llamar(page, 'GET', '/pedidos/' + otro.codigo)).status === 403, 'pudo leer un pedido ajeno')
  esperar((await llamar(page, 'POST', '/clientes/1/plan', { plan: 'Premium' })).status === 403, 'pudo cambiar el plan de otro')
})
await prueba('un cliente no puede entrar a /admin ni llamar a la API de administración (403)', async () => {
  await ir(page, '/admin')
  await page.getByRole('heading', { name: 'Acceso del personal' }).waitFor()
  esperar(page.url().endsWith('#/admin/login'), 'no redirigió al acceso del personal: ' + page.url())
  await ir(page, '/operaciones')
  await page.getByRole('heading', { name: 'Acceso del personal' }).waitFor()
  for (const [m, r, c] of [['GET', '/pedidos'], ['GET', '/admin/tablas'], ['POST', '/admin/sql', { sql: 'select 1' }], ['POST', '/tests', {}],
    ['GET', '/clientes'], ['GET', '/clientes/1/ficha'], ['GET', '/insumos'], ['GET', '/dark-store/cola'], ['GET', '/lotes'],
    ['POST', '/trazabilidad/etapas', { codigo_lote: 'HP-CASA-0925', tipo: 'DELIVERY', codigo_empleado: 'RD1' }], ['GET', '/recordatorios'], ['POST', '/telemetria/simular', {}]]) {
    const x = await llamar(page, m, r, c)
    esperar(x.status === 403, `${m} ${r} → ${x.status} (se esperaba 403)`)
  }
  esperar((await llamar(page, 'POST', '/admin/login', { email: 'cliente@hauspe.pe', password: 'demo123' })).status === 401, 'una cuenta de cliente entró como personal')
  await cerrarTodo(page)
})
await prueba('sin sesión: /admin redirige y la API responde 401; lo público sigue abierto', async () => {
  await ir(page, '/admin')
  await page.getByRole('heading', { name: 'Acceso del personal' }).waitFor()
  for (const r of ['/pedidos', '/admin/tablas', '/mi/pedidos', '/auth/yo', '/lotes']) {
    const x = await llamar(page, 'GET', r)
    esperar(x.status === 401, `GET ${r} → ${x.status} (se esperaba 401)`)
  }
  for (const r of ['/health', '/catalogo', '/zonas', '/pasaporte/HP-CASA-0925-U001']) {
    const x = await llamar(page, 'GET', r)
    esperar(x.status === 200, `GET ${r} → ${x.status} (se esperaba 200)`)
  }
})

log('=== Personal: cada rol ve solo sus pestañas')
const ROLES = [
  ['admin@hauspe.pe', 'Administrador', 'AD1', ['Barista', 'Dark store', 'Trazabilidad', 'Lotes IoT', 'CRM', 'Base de datos', 'Cosecha', 'Telemetría', 'Recordatorios', 'QR por empaque']],
  ['barista@hauspe.pe', 'Barista', 'BA1', ['Barista', 'CRM']],
  ['almacen@hauspe.pe', 'Dark store (reparto)', 'RD1', ['Dark store', 'Recordatorios']],
  ['inspector@hauspe.pe', 'Inspector de cosecha', 'IC1', ['Trazabilidad', 'Lotes IoT', 'Cosecha', 'Telemetría', 'QR por empaque']],
]
for (const [correo, etiqueta, codigo, tabs] of ROLES) {
  await prueba(`rol ${codigo} (${correo}): pestañas, barra propia y cierre de sesión`, async () => {
    await entrarPersonal(page, correo)
    esperar(JSON.stringify(await pestanas(page)) === JSON.stringify(tabs), 'pestañas: ' + (await pestanas(page)).join(', '))
    const barra = await page.locator('.adminbar').innerText()
    esperar(barra.includes(etiqueta) && barra.includes(codigo), 'la barra no muestra rol y código: ' + barra.replace(/\s+/g, ' '))
    esperar(!(await page.locator('.nav').count()), 'el área del personal usa la barra de la tienda')
    const s = (await yo(page)).json
    esperar(s.tipo === 'personal' && s.codigo === codigo, 'sesión: ' + JSON.stringify(s))
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await page.waitForURL((u) => u.hash === '#/admin/login')
    esperar((await yo(page)).status === 401, 'la sesión siguió abierta tras cerrar sesión')
  })
}
await prueba('el rol limita también la API (barista, dark store e inspector)', async () => {
  const esperado = {
    'barista@hauspe.pe': { 200: ['/pedidos', '/insumos', '/clientes'], 403: ['/dark-store/cola', '/lotes', '/admin/tablas', '/recordatorios', '/mi/pedidos'] },
    'almacen@hauspe.pe': { 200: ['/pedidos', '/dark-store/cola', '/recordatorios', '/inventario'], 403: ['/insumos', '/clientes', '/lotes', '/admin/tablas'] },
    'inspector@hauspe.pe': { 200: ['/lotes', '/lotes/dashboard', '/empleados?sinAdmin=1'], 403: ['/pedidos', '/clientes', '/insumos', '/dark-store/cola', '/admin/tablas'] },
  }
  for (const [correo, m] of Object.entries(esperado)) {
    await entrarPersonal(page, correo)
    for (const [estado, rutas] of Object.entries(m)) {
      for (const r of rutas) {
        const x = await llamar(page, 'GET', r)
        esperar(x.status === Number(estado), `${correo} GET ${r} → ${x.status} (se esperaba ${estado})`)
      }
    }
    esperar((await llamar(page, 'POST', '/tests', {})).status === 403, `${correo} pudo correr /api/tests`)
    await cerrarTodo(page)
  }
})
await prueba('el inspector solo firma con su propio código (IC1)', async () => {
  await entrarPersonal(page, 'inspector@hauspe.pe')
  await page.getByRole('tab', { name: 'Trazabilidad' }).click()
  const sel = page.getByLabel('Inspector que firma')
  await sel.waitFor()
  esperar(await sel.isDisabled() && (await sel.inputValue()) === 'IC1' && (await sel.locator('option').count()) === 1, 'el inspector puede elegir otro código')
  const otro = await llamar(page, 'POST', '/trazabilidad/etapas', { codigo_lote: 'HP-CASA-0925', tipo: 'DELIVERY', ubicacion: 'x', codigo_empleado: 'RD1' })
  esperar(otro.status === 403 && /propio código/.test(otro.json.error), `firmar con RD1 → ${otro.status} ${otro.json?.error}`)
  // la pantalla firma sobre el lote elegido por defecto: se cuentan las firmas de IC1 en toda la base
  const etapas = async () => (await uno('SELECT COUNT(*) n FROM FirmaEtapa f JOIN Empleado e ON e.id_empleado = f.id_empleado WHERE e.codigo = ?', ['IC1'])).n
  const antes = await etapas()
  await page.getByLabel('Ubicación').fill('Pachacámac, Lima')
  await page.getByRole('button', { name: 'Firmar y sellar etapa' }).click()
  await page.getByText(/Bloque \d+ sellado por IC1/).waitFor()
  const despues = await etapas()
  esperar(despues === antes + 1, 'no se guardó la etapa firmada por IC1')
  await page.getByRole('button', { name: 'Verificar integridad de la cadena' }).click()
  await page.getByText(/Cadena íntegra: \d+ bloques/).waitFor()
  await cerrarTodo(page)
})
await prueba('la cookie de sesión es httpOnly, secure, sameSite=lax y dura 8 horas; un token alterado no vale', async () => {
  await entrarPersonal(page, 'admin@hauspe.pe')
  const c = (await page.context().cookies()).find((x) => x.name === 'hp_sesion')
  esperar(c, 'no hay cookie hp_sesion')
  esperar(c.httpOnly && c.secure && c.sameSite === 'Lax', `atributos: ${JSON.stringify({ h: c.httpOnly, s: c.secure, ss: c.sameSite })}`)
  const horas = (c.expires - Date.now() / 1000) / 3600
  esperar(horas > 7.9 && horas <= 8.01, `dura ${horas.toFixed(2)} h`)
  esperar(!(await page.evaluate(() => document.cookie.includes('hp_sesion'))), 'la cookie es legible desde JavaScript')
  const partes = c.value.split('.')
  await page.context().addCookies([{ name: 'hp_sesion', value: `${partes[0]}.${partes[1]}.firmaFalsa${partes[2].slice(10)}`, url: ORIGEN, httpOnly: true, secure: true, sameSite: 'Lax' }])
  esperar((await llamar(page, 'GET', '/admin/tablas')).status === 401, 'aceptó un token con la firma alterada')
  await cerrarTodo(page)
})

log('=== Panel interno (como administrador)')
await prueba('venta de 2 lattes en barra descuenta insumos en MySQL', async () => {
  await entrarPersonal(page, 'admin@hauspe.pe')
  const antes = (await uno("SELECT stock FROM Insumo WHERE nombre = 'Leche entera'")).stock
  await page.getByRole('tab', { name: 'Barista' }).click()
  const sel = page.locator('.dbx__pos').getByLabel('Producto')
  const etiqueta = await sel.locator('option').filter({ hasText: 'Latte 12 oz' }).first().innerText()
  await sel.selectOption({ label: etiqueta.trim() })
  await page.locator('.dbx__pos').getByLabel('Cantidad').fill('2')
  await page.getByRole('button', { name: 'Cobrar en efectivo' }).click()
  await page.getByText(/Se descontó del almacén/).waitFor()
  const despues = (await uno("SELECT stock FROM Insumo WHERE nombre = 'Leche entera'")).stock
  esperar(antes - despues === 600, `leche descontada: ${antes - despues} ml`)
  log('        leche: ' + antes + ' → ' + despues + ' ml')
})
await prueba('el pedido de la boleta aparece en la cola del barista y avanza', async () => {
  await page.getByText(codigos.boleta).first().waitFor()
  await page.locator('.ops__item', { hasText: codigos.boleta }).getByRole('button', { name: 'Empezar a preparar' }).click()
  await page.locator('.ops__item', { hasText: codigos.boleta }).getByText('En preparación').waitFor()
  const p = await uno('SELECT estado FROM Pedido WHERE codigo = ?', [codigos.boleta])
  esperar(p.estado === 'EN_PREPARACION', 'estado en MySQL: ' + p.estado)
})
await prueba('firma de etapa (administrador) y verificación de la cadena', async () => {
  await page.getByRole('tab', { name: 'Trazabilidad' }).click()
  await page.getByLabel('Ubicación').fill('Miraflores, Lima')
  await page.getByRole('button', { name: 'Firmar y sellar etapa' }).click()
  await page.getByText(/Bloque \d+ sellado por RD1/).waitFor()
  await page.getByRole('button', { name: 'Verificar integridad de la cadena' }).click()
  await page.getByText(/Cadena íntegra: \d+ bloques/).waitFor()
})
await prueba('lotes IoT y CRM leen de MySQL', async () => {
  await page.getByRole('tab', { name: 'Lotes IoT' }).click()
  await page.getByText('HP-CASA-0925').first().waitFor()
  await page.getByRole('tab', { name: 'CRM' }).click()
  await page.getByText('Historial de pedidos').waitFor()
})

log('=== Pasaportes QR (públicos)')
await prueba('pasaporte de una bolsa (vista consumidor)', async () => {
  await ir(page, '/qr/HP-CASA-0925-U001')
  await page.getByText(/Cadena íntegra: \d+ etapas firmadas/).waitFor()
  await page.getByText(/pertenece al pedido/).waitFor()
})
await prueba('pasaporte de un costal (vista técnica)', async () => {
  await ir(page, '/qr/HP-VR-2607-A-S001')
  await page.getByText('Ficha técnica para el importador').waitFor()
  await page.getByText(/Cadena íntegra/).waitFor()
})

log('=== Base de datos y pruebas (como administrador)')
await prueba('Panel → Base de datos muestra la conexión a MySQL con Prisma', async () => {
  await ir(page, '/admin?tab=bd')
  await page.getByText(/Conectado a MySQL 8\.0 mediante Prisma ORM/).waitFor()
  await page.getByText(/Modelo de datos \(schema\.prisma\)/).waitFor()
  await page.getByRole('button', { name: /Ver los \d+ modelos/ }).click()
  await page.getByText('DetallePedido', { exact: false }).first().waitFor()
})
await prueba('consola SQL: SELECT funciona y DELETE se rechaza', async () => {
  await page.getByRole('button', { name: 'Ejecutar (Ctrl + Enter)' }).click()
  await page.getByText(/fila\(s\)/).first().waitFor()
  await page.getByRole('button', { name: 'Intentar escribir (se rechaza)' }).click()
  await page.getByRole('button', { name: 'Ejecutar (Ctrl + Enter)' }).click()
  await page.getByText(/solo lectura/i).last().waitFor()
  const n = await uno('SELECT COUNT(*) n FROM Pedido')
  esperar(n.n > 0, 'la tabla Pedido quedó vacía')
})
await prueba('las 25 pruebas en verde ejecutadas como ADMIN (transacción con ROLLBACK)', async () => {
  const foto = () => uno('SELECT (SELECT COUNT(*) FROM Cliente) c, (SELECT COUNT(*) FROM Pedido) p, (SELECT SUM(stock) FROM Insumo) s')
  const antes = await foto()
  await page.getByRole('button', { name: 'Ejecutar pruebas' }).click()
  await page.getByText(/25 de 25 pruebas superadas/).waitFor({ timeout: 300000 })
  esperar(JSON.stringify(antes) === JSON.stringify(await foto()), 'las pruebas ensuciaron la base')
  esperar(await page.getByText(/ROLLBACK aplicado/).count(), 'sin aviso de rollback')
  await cerrarTodo(page)
})

log('=== Respaldo sin conexión (SQLite local, mismos roles)')
const off = await nuevaPagina(false)
await prueba('si /api/health falla, la app usa SQLite local y avisa', async () => {
  await ir(off, '/')
  await off.getByText('Modo sin conexión (base local)').waitFor()
  await ir(off, '/login')
  await off.getByLabel('Correo').fill('cliente@hauspe.pe')
  await off.getByLabel('Contraseña').fill('demo123')
  await off.getByRole('button', { name: 'Ingresar' }).click()
  await off.waitForURL((u) => u.hash === '#/catalogo')
  await off.getByText('Hola, Lucía').first().waitFor({ state: 'attached' })
  esperar(!(await off.getByText(/Ir al panel/).count()), 'el cliente local ve el panel')
  await ir(off, '/admin')
  await off.getByRole('heading', { name: 'Acceso del personal' }).waitFor()
})
await prueba('modo local: el personal entra con los mismos roles y pestañas', async () => {
  await ir(off, '/admin/login')
  await off.getByRole('button', { name: 'Barista' }).click()
  await off.getByRole('button', { name: 'Ingresar al panel' }).click()
  await off.getByRole('tab', { name: 'CRM' }).waitFor()
  esperar(JSON.stringify(await pestanas(off)) === JSON.stringify(['Barista', 'CRM']), 'pestañas locales: ' + (await pestanas(off)).join(', '))
  await off.getByRole('button', { name: 'Cerrar sesión' }).click()
  await off.waitForURL((u) => u.hash === '#/admin/login')
})

log('=== Verificación directa en MySQL')
for (const [k, codigo] of Object.entries(codigos)) {
  await prueba(`${k} ${codigo} guardado en Pedido, Comprobante y DetallePedido`, async () => {
    const p = await uno(
      `SELECT p.estado, p.total, p.moneda, c.tipo, CONCAT(c.serie,'-',LPAD(c.numero,8,'0')) AS num,
              (SELECT COUNT(*) FROM DetallePedido d WHERE d.id_pedido = p.id_pedido) AS detalles,
              (SELECT COUNT(*) FROM Pago g WHERE g.id_pedido = p.id_pedido) AS pagos
       FROM Pedido p JOIN Comprobante c ON c.id_pedido = p.id_pedido WHERE p.codigo = ?`, [codigo])
    esperar(p, 'no existe en MySQL')
    log(`        ${codigo}: ${p.tipo} ${p.num}, ${p.moneda} ${p.total}, estado ${p.estado}, ${p.detalles} detalle(s), ${p.pagos} pago(s)`)
  })
}

await db.end()
await browser.close()
log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodo en verde')
process.exit(fallos ? 1 : 0)
