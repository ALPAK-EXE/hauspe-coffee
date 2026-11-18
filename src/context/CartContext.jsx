/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { load, save } from './storage'
import { getProduct, PLANS, quoteLot, round2, sizeOf } from '../data/products'

const CART_KEY = 'hauspe_cart'
const ORDERS_KEY = 'hauspe_orders'
const SERIES_KEY = 'hauspe_series'
const MAX_RETAIL_QTY = 20

const CartContext = createContext(null)

const currencyOf = (id) => (getProduct(id)?.kind === 'b2b' ? 'USD' : 'PEN')

// Calcula el detalle de una línea del carrito (todo redondeado a 2 decimales)
export function priceLine(item) {
  const product = getProduct(item.id)
  if (!product) return null
  if (product.kind === 'drink') {
    const size = sizeOf(product, item.size)
    return { item, product, currency: 'PEN', size, plan: PLANS[0], unit: size.price, saving: 0, total: round2(size.price * item.qty) }
  }
  if (product.kind === 'b2c') {
    const plan = PLANS.find((p) => p.id === item.plan) || PLANS[0]
    const unit = round2(product.price * (1 - plan.discount))
    return {
      item,
      product,
      currency: 'PEN',
      plan,
      unit,
      saving: round2((product.price - unit) * item.qty),
      total: round2(unit * item.qty),
    }
  }
  const quote = quoteLot(product, item.qty, item.incoterm, item.dest)
  return { item, product, currency: 'USD', quote, total: quote.total }
}

// Limita la cantidad a valores válidos según el tipo de producto
export function clampQty(item, qty) {
  const product = getProduct(item.id)
  const n = Math.floor(Number(qty)) || 0
  if (!product) return 1
  if (product.kind === 'b2b') return Math.min(product.stockSacks, Math.max(product.minSacks, n))
  return Math.min(MAX_RETAIL_QTY, Math.max(1, n))
}

// Valida lo guardado en localStorage (puede estar corrupto o desactualizado)
function loadItems() {
  const raw = load(CART_KEY, [])
  if (!Array.isArray(raw)) return []
  const valid = raw
    .filter((i) => i && getProduct(i.id))
    .map((i) => ({ ...i, key: i.key || crypto.randomUUID(), qty: clampQty(i, i.qty) }))
  // Carritos antiguos con dos monedas: se conserva solo la moneda del primer producto
  return valid.filter((i) => currencyOf(i.id) === currencyOf(valid[0].id))
}

// Número correlativo por serie (B001, F001...) para boleta, factura y cotización
export function nextNumber(series) {
  const all = load(SERIES_KEY, {})
  const n = (all[series] || 0) + 1
  save(SERIES_KEY, { ...all, [series]: n })
  return `${series}-${String(n).padStart(8, '0')}`
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadItems)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    save(CART_KEY, items)
  }, [items])

  // Un carrito solo admite una moneda: tienda (S/) o cotización de exportación (US$).
  // Devuelve { ok: false, reason: 'mixed', current } si se intenta mezclar.
  const addItem = useCallback(
    (entry, { replace = false } = {}) => {
      const cur = currencyOf(entry.id)
      const other = items.find((i) => currencyOf(i.id) !== cur)
      if (other && !replace) return { ok: false, reason: 'mixed', current: currencyOf(other.id) }
      const base = other ? [] : items
      const same = (i) =>
        i.id === entry.id &&
        i.grind === entry.grind &&
        i.size === entry.size &&
        i.plan === entry.plan &&
        i.incoterm === entry.incoterm &&
        i.dest === entry.dest
      if (base.some(same)) {
        setItems(base.map((i) => (same(i) ? { ...i, qty: clampQty(i, i.qty + entry.qty) } : i)))
      } else {
        setItems([...base, { ...entry, qty: clampQty(entry, entry.qty), key: crypto.randomUUID() }])
      }
      setOpen(true)
      return { ok: true }
    },
    [items],
  )

  const updateItem = useCallback(
    (key, patch) =>
      setItems((prev) =>
        prev.map((i) => {
          if (i.key !== key) return i
          const next = { ...i, ...patch }
          return { ...next, qty: clampQty(next, next.qty) }
        }),
      ),
    [],
  )
  const removeItem = useCallback((key) => setItems((prev) => prev.filter((i) => i.key !== key)), [])
  const clear = useCallback(() => setItems([]), [])

  const saveOrder = useCallback((order) => {
    save(ORDERS_KEY, [order, ...load(ORDERS_KEY, [])])
  }, [])

  const lines = useMemo(() => items.map(priceLine).filter(Boolean), [items])
  const totals = useMemo(() => {
    const sum = (cur) => round2(lines.filter((l) => l.currency === cur).reduce((s, l) => s + l.total, 0))
    const count = lines.reduce((s, l) => s + (l.currency === 'USD' ? 1 : l.item.qty), 0)
    return { pen: sum('PEN'), usd: sum('USD'), count }
  }, [lines])

  const value = useMemo(
    () => ({ items, lines, totals, open, setOpen, addItem, updateItem, removeItem, clear, saveOrder }),
    [items, lines, totals, open, addItem, updateItem, removeItem, clear, saveOrder],
  )
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}

export const getOrder = (id) => load(ORDERS_KEY, []).find((o) => o.id === id)
export const getOrders = () => load(ORDERS_KEY, [])

// Actualiza un pedido guardado (estado, alertas)
export function updateOrder(id, patch) {
  save(
    ORDERS_KEY,
    load(ORDERS_KEY, []).map((o) => (o.id === id ? { ...o, ...(typeof patch === 'function' ? patch(o) : patch) } : o)),
  )
}
