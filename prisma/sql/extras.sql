-- =====================================================================
-- HausPe Coffee · Lo que Prisma no puede expresar en schema.prisma
--   1. Restricciones CHECK (MySQL 8.0.16+)
--   2. Triggers con reglas de negocio (SIGNAL SQLSTATE '45000')
--   3. Vistas
-- Se aplica después de "prisma db push" con:  npm run db:extras
-- Usa DELIMITER, así que también corre con el cliente "mysql".
-- =====================================================================

-- ---------- 1. CHECK ----------
ALTER TABLE Plan ADD CONSTRAINT ck_plan_nombre CHECK (nombre IN ('Gratuito','Premium','HORECA','Exportador'));
ALTER TABLE Plan ADD CONSTRAINT ck_plan_segmento CHECK (segmento IN ('B2C','B2B'));
ALTER TABLE Plan ADD CONSTRAINT ck_plan_precio CHECK (precio_mensual >= 0);

ALTER TABLE Cliente ADD CONSTRAINT ck_cliente_segmento CHECK (tipo_segmento IN ('B2C','B2B'));
ALTER TABLE Cliente ADD CONSTRAINT ck_cliente_tipo_b2b CHECK (tipo_b2b IS NULL OR tipo_b2b IN ('HORECA','IMPORTADOR'));
ALTER TABLE Cliente ADD CONSTRAINT ck_cliente_b2b_datos CHECK (tipo_segmento = 'B2C' OR (tipo_b2b IS NOT NULL AND empresa IS NOT NULL));

ALTER TABLE Membresia ADD CONSTRAINT ck_membresia_estado CHECK (estado IN ('ACTIVA','CANCELADA','VENCIDA'));
ALTER TABLE PerfilSabor ADD CONSTRAINT ck_perfil_intensidad CHECK (intensidad BETWEEN 1 AND 5);
ALTER TABLE ZonaReparto ADD CONSTRAINT ck_zona_costo CHECK (costo_envio >= 0);

ALTER TABLE Producto ADD CONSTRAINT ck_producto_tipo CHECK (tipo IN ('CAFE','BEBIDA','ACCESORIO','KIT','VERDE'));
ALTER TABLE VarianteProducto ADD CONSTRAINT ck_variante_moneda CHECK (moneda IN ('PEN','USD'));
ALTER TABLE VarianteProducto ADD CONSTRAINT ck_variante_precio CHECK (precio >= 0);
ALTER TABLE VarianteProducto ADD CONSTRAINT ck_variante_stock CHECK (stock >= 0);
ALTER TABLE Insumo ADD CONSTRAINT ck_insumo_unidad CHECK (unidad IN ('g','ml','u'));
ALTER TABLE Insumo ADD CONSTRAINT ck_insumo_stock CHECK (stock >= 0);
ALTER TABLE RecetaInsumo ADD CONSTRAINT ck_receta_cantidad CHECK (cantidad > 0);
ALTER TABLE Extra ADD CONSTRAINT ck_extra_precio CHECK (precio >= 0);
ALTER TABLE Promocion ADD CONSTRAINT ck_promocion_descuento CHECK (descuento > 0 AND descuento < 1);
ALTER TABLE SuscripcionCafe ADD CONSTRAINT ck_suscripcion_frecuencia CHECK (frecuencia IN ('SEMANAL','QUINCENAL','MENSUAL'));
ALTER TABLE SuscripcionCafe ADD CONSTRAINT ck_suscripcion_estado CHECK (estado IN ('ACTIVA','PAUSADA','CANCELADA'));

ALTER TABLE Pedido ADD CONSTRAINT ck_pedido_canal CHECK (canal IN ('WEB','POS','QR'));
ALTER TABLE Pedido ADD CONSTRAINT ck_pedido_tipo CHECK (tipo IN ('VENTA','COTIZACION'));
ALTER TABLE Pedido ADD CONSTRAINT ck_pedido_moneda CHECK (moneda IN ('PEN','USD'));
ALTER TABLE Pedido ADD CONSTRAINT ck_pedido_incoterm CHECK (incoterm IS NULL OR incoterm IN ('FOB','CIF'));
ALTER TABLE Pedido ADD CONSTRAINT ck_pedido_estado CHECK (estado IN ('PENDIENTE','PAGADO','EN_PREPARACION','LISTO','DESPACHADO','ENTREGADO','COTIZADO','CANCELADO'));
ALTER TABLE Pedido ADD CONSTRAINT ck_pedido_cotizacion CHECK (tipo = 'VENTA' OR (moneda = 'USD' AND incoterm IS NOT NULL));
ALTER TABLE DetallePedido ADD CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0);
ALTER TABLE DetallePedido ADD CONSTRAINT ck_detalle_precio CHECK (precio_unitario >= 0);
ALTER TABLE DetalleExtra ADD CONSTRAINT ck_detextra_cantidad CHECK (cantidad > 0);
ALTER TABLE Pago ADD CONSTRAINT ck_pago_metodo CHECK (metodo IN ('YAPE','EFECTIVO','TARJETA','TRANSFERENCIA'));
ALTER TABLE Pago ADD CONSTRAINT ck_pago_monto CHECK (monto > 0);
ALTER TABLE Pago ADD CONSTRAINT ck_pago_estado CHECK (estado IN ('APROBADO','RECHAZADO'));
ALTER TABLE Comprobante ADD CONSTRAINT ck_comprobante_tipo CHECK (tipo IN ('BOLETA','FACTURA','COTIZACION'));
ALTER TABLE Comprobante ADD CONSTRAINT ck_comprobante_suma CHECK (ABS(base_imponible + igv - total) < 0.011);
ALTER TABLE Valoracion ADD CONSTRAINT ck_valoracion_puntuacion CHECK (puntuacion BETWEEN 1 AND 5);
ALTER TABLE `Lead` ADD CONSTRAINT ck_lead_origen CHECK (origen IN ('QR','WEB','TIENDA'));
ALTER TABLE `Lead` ADD CONSTRAINT ck_lead_contacto CHECK (whatsapp IS NOT NULL OR email IS NOT NULL);

ALTER TABLE LoteCafe ADD CONSTRAINT ck_lote_sca CHECK (puntaje_sca BETWEEN 0 AND 100);
ALTER TABLE LoteCafe ADD CONSTRAINT ck_lote_tipo CHECK (tipo IN ('TOSTADO','VERDE'));
ALTER TABLE UnidadEmpaque ADD CONSTRAINT ck_unidad_tipo CHECK (tipo IN ('BOLSA','COSTAL'));
ALTER TABLE UnidadEmpaque ADD CONSTRAINT ck_unidad_peso CHECK (peso_kg > 0);
ALTER TABLE UnidadEmpaque ADD CONSTRAINT ck_unidad_estado CHECK (estado IN ('EN_ALMACEN','RESERVADA','DESPACHADA','ENTREGADA'));
ALTER TABLE Empleado ADD CONSTRAINT ck_empleado_rol CHECK (rol IN ('INSPECTOR_COSECHA','INSPECTOR_ENTREGA','INSPECTOR_PRODUCCION','REPARTIDOR','BARISTA','ADMIN'));
ALTER TABLE EtapaTrazabilidad ADD CONSTRAINT ck_etapa_tipo CHECK (tipo IN ('FINCA','DARK_STORE','TUESTE','EXPORTACION','DELIVERY'));
ALTER TABLE TelemetriaIoT ADD CONSTRAINT ck_telemetria_humedad CHECK (nivel_humedad BETWEEN 0 AND 100);
ALTER TABLE TelemetriaIoT ADD CONSTRAINT ck_telemetria_co2 CHECK (nivel_co2_ppm >= 0);
ALTER TABLE Inventario ADD CONSTRAINT ck_inventario_cantidad CHECK (cantidad >= 0);
ALTER TABLE Recordatorio ADD CONSTRAINT ck_recordatorio_tipo CHECK (tipo IN ('REPOSICION','CARRITO_ABANDONADO','NUEVA_COSECHA','PEDIDO_LISTO','REPOSICION_HORECA'));
ALTER TABLE Recordatorio ADD CONSTRAINT ck_recordatorio_canal CHECK (canal IN ('WHATSAPP','EMAIL','PANEL'));
ALTER TABLE Recordatorio ADD CONSTRAINT ck_recordatorio_estado CHECK (estado IN ('PROGRAMADO','ENVIADO','CANCELADO'));

-- ---------- 2. TRIGGERS (reglas de negocio) ----------
DELIMITER $$

DROP TRIGGER IF EXISTS trg_detalle_moneda$$
-- Un pedido no puede mezclar monedas: la variante debe tener la moneda del pedido
CREATE TRIGGER trg_detalle_moneda BEFORE INSERT ON DetallePedido
FOR EACH ROW
BEGIN
  IF (SELECT moneda FROM VarianteProducto WHERE id_variante = NEW.id_variante)
     <> (SELECT moneda FROM Pedido WHERE id_pedido = NEW.id_pedido) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden mezclar monedas en un mismo pedido';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_detalle_stock$$
-- Al vender, se descuenta el stock de la variante (si no alcanza, el CHECK stock >= 0 rechaza la venta)
CREATE TRIGGER trg_detalle_stock AFTER INSERT ON DetallePedido
FOR EACH ROW
BEGIN
  IF (SELECT tipo FROM Pedido WHERE id_pedido = NEW.id_pedido) = 'VENTA' THEN
    UPDATE VarianteProducto SET stock = stock - NEW.cantidad WHERE id_variante = NEW.id_variante;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_consumo_insumos$$
-- Cada venta descuenta del almacén el gramaje de sus insumos (si no alcanza, la venta se rechaza)
CREATE TRIGGER trg_consumo_insumos AFTER INSERT ON DetallePedido
FOR EACH ROW
BEGIN
  IF (SELECT tipo FROM Pedido WHERE id_pedido = NEW.id_pedido) = 'VENTA' THEN
    UPDATE Insumo i JOIN RecetaInsumo r ON r.id_insumo = i.id_insumo AND r.id_variante = NEW.id_variante
    SET i.stock = i.stock - NEW.cantidad * r.cantidad;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_cotizacion_sin_igv$$
-- La exportación de bienes no lleva IGV
CREATE TRIGGER trg_cotizacion_sin_igv BEFORE INSERT ON Comprobante
FOR EACH ROW
BEGIN
  IF NEW.tipo = 'COTIZACION' AND NEW.igv <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La exportación de bienes no está gravada con IGV';
  END IF;
END$$

DELIMITER ;

-- ---------- 3. VISTAS ----------
CREATE OR REPLACE VIEW v_ruta_lote AS
SELECT l.codigo_lote, e.orden, e.tipo AS etapa, e.ubicacion, f.firmado_en,
       em.codigo AS codigo_inspector, em.nombre AS inspector, f.hash, f.hash_anterior
FROM LoteCafe l
JOIN EtapaTrazabilidad e ON e.id_lote = l.id_lote
LEFT JOIN FirmaEtapa f   ON f.id_etapa = e.id_etapa
LEFT JOIN Empleado em    ON em.id_empleado = f.id_empleado
ORDER BY l.codigo_lote, e.orden;

CREATE OR REPLACE VIEW v_receta AS
SELECT p.nombre AS producto, v.descripcion AS variante, i.nombre AS insumo, r.cantidad, i.unidad
FROM RecetaInsumo r
JOIN VarianteProducto v ON v.id_variante = r.id_variante
JOIN Producto p ON p.id_producto = v.id_producto
JOIN Insumo i ON i.id_insumo = r.id_insumo
ORDER BY p.id_producto, v.id_variante;

CREATE OR REPLACE VIEW v_ventas_por_canal AS
SELECT canal, moneda, COUNT(*) AS pedidos, ROUND(SUM(total), 2) AS total
FROM Pedido WHERE estado <> 'CANCELADO'
GROUP BY canal, moneda;
