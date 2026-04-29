'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

interface OrderData {
  id: string
  orderId: string
  transactionId: string
  customerEmail: string
  customerName: string
  customerPhone: string
  total: number
  status: string
  transactionTime: string
  items: any[]
}

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const ORDERS_PER_PAGE = 10

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<OrderData[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [error, setError] = useState('')
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {}

    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.top = '-1000px'
      textarea.style.left = '-1000px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }

  const showCopyToast = (message: string) => {
    const toast = document.createElement('div')
    toast.textContent = message
    toast.className = 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg'
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.remove()
    }, 1500)
  }

  const splitNotes = (notes?: string) => {
    if (!notes) return []
    return String(notes)
      .split(/\r?\n|\|\|/)
      .map((n) => n.trim())
      .filter(Boolean)
  }

  const buildOrderCopyText = (order: OrderData) => {
    let text = `═══════════════════════════════════════\n`
    text += `       DETAIL PEMBELIAN\n`
    text += `═══════════════════════════════════════\n\n`
    text += `Order ID: ${order.orderId}\n`
    text += `Nama: ${order.customerName || '-'}\n`
    text += `Email: ${order.customerEmail || '-'}\n`
    text += `Telepon: ${order.customerPhone || '-'}\n`
    text += `Tanggal: ${formatDate(order.transactionTime)}\n\n`
    text += `═══════════════════════════════════════\n`
    text += `       ITEM YANG DIBELI\n`
    text += `═══════════════════════════════════════\n\n`

    ;(order.items || []).forEach((item: any) => {
      text += `${item.product_name || item.name}\n`
      text += `   Kode: ${item.product_code || item.id || '-'}\n`
      text += `   Quantity: ${item.quantity}x @ ${formatPrice(item.price || 0)}\n\n`

      const itemData = String(item.item_data || '')
        .split(/\r?\n|\|\|/)
        .map((d: string) => d.trim())
        .filter(Boolean)

      if (itemData.length > 0) {
        text += `   Detail Item:\n`
        itemData.forEach((data: string, idx: number) => {
          text += `   ${idx + 1}. ${data}\n`
        })
        text += `\n`
      }

      const notes = splitNotes(item.product_notes || item.notes)
      if (notes.length > 0) {
        text += `   Ketentuan Produk:\n`
        notes.forEach((note: string) => {
          text += `   - ${note}\n`
        })
        text += `\n`
      }

      text += `───────────────────────────────────────\n\n`
    })

    text += `═══════════════════════════════════════\n`
    text += `TOTAL PEMBAYARAN: ${formatPrice(order.total || 0)}\n`
    text += `═══════════════════════════════════════\n`

    return text
  }

  // Fetch orders from database
  const fetchOrders = async (page: number = 1) => {
    setLoadingOrders(true)
    setError('')
    try {
      const res = await fetch(`/api/auth/orders?page=${page}&limit=${ORDERS_PER_PAGE}`, { credentials: 'include' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Gagal mengambil riwayat pesanan')
        setOrders([])
        setPagination(null)
        return
      }

      setOrders(data.orders || [])
      setPagination(data.pagination || null)
    } catch (err: any) {
      setError('Terjadi kesalahan saat mengambil data')
      setOrders([])
      setPagination(null)
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchOrders(currentPage)
    }
  }, [user, currentPage])

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      completed: { bg: 'bg-green-50', text: 'text-green-700', label: '✓ Selesai' },
      pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: '⧗ Menunggu' },
      failed: { bg: 'bg-red-50', text: 'text-red-700', label: '✗ Gagal' },
      expired: { bg: 'bg-gray-50', text: 'text-gray-700', label: '⧗ Expired' },
      cancelled: { bg: 'bg-gray-50', text: 'text-gray-700', label: '✗ Dibatalkan' },
    }
    const s = statusMap[status] || { bg: 'bg-gray-50', text: 'text-gray-700', label: status }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    )
  }

  // Build page numbers array for pagination UI
  const getPageNumbers = (): (number | '...')[] => {
    if (!pagination) return []
    const { page, totalPages } = pagination
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | '...')[] = []

    // Always show first page
    pages.push(1)

    if (page > 3) {
      pages.push('...')
    }

    // Pages around current
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (page < totalPages - 2) {
      pages.push('...')
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages
  }

  const OrderCard = ({ order }: { order: OrderData }) => {
    const isExpanded = expandedOrders.has(order.orderId || order.id)
    const itemCount = (order.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)

    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 mb-3 overflow-hidden transition-shadow hover:shadow-lg">
        {/* Collapsed Header — always visible, clickable */}
        <button
          type="button"
          onClick={() => toggleOrder(order.orderId || order.id)}
          className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50/60 transition-colors"
        >
          {/* Chevron */}
          <i className={`fa-solid fa-chevron-right text-gray-400 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}></i>

          {/* Order ID + date */}
          <div className="flex-1 min-w-0">
            <p className="font-mono font-bold text-sm text-primary-600 truncate">{order.orderId}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.transactionTime)}</p>
          </div>

          {/* Right side: total + status */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {getStatusBadge(order.status)}
            <span className="text-sm font-bold text-[#1c2340]">{formatPrice(order.total)}</span>
          </div>
        </button>

        {/* Expanded Detail */}
        {isExpanded && (
          <div className="border-t border-gray-200 px-4 pb-4 pt-3 animate-fadeIn">
            {/* Action bar */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500">{itemCount} item</span>
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  const text = buildOrderCopyText(order)
                  const ok = await copyToClipboard(text)
                  showCopyToast(ok ? 'Tersalin' : 'Gagal menyalin')
                }}
                className="bg-green-100 hover:bg-green-200 text-green-700 px-2.5 py-1 rounded text-[10px] font-semibold transition-colors border border-green-300"
                title="Copy semua data pesanan"
              >
                Copy Semua
              </button>
            </div>

            {/* Customer info */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm space-y-1">
              <p className="text-gray-700">
                <span className="text-gray-500">Nama:</span> {order.customerName}
              </p>
              <p className="text-gray-700">
                <span className="text-gray-500">Email:</span> {order.customerEmail}
              </p>
              <p className="text-gray-700">
                <span className="text-gray-500">Telepon:</span> {order.customerPhone}
              </p>
            </div>

            {/* Items */}
            {order.items && order.items.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">Item Pembelian:</p>
                <div className="space-y-2">
                  {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      <p className="font-medium text-gray-800">
                        {item.product_name || item.name} <span className="text-gray-500 font-normal">(x{item.quantity})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatPrice(item.price)} x {item.quantity} = {formatPrice(item.price * item.quantity)}</p>

                      {String(item.item_data || '').trim() && (
                        <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-xs font-semibold text-green-800">Detail Item</p>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                const text = String(item.item_data)
                                  .split(/\r?\n|\|\|/)
                                  .map((d: string) => d.trim())
                                  .filter(Boolean)
                                  .join('\n')
                                const ok = await copyToClipboard(text)
                                showCopyToast(ok ? 'Tersalin' : 'Gagal menyalin')
                              }}
                              className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-[10px] font-semibold transition-colors border border-green-300"
                              title="Copy item data"
                            >
                              Copy
                            </button>
                          </div>
                          <ul className="ml-4 list-disc text-xs text-green-900 space-y-0.5 font-mono">
                            {String(item.item_data)
                              .split(/\r?\n|\|\|/)
                              .map((d: string) => d.trim())
                              .filter(Boolean)
                              .map((data: string, dataIdx: number) => (
                                <li key={dataIdx}>{data}</li>
                              ))}
                          </ul>
                        </div>
                      )}

                      {splitNotes(item.product_notes || item.notes).length > 0 && (
                        <ul className="mt-2 ml-4 list-disc text-xs text-gray-500 space-y-0.5">
                          {splitNotes(item.product_notes || item.notes).map((note: string, noteIdx: number) => (
                            <li key={noteIdx}>{note}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total footer */}
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-700">Total:</span>
              <span className="text-lg font-bold text-primary-600">{formatPrice(order.total)}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  const PaginationBar = () => {
    if (!pagination || pagination.totalPages <= 1) return null

    const pageNumbers = getPageNumbers()

    return (
      <div className="mt-6 mb-2">
        {/* Info text */}
        <p className="text-xs text-gray-500 text-center mb-3">
          Halaman {pagination.page} dari {pagination.totalPages} &middot; Total {pagination.totalCount} pesanan
        </p>

        {/* Pagination controls */}
        <div className="flex items-center justify-center gap-1.5">
          {/* Prev button */}
          <button
            onClick={() => goToPage(pagination.page - 1)}
            disabled={!pagination.hasPrev || loadingOrders}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-[#f2f3ff] hover:border-[#5c63f2] hover:text-[#5c63f2] transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 disabled:hover:text-gray-600"
            aria-label="Halaman sebelumnya"
          >
            <i className="fa-solid fa-chevron-left text-xs"></i>
          </button>

          {/* Page numbers */}
          {pageNumbers.map((p, idx) =>
            p === '...' ? (
              <span key={`dots-${idx}`} className="h-9 w-9 flex items-center justify-center text-gray-400 text-sm select-none">
                &hellip;
              </span>
            ) : (
              <button
                key={p}
                onClick={() => goToPage(p)}
                disabled={loadingOrders}
                className={`h-9 min-w-[36px] px-2 flex items-center justify-center rounded-lg text-sm font-semibold transition-all disabled:cursor-not-allowed ${
                  p === pagination.page
                    ? 'bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white shadow-md shadow-[#5c63f2]/20'
                    : 'border border-gray-300 text-gray-700 hover:bg-[#f2f3ff] hover:border-[#5c63f2] hover:text-[#5c63f2]'
                }`}
              >
                {p}
              </button>
            )
          )}

          {/* Next button */}
          <button
            onClick={() => goToPage(pagination.page + 1)}
            disabled={!pagination.hasNext || loadingOrders}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-[#f2f3ff] hover:border-[#5c63f2] hover:text-[#5c63f2] transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300 disabled:hover:text-gray-600"
            aria-label="Halaman berikutnya"
          >
            <i className="fa-solid fa-chevron-right text-xs"></i>
          </button>
        </div>
      </div>
    )
  }

  // Loading auth state
  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin h-10 w-10 border-3 border-[#5c63f2] border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500 text-sm">Memuat...</p>
        </div>
      </div>
    )
  }

  // Not logged in - show login prompt
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8">Riwayat Pembelian</h1>

        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#f2f3ff] to-[#ecebff] rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-lock text-[#5c63f2] text-3xl"></i>
          </div>
          <h2 className="text-xl font-bold text-[#1c2340] mb-2">Login Diperlukan</h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Untuk melihat riwayat pesanan, Anda harus login terlebih dahulu. 
            Riwayat pesanan disimpan di database dan bisa diakses dari perangkat mana saja.
          </p>

          <div className="space-y-3 max-w-xs mx-auto">
            <Link
              href="/login"
              className="block w-full bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-[#5c63f2]/25 transition-all text-center"
            >
              <i className="fa-solid fa-right-to-bracket mr-2"></i>
              Masuk
            </Link>
            <Link
              href="/register"
              className="block w-full bg-white border-2 border-[#5c63f2] text-[#5c63f2] py-3 rounded-xl font-semibold hover:bg-[#f2f3ff] transition-all text-center"
            >
              <i className="fa-solid fa-user-plus mr-2"></i>
              Daftar Akun
            </Link>
          </div>

          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3 text-left max-w-sm mx-auto">
            <div className="flex items-start gap-2">
              <i className="fa-solid fa-circle-info text-amber-500 mt-0.5"></i>
              <p className="text-xs text-amber-700">
                Anda tetap bisa berbelanja tanpa akun. Akun hanya diperlukan untuk melihat riwayat pesanan.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Logged in - show orders from database
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Riwayat Pembelian</h1>
        <button
          onClick={() => fetchOrders(currentPage)}
          disabled={loadingOrders}
          className="text-sm bg-[#f2f3ff] hover:bg-[#e8e9ff] text-[#5c63f2] px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50"
        >
          <i className={`fa-solid fa-arrows-rotate ${loadingOrders ? 'animate-spin' : ''} mr-1.5`}></i>
          Refresh
        </button>
      </div>

      {/* User info banner */}
      <div className="bg-gradient-to-r from-[#f2f3ff] to-[#ecebff] rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-[#5c63f2] rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold">{user.nama.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-[#1c2340] truncate">{user.nama}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 flex items-start gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5"></i>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loadingOrders && (
        <div className="text-center py-12">
          <div className="animate-spin h-10 w-10 border-3 border-[#5c63f2] border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500 text-sm">Memuat riwayat pesanan...</p>
        </div>
      )}

      {/* Orders List */}
      {!loadingOrders && orders.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Menampilkan {orders.length} dari {pagination?.totalCount || orders.length} pesanan
          </p>
          {orders.map((order) => (
            <OrderCard key={order.id || order.orderId} order={order} />
          ))}

          {/* Pagination */}
          <PaginationBar />
        </div>
      )}

      {/* Empty State */}
      {!loadingOrders && !error && orders.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="text-4xl text-gray-300 mb-3">
            <i className="fa-solid fa-inbox"></i>
          </div>
          <p className="text-gray-600 mb-4">Belum ada riwayat pembelian</p>
          <p className="text-sm text-gray-500 mb-6">
            Pesanan Anda akan muncul di sini setelah checkout
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
          >
            Mulai Belanja
          </Link>
        </div>
      )}
    </div>
  )
}
