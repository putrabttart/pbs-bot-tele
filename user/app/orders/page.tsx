'use client'

import { useState } from 'react'
import Link from 'next/link'

interface StoredOrder {
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

interface SearchResult {
  found: boolean
  orders: any[]
  error?: string
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<'local' | 'search'>('local')
  const [storedOrders, setStoredOrders] = useState<StoredOrder[]>([])
  const [searchEmail, setSearchEmail] = useState('')
  const [searchOrderId, setSearchOrderId] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadedLocal, setLoadedLocal] = useState(false)

  // Load stored orders on tab change
  const handleLocalTabClick = () => {
    if (!loadedLocal) {
      const stored = localStorage.getItem('purchaseHistory')
      if (stored) {
        try {
          const orders = JSON.parse(stored)
          setStoredOrders(Array.isArray(orders) ? orders : [orders])
        } catch (e) {
          setStoredOrders([])
        }
      }
      setLoadedLocal(true)
    }
    setActiveTab('local')
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchEmail.trim() || !searchOrderId.trim()) {
      alert('Masukkan email dan ID pesanan')
      return
    }

    setSearching(true)
    try {
      const response = await fetch('/api/orders/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: searchEmail, orderId: searchOrderId }),
      })

      const data = await response.json()
      setSearchResults(data)

      if (!data.found) {
        alert('Pesanan tidak ditemukan. Periksa kembali email dan ID pesanan.')
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults({ found: false, orders: [], error: 'Terjadi kesalahan saat mencari' })
    } finally {
      setSearching(false)
    }
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
    }
    const s = statusMap[status] || { bg: 'bg-gray-50', text: 'text-gray-700', label: status }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    )
  }

  const OrderCard = ({ order }: { order: any }) => (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-sm text-gray-600">ID Pesanan</p>
          <p className="font-mono font-bold text-primary-600">{order.orderId}</p>
        </div>
        {getStatusBadge(order.status)}
      </div>

      <div className="border-t pt-3 mb-3 text-sm">
        <p className="text-gray-700 mb-1">
          <span className="text-gray-500">Email:</span> {order.customerEmail}
        </p>
        <p className="text-gray-700 mb-1">
          <span className="text-gray-500">Nama:</span> {order.customerName}
        </p>
        <p className="text-gray-700 mb-1">
          <span className="text-gray-500">Waktu:</span> {formatDate(order.transactionTime)}
        </p>
      </div>

      {order.items && order.items.length > 0 && (
        <div className="border-t pt-3 mb-3">
          <p className="text-sm font-semibold text-gray-700 mb-2">Item Pembelian:</p>
          <div className="space-y-1">
            {order.items.map((item: any, idx: number) => (
              <p key={idx} className="text-sm text-gray-600">
                {item.product_name} (x{item.quantity}) - {formatPrice(item.price * item.quantity)}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="border-t pt-3 flex justify-between items-center">
        <span className="font-semibold text-gray-700">Total:</span>
        <span className="text-lg font-bold text-primary-600">{formatPrice(order.total)}</span>
      </div>
    </div>
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Riwayat Pembelian</h1>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8 border-b">
        <button
          onClick={handleLocalTabClick}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'local'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <i className="fa-solid fa-clock-rotate-left mr-2"></i>
          Pembelian Saya
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'search'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <i className="fa-solid fa-magnifying-glass mr-2"></i>
          Cari Pesanan
        </button>
      </div>

      {/* Local Orders Tab */}
      {activeTab === 'local' && (
        <div>
          {storedOrders.length > 0 ? (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Menampilkan {storedOrders.length} pesanan dari device ini
              </p>
              {storedOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-4xl text-gray-300 mb-3">
                <i className="fa-solid fa-inbox"></i>
              </div>
              <p className="text-gray-600 mb-4">Belum ada riwayat pembelian di device ini</p>
              <p className="text-sm text-gray-500 mb-6">
                Pembelian Anda akan muncul di sini setelah checkout
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
      )}

      {/* Search Orders Tab */}
      {activeTab === 'search' && (
        <div>
          <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Cari Pesanan Anda</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Pembelian
                </label>
                <input
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="contoh@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Pesanan
                </label>
                <input
                  type="text"
                  value={searchOrderId}
                  onChange={(e) => setSearchOrderId(e.target.value)}
                  placeholder="ORD-XXX-XXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  ID pesanan dikirimkan ke email Anda setelah checkout
                </p>
              </div>

              <button
                type="submit"
                disabled={searching}
                className="w-full bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {searching ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                    Mencari...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-search mr-2"></i>
                    Cari Pesanan
                  </>
                )}
              </button>
            </div>
          </form>

          {searchResults && (
            <div>
              {searchResults.found && searchResults.orders.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Ditemukan {searchResults.orders.length} pesanan
                  </p>
                  {searchResults.orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-4xl text-gray-300 mb-3">
                    <i className="fa-solid fa-magnifying-glass"></i>
                  </div>
                  <p className="text-gray-600">
                    {searchResults.error ? searchResults.error : 'Pesanan tidak ditemukan'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Pastikan email dan ID pesanan sudah benar
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
