# HausPe Coffee E-Business (UNFV)

Prototipo académico: tienda, cafetería, trazabilidad con QR y panel interno. React + Vite en el navegador; MySQL 8 con Prisma ORM detrás de una API en funciones serverless de Vercel.

## Arquitectura

```
Navegador (React)  ──fetch /api──▶  api/main.js (Vercel)  ──Prisma──▶  MySQL 8 (servidor del equipo)
        │                                  └─ api/_lib/router.js, repo.js, admin.js, tests.js
        └─ si /api/health falla ──▶ SQLite local (sql.js) como respaldo: "Modo sin conexión"
```

- `prisma/schema.prisma`: 36 modelos (tablas), relaciones `@relation` con `onDelete`, claves compuestas `@@id`, índices.
- `prisma/sql/extras.sql`: lo que Prisma no soporta: CHECK, triggers (`SIGNAL SQLSTATE '45000'`) y las vistas `v_ruta_lote`, `v_ventas_por_canal`, `v_receta`.
- `prisma/seed.mjs`: datos de ejemplo (4 cuentas demo con contraseña `demo123`, cafés, bebidas con recetas, lotes con QR, firmas SHA-256 encadenadas…).
- `api/_lib/repo.js`: la lógica de negocio con Prisma; `prisma.$transaction` en crear pedido, registrar etapa, avanzar pedido, registro y cambio de plan.

## Puesta en marcha

```bash
npm install                 # genera el cliente de Prisma (postinstall)
cp .env.example .env.local  # y completa DATABASE_URL=mysql://usuario:clave@host:3306/base
npm run db:check            # SELECT VERSION() contra el servidor
npm run db:push             # crea las tablas (el usuario no puede crear la shadow database, por eso no migrate dev)
npm run db:extras           # CHECK, triggers y vistas
npm run db:seed             # datos de ejemplo
npm run dev                 # API local (puerto 3001) + Vite con proxy /api
```

`npm run db:reset` recrea todo (tablas, extras y seed) y **borra los datos** de la base. Otros comandos: `db:studio` (Prisma Studio), `lint`, `build`, `node scripts/e2e.mjs` (Playwright contra la app local, con `npm run dev` activo).

## Roles y sesiones

Dos áreas separadas, cada una con su login. La sesión es un JWT firmado (jose, HS256, `SESSION_SECRET`) en una cookie `httpOnly; Secure; SameSite=Lax` de 8 horas. Cada endpoint de `api/_lib/router.js` declara quién puede usarlo (401 sin sesión, 403 con rol incorrecto); los permisos viven en `src/permisos.js`.

| Área | Entrada | Cuenta | Contraseña | Ve |
|---|---|---|---|---|
| Clientes | `/login` | cliente@hauspe.pe (Gratuito), premium@hauspe.pe, horeca@hauspe.pe, import@nordicroasters.de (Importador) | demo123 | tienda, carrito, checkout, `/mi-cuenta` (solo SUS pedidos, suscripciones y comprobantes), pasaportes QR |
| Admin | `/admin/login` | admin@hauspe.pe (ADMIN) | admin123 | todas las pestañas |
| Barista | `/admin/login` | barista@hauspe.pe (BA1) | admin123 | Barista, CRM |
| Dark store | `/admin/login` | almacen@hauspe.pe (RD1) | admin123 | Dark store, Recordatorios |
| Inspector | `/admin/login` | inspector@hauspe.pe (IC1, Pablo Quispe) | admin123 | Trazabilidad, Lotes IoT, Cosecha, Telemetría, QR por empaque; solo firma con su código |

Públicos: `/api/health`, catálogo, zonas, pasaporte QR y captura de leads. `/operaciones` redirige a `/admin`. En modo sin conexión (SQLite local) los mismos roles funcionan, pero sin servidor que los haga cumplir.

## Triggers y permisos del servidor

Con el *binary log* activo, MySQL exige `SUPER` (o `log_bin_trust_function_creators = 1`) para crear triggers. Si el usuario no lo tiene, `db:extras` avisa y la API aplica las mismas reglas en código (misma lógica, mismo mensaje) hasta que el administrador ejecute `SET GLOBAL log_bin_trust_function_creators = 1;` y se repita `npm run db:extras`.

## Vercel

Variables de entorno (Settings → Environment Variables): `DATABASE_URL` y `SESSION_SECRET` (mínimo 32 caracteres aleatorios). Opcional: `?connection_limit=5` al final de la URL.
