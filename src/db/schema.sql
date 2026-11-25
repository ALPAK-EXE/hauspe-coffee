-- =====================================================================
-- HausPe Coffee E-Business · Esquema de base de datos (SQLite)
-- Basado en el diagrama ER del equipo, con correcciones:
--  * Membresía (plan del cliente) separada de SuscripcionCafe (frecuencia)
--  * Datos B2B en Cliente, datos de exportación en Pedido
--  * Tablas nuevas: Comprobante, Lead, Membresia
--  * FirmaEtapa referencia a Empleado (código IC1 = Pablo en un solo lugar)
-- =====================================================================
PRAGMA foreign_keys = ON;

-- ---------- CLIENTES Y PLANES ----------
CREATE TABLE Plan (
  id_plan        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL UNIQUE CHECK (nombre IN ('Gratuito','Premium','HORECA','Exportador')),
  segmento       TEXT NOT NULL CHECK (segmento IN ('B2C','B2B')),
  precio_mensual REAL NOT NULL DEFAULT 0 CHECK (precio_mensual >= 0),
  moneda         TEXT NOT NULL DEFAULT 'PEN',
  beneficios     TEXT NOT NULL DEFAULT '[]',          -- JSON
  activo         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE Cliente (
  id_cliente     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  telefono       TEXT,
  password_hash  TEXT NOT NULL,
  tipo_segmento  TEXT NOT NULL CHECK (tipo_segmento IN ('B2C','B2B')),
  tipo_b2b       TEXT CHECK (tipo_b2b IN ('HORECA','IMPORTADOR')),
  empresa        TEXT,
  ruc_taxid      TEXT,
  pais           TEXT NOT NULL DEFAULT 'Perú',
  idioma         TEXT NOT NULL DEFAULT 'es',
  creado_en      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK (tipo_segmento = 'B2C' OR (tipo_b2b IS NOT NULL AND empresa IS NOT NULL))
);

CREATE TABLE Membresia (
  id_membresia   INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente     INTEGER NOT NULL REFERENCES Cliente(id_cliente) ON DELETE CASCADE,
  id_plan        INTEGER NOT NULL REFERENCES Plan(id_plan),
  estado         TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','CANCELADA','VENCIDA')),
  inicio         TEXT NOT NULL DEFAULT (date('now','localtime')),
  fin            TEXT
);

CREATE TABLE PerfilSabor (
  id_perfil        INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente       INTEGER NOT NULL UNIQUE REFERENCES Cliente(id_cliente) ON DELETE CASCADE,
  notas_preferidas TEXT,
  tipo_molienda    TEXT,
  metodo_extraccion TEXT,
  intensidad       INTEGER CHECK (intensidad BETWEEN 1 AND 5),
  actualizado_en   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE ZonaReparto (
  id_zona     INTEGER PRIMARY KEY AUTOINCREMENT,
  distrito    TEXT NOT NULL UNIQUE,
  costo_envio REAL NOT NULL CHECK (costo_envio >= 0),
  activa      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE Direccion (
  id_direccion   INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente     INTEGER NOT NULL REFERENCES Cliente(id_cliente) ON DELETE CASCADE,
  id_zona        INTEGER REFERENCES ZonaReparto(id_zona),
  direccion      TEXT NOT NULL,
  referencia     TEXT,
  predeterminada INTEGER NOT NULL DEFAULT 0
);

-- ---------- CATÁLOGO ----------
CREATE TABLE GuiaPreparacion (
  id_guia         INTEGER PRIMARY KEY AUTOINCREMENT,
  metodo          TEXT NOT NULL UNIQUE,
  titulo          TEXT NOT NULL,
  texto           TEXT NOT NULL,
  proporcion      TEXT,
  tiempo_segundos INTEGER
);

CREATE TABLE Producto (
  id_producto  INTEGER PRIMARY KEY AUTOINCREMENT,
  sku          TEXT NOT NULL UNIQUE,
  nombre       TEXT NOT NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('CAFE','BEBIDA','ACCESORIO','KIT','VERDE')),
  categoria    TEXT,
  descripcion  TEXT,
  id_guia      INTEGER REFERENCES GuiaPreparacion(id_guia),
  activo       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE VarianteProducto (
  id_variante  INTEGER PRIMARY KEY AUTOINCREMENT,
  id_producto  INTEGER NOT NULL REFERENCES Producto(id_producto) ON DELETE CASCADE,
  descripcion  TEXT NOT NULL,          -- tamaño/peso, tueste, molienda, presentación
  moneda       TEXT NOT NULL DEFAULT 'PEN' CHECK (moneda IN ('PEN','USD')),
  precio       REAL NOT NULL CHECK (precio >= 0),
  unidad       TEXT NOT NULL DEFAULT 'unidad',
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

CREATE TABLE Insumo (
  id_insumo    INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT NOT NULL UNIQUE,
  unidad       TEXT NOT NULL CHECK (unidad IN ('g','ml','u')),
  stock        REAL NOT NULL CHECK (stock >= 0),
  stock_minimo REAL NOT NULL DEFAULT 0
);

-- Receta: gramaje de cada insumo por variante (bolsa de 250 g, latte 12 oz, etc.)
CREATE TABLE RecetaInsumo (
  id_variante INTEGER NOT NULL REFERENCES VarianteProducto(id_variante) ON DELETE CASCADE,
  id_insumo   INTEGER NOT NULL REFERENCES Insumo(id_insumo),
  cantidad    REAL NOT NULL CHECK (cantidad > 0),
  PRIMARY KEY (id_variante, id_insumo)
);

CREATE TABLE Extra (
  id_extra INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre   TEXT NOT NULL,
  precio   REAL NOT NULL CHECK (precio >= 0),
  activo   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE VarianteExtra (
  id_variante INTEGER NOT NULL REFERENCES VarianteProducto(id_variante) ON DELETE CASCADE,
  id_extra    INTEGER NOT NULL REFERENCES Extra(id_extra) ON DELETE CASCADE,
  PRIMARY KEY (id_variante, id_extra)
);

CREATE TABLE Promocion (
  id_promocion INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT NOT NULL,
  descuento    REAL NOT NULL CHECK (descuento > 0 AND descuento < 1),
  inicio       TEXT NOT NULL,
  fin          TEXT NOT NULL,
  id_plan      INTEGER REFERENCES Plan(id_plan)          -- NULL = para todos
);

CREATE TABLE PromocionProducto (
  id_promocion INTEGER NOT NULL REFERENCES Promocion(id_promocion) ON DELETE CASCADE,
  id_producto  INTEGER NOT NULL REFERENCES Producto(id_producto) ON DELETE CASCADE,
  PRIMARY KEY (id_promocion, id_producto)
);

CREATE TABLE SuscripcionCafe (
  id_suscripcion INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente     INTEGER NOT NULL REFERENCES Cliente(id_cliente) ON DELETE CASCADE,
  id_variante    INTEGER NOT NULL REFERENCES VarianteProducto(id_variante),
  frecuencia     TEXT NOT NULL CHECK (frecuencia IN ('SEMANAL','QUINCENAL','MENSUAL')),
  estado         TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','PAUSADA','CANCELADA')),
  inicio         TEXT NOT NULL DEFAULT (date('now','localtime')),
  proximo_envio  TEXT NOT NULL,
  fin            TEXT
);

-- ---------- COMPRA ----------
CREATE TABLE Pedido (
  id_pedido      INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo         TEXT NOT NULL UNIQUE,
  id_cliente     INTEGER REFERENCES Cliente(id_cliente),          -- NULL = venta POS anónima
  id_direccion   INTEGER REFERENCES Direccion(id_direccion),
  id_suscripcion INTEGER REFERENCES SuscripcionCafe(id_suscripcion),
  canal          TEXT NOT NULL CHECK (canal IN ('WEB','POS','QR')),
  tipo           TEXT NOT NULL DEFAULT 'VENTA' CHECK (tipo IN ('VENTA','COTIZACION')),
  moneda         TEXT NOT NULL CHECK (moneda IN ('PEN','USD')),
  incoterm       TEXT CHECK (incoterm IN ('FOB','CIF')),
  pais_destino   TEXT,
  estado         TEXT NOT NULL DEFAULT 'PENDIENTE'
                 CHECK (estado IN ('PENDIENTE','PAGADO','EN_PREPARACION','LISTO','DESPACHADO','ENTREGADO','COTIZADO','CANCELADO')),
  fecha          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  subtotal       REAL NOT NULL DEFAULT 0,
  descuento      REAL NOT NULL DEFAULT 0,
  costo_envio    REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  CHECK (tipo = 'VENTA' OR (moneda = 'USD' AND incoterm IS NOT NULL))
);

CREATE TABLE DetallePedido (
  id_detalle      INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido       INTEGER NOT NULL REFERENCES Pedido(id_pedido) ON DELETE CASCADE,
  id_variante     INTEGER NOT NULL REFERENCES VarianteProducto(id_variante),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
  configuracion   TEXT                       -- JSON (molienda, frecuencia, etc.)
);

CREATE TABLE DetalleExtra (
  id_detalle INTEGER NOT NULL REFERENCES DetallePedido(id_detalle) ON DELETE CASCADE,
  id_extra   INTEGER NOT NULL REFERENCES Extra(id_extra),
  cantidad   INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  PRIMARY KEY (id_detalle, id_extra)
);

CREATE TABLE Pago (
  id_pago    INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido  INTEGER NOT NULL REFERENCES Pedido(id_pedido) ON DELETE CASCADE,
  metodo     TEXT NOT NULL CHECK (metodo IN ('YAPE','EFECTIVO','TARJETA','TRANSFERENCIA')),
  monto      REAL NOT NULL CHECK (monto > 0),
  estado     TEXT NOT NULL DEFAULT 'APROBADO' CHECK (estado IN ('APROBADO','RECHAZADO')),
  referencia TEXT,
  pagado_en  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE Comprobante (
  id_comprobante INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido      INTEGER NOT NULL UNIQUE REFERENCES Pedido(id_pedido) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('BOLETA','FACTURA','COTIZACION')),
  serie          TEXT NOT NULL,
  numero         INTEGER NOT NULL,
  doc_cliente    TEXT,
  base_imponible REAL NOT NULL,
  igv            REAL NOT NULL,
  total          REAL NOT NULL,
  emitido_en     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (serie, numero),
  CHECK (abs(base_imponible + igv - total) < 0.011)
);

CREATE TABLE ListaDeseos (
  id_cliente  INTEGER NOT NULL REFERENCES Cliente(id_cliente) ON DELETE CASCADE,
  id_producto INTEGER NOT NULL REFERENCES Producto(id_producto) ON DELETE CASCADE,
  agregado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (id_cliente, id_producto)
);

CREATE TABLE Valoracion (
  id_valoracion INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente    INTEGER NOT NULL REFERENCES Cliente(id_cliente) ON DELETE CASCADE,
  id_producto   INTEGER NOT NULL REFERENCES Producto(id_producto) ON DELETE CASCADE,
  puntuacion    INTEGER NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario    TEXT,
  fecha         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE Lead (
  id_lead     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT,
  whatsapp    TEXT,
  email       TEXT,
  origen      TEXT NOT NULL DEFAULT 'QR' CHECK (origen IN ('QR','WEB','TIENDA')),
  codigo_qr   TEXT,
  id_cliente  INTEGER REFERENCES Cliente(id_cliente),   -- se llena si el lead se registra
  creado_en   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK (whatsapp IS NOT NULL OR email IS NOT NULL)
);

-- ---------- CAFÉ, LOTES Y TRAZABILIDAD ----------
CREATE TABLE LoteCafe (
  id_lote        INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_lote    TEXT NOT NULL UNIQUE,
  id_producto    INTEGER REFERENCES Producto(id_producto),
  finca_origen   TEXT NOT NULL,
  productor      TEXT,
  altura_msnm    INTEGER,
  variedad       TEXT,
  proceso        TEXT,
  puntaje_sca    REAL CHECK (puntaje_sca BETWEEN 0 AND 100),
  fecha_cosecha  TEXT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('TOSTADO','VERDE'))
);

CREATE TABLE UnidadEmpaque (
  id_unidad  INTEGER PRIMARY KEY AUTOINCREMENT,
  id_lote    INTEGER NOT NULL REFERENCES LoteCafe(id_lote) ON DELETE CASCADE,
  codigo_qr  TEXT NOT NULL UNIQUE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('BOLSA','COSTAL')),
  peso_kg    REAL NOT NULL CHECK (peso_kg > 0),
  estado     TEXT NOT NULL DEFAULT 'EN_ALMACEN' CHECK (estado IN ('EN_ALMACEN','RESERVADA','DESPACHADA','ENTREGADA'))
);

CREATE TABLE PedidoUnidad (
  id_detalle INTEGER NOT NULL REFERENCES DetallePedido(id_detalle) ON DELETE CASCADE,
  id_unidad  INTEGER NOT NULL UNIQUE REFERENCES UnidadEmpaque(id_unidad),
  PRIMARY KEY (id_detalle, id_unidad)
);

CREATE TABLE Empleado (
  id_empleado INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT NOT NULL UNIQUE,      -- IC1, IE1, IP1, RD1, BA1 ...
  nombre      TEXT NOT NULL,
  rol         TEXT NOT NULL CHECK (rol IN ('INSPECTOR_COSECHA','INSPECTOR_ENTREGA','INSPECTOR_PRODUCCION','REPARTIDOR','BARISTA','ADMIN')),
  email         TEXT UNIQUE,          -- acceso al panel /admin (solo personal con cuenta)
  password_hash TEXT
);

CREATE TABLE EtapaTrazabilidad (
  id_etapa  INTEGER PRIMARY KEY AUTOINCREMENT,
  id_lote   INTEGER NOT NULL REFERENCES LoteCafe(id_lote) ON DELETE CASCADE,
  orden     INTEGER NOT NULL,
  tipo      TEXT NOT NULL CHECK (tipo IN ('FINCA','DARK_STORE','TUESTE','EXPORTACION','DELIVERY')),
  ubicacion TEXT,
  fecha     TEXT NOT NULL,
  detalle   TEXT,
  UNIQUE (id_lote, orden)
);

CREATE TABLE FirmaEtapa (
  id_firma      INTEGER PRIMARY KEY AUTOINCREMENT,
  id_etapa      INTEGER NOT NULL UNIQUE REFERENCES EtapaTrazabilidad(id_etapa) ON DELETE CASCADE,
  id_empleado   INTEGER NOT NULL REFERENCES Empleado(id_empleado),
  firmado_en    TEXT NOT NULL,
  hash          TEXT NOT NULL UNIQUE,
  hash_anterior TEXT NOT NULL
);

CREATE TABLE TelemetriaIoT (
  id_registro          INTEGER PRIMARY KEY AUTOINCREMENT,
  id_lote              INTEGER NOT NULL REFERENCES LoteCafe(id_lote) ON DELETE CASCADE,
  nivel_humedad        REAL NOT NULL CHECK (nivel_humedad BETWEEN 0 AND 100),
  nivel_co2_ppm        REAL NOT NULL CHECK (nivel_co2_ppm >= 0),
  nivel_desgasificacion REAL,
  leido_en             TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------- OPERACIÓN, CRM Y CONTENIDO ----------
CREATE TABLE Inventario (
  id_inventario  INTEGER PRIMARY KEY AUTOINCREMENT,
  id_variante    INTEGER NOT NULL REFERENCES VarianteProducto(id_variante) ON DELETE CASCADE,
  ubicacion      TEXT NOT NULL,            -- Dark Store Surco, Tostaduría, Almacén Villa Rica
  cantidad       INTEGER NOT NULL CHECK (cantidad >= 0),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (id_variante, ubicacion)
);

CREATE TABLE Entrega (
  id_entrega      INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido       INTEGER NOT NULL UNIQUE REFERENCES Pedido(id_pedido) ON DELETE CASCADE,
  id_zona         INTEGER REFERENCES ZonaReparto(id_zona),
  id_empleado     INTEGER REFERENCES Empleado(id_empleado),
  programada_para TEXT NOT NULL,           -- límite de 24 h desde el pago
  preparada_en    TEXT,
  despachada_en   TEXT,
  entregada_en    TEXT
);

CREATE TABLE ClienteNota (
  id_nota     INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente  INTEGER NOT NULL REFERENCES Cliente(id_cliente) ON DELETE CASCADE,
  id_empleado INTEGER REFERENCES Empleado(id_empleado),
  nota        TEXT NOT NULL,
  creada_en   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE Recordatorio (
  id_recordatorio INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente      INTEGER NOT NULL REFERENCES Cliente(id_cliente) ON DELETE CASCADE,
  id_pedido       INTEGER REFERENCES Pedido(id_pedido),
  tipo            TEXT NOT NULL CHECK (tipo IN ('REPOSICION','CARRITO_ABANDONADO','NUEVA_COSECHA','PEDIDO_LISTO','REPOSICION_HORECA')),
  mensaje         TEXT NOT NULL,
  programado_en   TEXT NOT NULL,
  enviado_en      TEXT,
  canal           TEXT NOT NULL DEFAULT 'WHATSAPP' CHECK (canal IN ('WHATSAPP','EMAIL','PANEL')),
  estado          TEXT NOT NULL DEFAULT 'PROGRAMADO' CHECK (estado IN ('PROGRAMADO','ENVIADO','CANCELADO'))
);

CREATE TABLE ArticuloBlog (
  id_articulo  INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo       TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  contenido    TEXT NOT NULL,
  publicado_en TEXT NOT NULL DEFAULT (date('now','localtime'))
);

-- ---------- ÍNDICES ----------
CREATE INDEX idx_pedido_cliente   ON Pedido(id_cliente);
CREATE INDEX idx_detalle_pedido   ON DetallePedido(id_pedido);
CREATE INDEX idx_unidad_lote      ON UnidadEmpaque(id_lote);
CREATE INDEX idx_etapa_lote       ON EtapaTrazabilidad(id_lote);
CREATE INDEX idx_telemetria_lote  ON TelemetriaIoT(id_lote, leido_en);

-- ---------- REGLAS DE NEGOCIO (TRIGGERS) ----------
-- Un pedido no puede mezclar monedas: la variante debe tener la moneda del pedido
CREATE TRIGGER trg_detalle_moneda
BEFORE INSERT ON DetallePedido
WHEN (SELECT moneda FROM VarianteProducto WHERE id_variante = NEW.id_variante)
  <> (SELECT moneda FROM Pedido WHERE id_pedido = NEW.id_pedido)
BEGIN
  SELECT RAISE(ABORT, 'No se pueden mezclar monedas en un mismo pedido');
END;

-- Al vender, se descuenta el stock de la variante
CREATE TRIGGER trg_detalle_stock
AFTER INSERT ON DetallePedido
WHEN (SELECT tipo FROM Pedido WHERE id_pedido = NEW.id_pedido) = 'VENTA'
BEGIN
  UPDATE VarianteProducto SET stock = stock - NEW.cantidad WHERE id_variante = NEW.id_variante;
END;

-- Cada venta descuenta del almacén el gramaje de sus insumos (si no alcanza, la venta se rechaza)
CREATE TRIGGER trg_consumo_insumos
AFTER INSERT ON DetallePedido
WHEN (SELECT tipo FROM Pedido WHERE id_pedido = NEW.id_pedido) = 'VENTA'
BEGIN
  UPDATE Insumo SET stock = stock - NEW.cantidad *
    (SELECT r.cantidad FROM RecetaInsumo r WHERE r.id_variante = NEW.id_variante AND r.id_insumo = Insumo.id_insumo)
  WHERE id_insumo IN (SELECT id_insumo FROM RecetaInsumo WHERE id_variante = NEW.id_variante);
END;

-- La exportación no lleva IGV
CREATE TRIGGER trg_cotizacion_sin_igv
BEFORE INSERT ON Comprobante
WHEN NEW.tipo = 'COTIZACION' AND NEW.igv <> 0
BEGIN
  SELECT RAISE(ABORT, 'La exportación de bienes no está gravada con IGV');
END;

-- ---------- VISTAS ----------
CREATE VIEW v_ruta_lote AS
SELECT l.codigo_lote, e.orden, e.tipo AS etapa, e.ubicacion, f.firmado_en,
       em.codigo AS codigo_inspector, em.nombre AS inspector, f.hash, f.hash_anterior
FROM LoteCafe l
JOIN EtapaTrazabilidad e ON e.id_lote = l.id_lote
LEFT JOIN FirmaEtapa f   ON f.id_etapa = e.id_etapa
LEFT JOIN Empleado em    ON em.id_empleado = f.id_empleado
ORDER BY l.codigo_lote, e.orden;

CREATE VIEW v_receta AS
SELECT p.nombre AS producto, v.descripcion AS variante, i.nombre AS insumo, r.cantidad, i.unidad
FROM RecetaInsumo r JOIN VarianteProducto v ON v.id_variante = r.id_variante
JOIN Producto p ON p.id_producto = v.id_producto JOIN Insumo i ON i.id_insumo = r.id_insumo
ORDER BY p.id_producto, v.id_variante;

CREATE VIEW v_ventas_por_canal AS
SELECT canal, moneda, COUNT(*) AS pedidos, ROUND(SUM(total), 2) AS total
FROM Pedido WHERE estado <> 'CANCELADO'
GROUP BY canal, moneda;
