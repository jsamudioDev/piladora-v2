# MEMORIA DEL PROYECTO — Piladora v2

## Qué es esto
Sistema de gestión para negocio de piladora de maíz en Panamá.
Dueño: Jacob Samudio | Ubuntu 24.04 | Acer Nitro 5

## Rutas
- Proyecto: /home/jacob/piladora-v2
- Frontend: /home/jacob/piladora-v2/app/frontend
- Backend: /home/jacob/piladora-v2/app/backend
- Diario: /home/jacob/piladora-v2/docs/obsidian/piladora-diario

## Stack
- Frontend: React 19 + Vite (puerto 5173)
- Backend: Node.js + Express 5 + Prisma 5 (puerto 3001)
- Base de datos: MySQL 8
- BD: piladora_db | usuario: piladora | contraseña: Piladora2026!
- Deploy: Railway (backend + MySQL) + Vercel (frontend)

## Módulos (9 en total)
1. Panel — dashboard ventas/ganancia/stock/alertas (solo ADMIN)
2. Venta — carrito, métodos de pago, historial, devoluciones
3. Pilar — registro de pilado, rendimientos, operarios
4. Pulidura — secado y pulidura con estadísticas
5. Stock — inventario Local+Piladora, traspasos, movimientos
6. Dinero — ingresos, egresos, flujo de caja
7. Créditos — créditos a clientes, abonos, resumen
8. Bitácora — auditoría de acciones (solo ADMIN)
9. Config — perfil, productos, operarios, parámetros, módulos por rol

## Roles del sistema
- ADMIN → acceso total, ruta inicial: /panel
- OPERARIO → Pilar, Pulidura, Stock, ruta inicial: /pilar
- VENDEDOR → Venta, Stock, ruta inicial: /venta

## MCP Servers activos
- github — commits automáticos
- mysql — acceso directo a piladora_db

## Credenciales de prueba
| Rol | Email | Contraseña |
|-----|-------|------------|
| ADMIN | admin@piladora.com | Admin2026! |
| VENDEDOR | vendedor@piladora.com | Vendedor2026! |
| OPERARIO | operario@piladora.com | Operario2026! |

## Estado de fases
- [x] Fase 1 — Auth JWT con roles (Admin/Vendedor/Operario)
- [x] Fase 2 — Seguridad: rate limiting, helmet, validación, CORS restrictivo
- [x] Fase 3 — Créditos y abonos con métodos de pago
- [x] Fase 4 — Rol OPERARIO + permisos granulares por sección
- [x] Fase 5 — Pulidura/Secado con estadísticas
- [x] Fase 6 — Devoluciones + Traspasos entre ubicaciones
- [x] Fase 7 — Bitácora auditoría + Admin Config expandido (perfil, productos, módulos dinámicos)
- [x] Fase 8 — Tickets de venta + Facturas con ITBMS y numeración correlativa
- [ ] Fase 9 — Mejoras UI/UX + PWA

## Próximo paso
Fase 9: Mejoras UI/UX + PWA (instalable en móvil y escritorio)

## Arquitectura backend
- Middleware global: authMiddleware (JWT), apiLimiter, helmet, CORS
- Middleware por ruta: requireRol(...roles), requireUbicacion()
- Servicio: bitacoraService.js (logging automático de acciones)
- Rutas: /api/auth | /api/panel | /api/ventas | /api/pilados | /api/stock
         /api/dinero | /api/creditos | /api/config | /api/pulidura
         /api/devoluciones | /api/traspasos | /api/bitacora

## Modelos Prisma
Usuario, Operario, Parametro, Producto, StockMovimiento,
Venta (con facturaNum, clienteRuc, clienteDireccion, aplicaITBMS),
DetalleVenta, Pilado, SecadoPulidura,
Credito, Abono, Ingreso, Egreso,
Devolucion, DetalleDevolucion, Traspaso, Bitacora
