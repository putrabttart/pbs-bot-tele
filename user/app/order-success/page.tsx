'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface OrderItem {
  product_id: string
  product_name: string
  product_code: string
  quantity: number
  price: number
  total: number
  item_data?: string
}

interface OrderDetails {
  orderId: string
  transactionId: string
  amount: number
  status: string
  items: OrderItem[]
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  transactionTime?: string
}

export default function OrderSuccess() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchControllerRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)

  const normalizeStatus = (status?: string) => {
    if (!status) return 'pending'
    const s = status.toLowerCase()
    if (['completed', 'success', 'settlement', 'capture'].includes(s)) return 'completed'
    if (['pending', 'pending_payment', 'waiting_payment'].includes(s)) return 'pending'
    if (['processing'].includes(s)) return 'processing'
    if (['expire', 'expired', 'cancel', 'denied', 'deny', 'failed', 'failure'].includes(s)) return 'failed'
    return status
  }

  const fetchOrderDetails = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true)
      setError(null)
      console.log('Fetching order details for:', orderId)
      // Cancel any previous request to avoid overlap during auto refresh
      if (fetchControllerRef.current) {
        try { fetchControllerRef.current.abort() } catch {}
      }
      const controller = new AbortController()
      fetchControllerRef.current = controller
      inFlightRef.current = true

      const response = await fetch(`/api/orders/${orderId}` , { signal: controller.signal })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch order details')
      }

      const rawStatus = data.status || data.transaction?.transaction_status
      const normalizedStatus = normalizeStatus(rawStatus)

      const orderData: OrderDetails = {
        orderId: data.orderId,
        transactionId: data.transactionId,
        amount: Number(data.amount),
        status: normalizedStatus,
        items: data.items || data.transaction?.item_details || [],
        customerName: data.customerName || data.transaction?.customer_details?.first_name || 'Customer',
        customerEmail: data.customerEmail || data.transaction?.customer_details?.email || '',
        customerPhone: data.customerPhone || data.transaction?.customer_details?.phone || '',
        transactionTime: data.transactionTime,
      }

      setOrderDetails(orderData)
      
      // Track processing time - if > 15s, show error
      if (normalizedStatus === 'processing') {
        const processingTime = (window as any).__processingStartTime || Date.now()
        if (!( window as any).__processingStartTime) {
          (window as any).__processingStartTime = processingTime
        }
        const elapsedSeconds = (Date.now() - processingTime) / 1000
        
        if (elapsedSeconds > 15) {
          console.warn(`⚠️ Processing timeout after ${Math.round(elapsedSeconds)}s`)
          setError('Proses mempersiapkan item terlalu lama. Coba refresh halaman atau hubungi support.')
          delete (window as any).__processingStartTime
        }
      } else {
        // Clear processing timer if not processing anymore
        delete (window as any).__processingStartTime
      }

      // Clear retry counter when data is complete
      if (normalizedStatus === 'completed' && (orderData.items || []).some((i: any) => !!i.item_data)) {
        delete (window as any).__orderRetryCount
        console.log('✅ Order completed with items ready')
      } else if (normalizedStatus === 'processing' || normalizedStatus === 'completed') {
        // Keep polling if processing or completed but items not ready
        console.log(`⏳ Status: ${normalizedStatus}, items ready: ${(orderData.items || []).some((i: any) => !!i.item_data)}`)
      }

      // Save to localStorage for offline access
      try {
        const existing = localStorage.getItem('purchaseHistory')
        const history = existing ? JSON.parse(existing) : []
        const historyArray = Array.isArray(history) ? history : [history]
        
        const newOrder = {
          id: orderData.orderId,
          orderId: orderData.orderId,
          transactionId: orderData.transactionId,
          customerEmail: orderData.customerEmail,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          total: orderData.amount,
          status: orderData.status,
          transactionTime: orderData.transactionTime,
          items: orderData.items,
        }

        // Add new order to beginning of history
        const updated = [newOrder, ...historyArray]
        localStorage.setItem('purchaseHistory', JSON.stringify(updated))
      } catch (e) {
        console.warn('Failed to save to localStorage:', e)
      }
    } catch (err: any) {
      // Ignore abort errors triggered by our AbortController
      if (err?.name === 'AbortError') {
        console.debug('Fetch aborted intentionally (refresh guard)')
        return
      }
      console.error('Error fetching order details:', err)
      setError(err.message || 'Failed to fetch order details')
      setOrderDetails(prev => prev || {
        orderId: orderId || '',
        transactionId: '',
        amount: 0,
        status: 'pending',
        items: [],
      })
    } finally {
      inFlightRef.current = false
      fetchControllerRef.current = null
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    if (!orderId) {
      router.push('/')
      return
    }
    fetchOrderDetails()
  }, [orderId, router])

  useEffect(() => {
    if (!orderId || !orderDetails) return
    // Keep polling until status is completed AND items have data
    const isComplete = orderDetails.status === 'completed'
    const hasItems = (orderDetails.items || []).some((i: any) => !!i.item_data)
    
    if (isComplete && hasItems) {
      console.log('✅ Order fully complete, stopping poll')
      return
    }

    const interval = setInterval(() => {
      if (inFlightRef.current) return
      fetchOrderDetails(false)
    }, 4000)

    return () => clearInterval(interval)
  }, [orderId, orderDetails?.status, orderDetails?.items])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price)
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleString('id-ID')
    } catch {
      return dateString
    }
  }

  const isCompleted = orderDetails?.status === 'completed'
  const isPending = orderDetails?.status === 'pending'
  const isProcessing = orderDetails?.status === 'processing'
  const hasItems = orderDetails?.items && orderDetails.items.some((i: any) => !!i.item_data)

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat detail pesanan...</p>
        </div>
      </div>
    )
  }
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Success Header */}
        <div className="text-center bg-white rounded-lg shadow-md p-8 mb-6">
          <div className={`w-20 h-20 ${isCompleted ? 'bg-green-100' : isProcessing ? 'bg-blue-50' : 'bg-yellow-50'} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {isProcessing ? (
              <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            ) : (
              <svg
                className={`w-12 h-12 ${isCompleted ? 'text-green-500' : 'text-yellow-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>

          <h1 className={`text-3xl font-bold mb-2 ${isCompleted ? 'text-green-600' : isProcessing ? 'text-blue-600' : 'text-yellow-600'}`}>
            {isCompleted ? 'Pembayaran Berhasil!' : isProcessing ? 'Memproses Pesanan...' : 'Menunggu Pembayaran'}
          </h1>
          <p className="text-gray-600 mb-4">
            {isCompleted
              ? 'Terima kasih telah berbelanja. Pesanan Anda sedang diproses.'
              : isProcessing
              ? 'Pembayaran diterima. Sedang mempersiapkan item pesanan Anda...'
              : 'Pembayaran belum diterima. Halaman akan menyegarkan otomatis saat berhasil.'}
          </p>

          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}
        </div>

        {orderDetails && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Order Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Info Card */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Informasi Pesanan</h2>
                
                <div className="space-y-3 border-b pb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID Pesanan:</span>
                    <span className="font-mono font-bold text-primary-600">{orderDetails.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID Transaksi:</span>
                    <span className="font-mono text-sm font-bold">{orderDetails.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Waktu Transaksi:</span>
                    <span className="text-sm">{formatDateTime(orderDetails.transactionTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                        isCompleted
                          ? 'bg-green-100 text-green-800'
                          : isProcessing
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {isCompleted ? '✓ Pembayaran Diterima' : isProcessing ? '⟳ Memproses...' : '⧗ Menunggu Pembayaran'}
                    </span>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="mt-4">
                  <h3 className="font-semibold mb-3">Data Pembeli</h3>
                  <div className="space-y-2 text-sm bg-gray-50 rounded p-3">
                    <p><span className="text-gray-600">Nama:</span> <span className="font-semibold">{orderDetails.customerName}</span></p>
                    <p><span className="text-gray-600">Email:</span> <span className="font-semibold">{orderDetails.customerEmail}</span></p>
                    <p><span className="text-gray-600">Telepon:</span> <span className="font-semibold">{orderDetails.customerPhone}</span></p>
                  </div>
                </div>
              </div>

              {/* Items Card */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <h2 className="text-xl font-bold text-green-900">Item Pembelian Anda</h2>
                  </div>
                  
                  {/* Copy & Download All Buttons */}
                  {orderDetails.items && orderDetails.items.some((i: any) => i.item_data) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // Collect all item data
                          let allItemsText = `═══════════════════════════════════════\n`
                          allItemsText += `       DETAIL PEMBELIAN\n`
                          allItemsText += `═══════════════════════════════════════\n\n`
                          allItemsText += `Order ID: ${orderDetails.orderId}\n`
                          allItemsText += `Nama: ${orderDetails.customerName}\n`
                          allItemsText += `Email: ${orderDetails.customerEmail}\n`
                          allItemsText += `Tanggal: ${formatDateTime(orderDetails.transactionTime)}\n\n`
                          allItemsText += `═══════════════════════════════════════\n`
                          allItemsText += `       ITEM YANG DIBELI\n`
                          allItemsText += `═══════════════════════════════════════\n\n`
                          
                          orderDetails.items.forEach((item: any, idx: number) => {
                            if (item.item_data) {
                              allItemsText += `📦 ${item.product_name || item.name}\n`
                              allItemsText += `   Kode: ${item.product_code || item.id}\n`
                              allItemsText += `   Quantity: ${item.quantity}x @ ${formatPrice(item.price)}\n\n`
                              
                              const itemDataArray = item.item_data.split('\n').filter(Boolean)
                              itemDataArray.forEach((data: string, dataIdx: number) => {
                                allItemsText += `   Item #${dataIdx + 1}:\n`
                                allItemsText += `   ${data.trim()}\n\n`
                              })
                              allItemsText += `───────────────────────────────────────\n\n`
                            }
                          })
                          
                          allItemsText += `═══════════════════════════════════════\n`
                          allItemsText += `Total Pembayaran: ${formatPrice(orderDetails.amount)}\n`
                          allItemsText += `═══════════════════════════════════════\n`
                          
                          navigator.clipboard.writeText(allItemsText)
                          const btn = document.activeElement as HTMLButtonElement
                          const originalText = btn.innerHTML
                          btn.innerHTML = '✓ Tersalin!'
                          btn.classList.add('bg-green-600', 'text-white')
                          setTimeout(() => {
                            btn.innerHTML = originalText
                            btn.classList.remove('bg-green-600', 'text-white')
                          }, 2000)
                        }}
                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        title="Copy semua item ke clipboard"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Semua
                      </button>
                      
                      <button
                        onClick={() => {
                          // Create downloadable text file
                          let fileContent = `═══════════════════════════════════════\n`
                          fileContent += `       DETAIL PEMBELIAN\n`
                          fileContent += `═══════════════════════════════════════\n\n`
                          fileContent += `Order ID: ${orderDetails.orderId}\n`
                          fileContent += `Transaction ID: ${orderDetails.transactionId}\n`
                          fileContent += `Nama: ${orderDetails.customerName}\n`
                          fileContent += `Email: ${orderDetails.customerEmail}\n`
                          fileContent += `Telepon: ${orderDetails.customerPhone}\n`
                          fileContent += `Tanggal: ${formatDateTime(orderDetails.transactionTime)}\n\n`
                          fileContent += `═══════════════════════════════════════\n`
                          fileContent += `       ITEM YANG DIBELI\n`
                          fileContent += `═══════════════════════════════════════\n\n`
                          
                          orderDetails.items.forEach((item: any, idx: number) => {
                            if (item.item_data) {
                              fileContent += `📦 ${item.product_name || item.name}\n`
                              fileContent += `   Kode Produk: ${item.product_code || item.id}\n`
                              fileContent += `   Quantity: ${item.quantity}x @ ${formatPrice(item.price)}\n`
                              fileContent += `   Total: ${formatPrice(item.price * item.quantity)}\n\n`
                              
                              const itemDataArray = item.item_data.split('\n').filter(Boolean)
                              fileContent += `   Detail Item:\n`
                              itemDataArray.forEach((data: string, dataIdx: number) => {
                                fileContent += `   ${dataIdx + 1}. ${data.trim()}\n`
                              })
                              fileContent += `\n───────────────────────────────────────\n\n`
                            }
                          })
                          
                          fileContent += `═══════════════════════════════════════\n`
                          fileContent += `TOTAL PEMBAYARAN: ${formatPrice(orderDetails.amount)}\n`
                          fileContent += `═══════════════════════════════════════\n\n`
                          fileContent += `⚠️ PENTING: Simpan file ini dengan baik!\n`
                          fileContent += `Ini adalah bukti pembelian Anda.\n`
                          
                          // Create blob and download
                          const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
                          const url = URL.createObjectURL(blob)
                          const link = document.createElement('a')
                          link.href = url
                          link.download = `Order-${orderDetails.orderId}-${new Date().toISOString().split('T')[0]}.txt`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                          URL.revokeObjectURL(url)
                          
                          const btn = document.activeElement as HTMLButtonElement
                          const originalText = btn.innerHTML
                          btn.innerHTML = '✓ Terunduh!'
                          btn.classList.add('bg-blue-600', 'text-white')
                          setTimeout(() => {
                            btn.innerHTML = originalText
                            btn.classList.remove('bg-blue-600', 'text-white')
                          }, 2000)
                        }}
                        className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        title="Download semua item sebagai file .txt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download .txt
                      </button>
                    </div>
                  )}
                </div>
                
                {orderDetails.items && orderDetails.items.length > 0 ? (
                  <div className="space-y-4">
                    {orderDetails.items.map((item: any, index: number) => {
                      // Split item_data by newline to show multiple items
                      const itemDataArray = item.item_data ? item.item_data.split('\n').filter(Boolean) : []
                      const expectedCount = item.quantity || 1
                      
                      return (
                        <div
                          key={index}
                          className="bg-white border-2 border-green-300 rounded-lg p-4 shadow-sm"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <p className="font-bold text-lg text-gray-900">{item.product_name || item.name}</p>
                              <p className="text-sm text-gray-600">
                                Kode Produk: <span className="font-mono font-semibold">{item.product_code || item.id}</span>
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                Quantity: <span className="font-semibold text-green-700">{item.quantity}x</span> @ {formatPrice(item.price)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Total</p>
                              <p className="font-bold text-xl text-green-600">
                                {formatPrice(item.price * item.quantity)}
                              </p>
                            </div>
                          </div>
                          
                          {itemDataArray.length > 0 ? (
                            <div className="mt-3 pt-3 border-t border-green-200">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-semibold text-green-800">
                                  ✓ Item Details ({itemDataArray.length} dari {expectedCount} item)
                                </p>
                                {itemDataArray.length < expectedCount && (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                    ⚠ {expectedCount - itemDataArray.length} item belum tersedia
                                  </span>
                                )}
                              </div>
                              <div className="space-y-2">
                                {itemDataArray.map((data: string, dataIndex: number) => (
                                  <div key={dataIndex} className="bg-green-50 border border-green-300 rounded-lg p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1">
                                        <p className="text-xs text-green-700 font-semibold mb-1">Item #{dataIndex + 1}</p>
                                        <p className="text-sm font-mono text-gray-900 break-all">
                                          {data.trim()}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(data.trim())
                                          // Show toast notification
                                          const btn = document.activeElement as HTMLButtonElement
                                          const originalText = btn.innerHTML
                                          btn.innerHTML = '✓ Copied!'
                                          btn.classList.add('bg-green-600', 'text-white')
                                          setTimeout(() => {
                                            btn.innerHTML = originalText
                                            btn.classList.remove('bg-green-600', 'text-white')
                                          }, 1500)
                                        }}
                                        className="flex-shrink-0 bg-green-100 hover:bg-green-200 text-green-700 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border border-green-300"
                                        title="Copy ke clipboard"
                                      >
                                        📋 Copy
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                                Data item sedang diproses. Silakan tunggu sebentar...
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-600 py-4">Informasi item sedang diproses...</p>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Important Instructions (moved to sidebar) */}
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-900 text-lg mb-1">⚠️ PENTING - SIMPAN DATA INI!</h3>
                    <p className="text-sm text-red-700">Jangan sampai data pembelian Anda hilang</p>
                  </div>
                </div>
                <div className="bg-white border border-red-200 rounded-lg p-4 mb-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-red-600 text-lg flex-shrink-0">1.</span>
                      <div>
                        <p className="font-bold text-gray-900">Simpan Order ID Anda:</p>
                        <div className="mt-1 bg-yellow-50 border border-yellow-300 rounded p-2">
                          <p className="font-mono font-bold text-lg text-center text-primary-600">{orderDetails?.orderId}</p>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Gunakan untuk tracking atau komplain</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-red-600 text-lg flex-shrink-0">2.</span>
                      <div>
                        <p className="font-bold text-gray-900">Screenshot Halaman Ini:</p>
                        <ul className="mt-1 text-sm text-gray-700 space-y-1">
                          <li>• Tekan <kbd className="px-2 py-0.5 bg-gray-200 rounded font-mono text-xs">PrtSc</kbd> atau <kbd className="px-2 py-0.5 bg-gray-200 rounded font-mono text-xs">Win + Shift + S</kbd></li>
                          <li>• Simpan screenshot di folder aman</li>
                          <li>• Backup ke cloud (Google Drive/Dropbox)</li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-red-600 text-lg flex-shrink-0">3.</span>
                      <div>
                        <p className="font-bold text-gray-900">Download Data Item (File .txt):</p>
                        <p className="text-sm text-gray-700 mt-1">Klik tombol <span className="font-semibold text-blue-600">"Download .txt"</span> di atas untuk simpan semua data akun yang Anda beli</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-red-600 text-lg flex-shrink-0">4.</span>
                      <div>
                        <p className="font-bold text-gray-900">Copy & Simpan di Notepad:</p>
                        <p className="text-sm text-gray-700 mt-1">Gunakan tombol <span className="font-semibold text-green-600">"Copy Semua"</span> lalu paste ke aplikasi notes di HP/komputer Anda</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                  <div className="flex gap-2">
                    <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-yellow-800">
                      <p className="font-bold mb-1">Mengapa Harus Disimpan?</p>
                      <ul className="space-y-0.5 text-xs">
                        <li>✓ Data pesanan tidak disimpan di server selamanya</li>
                        <li>✓ Halaman ini bisa tertutup dan sulit diakses lagi</li>
                        <li>✓ Anda butuh data ini untuk login/aktivasi akun</li>
                        <li>✓ Order ID diperlukan jika ada masalah/komplain</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
                  <input 
                    type="checkbox" 
                    id="data-saved-confirmation"
                    className="w-4 h-4 text-green-600"
                  />
                  <label htmlFor="data-saved-confirmation" className="cursor-pointer">
                    Saya sudah menyimpan/screenshot semua data pembelian saya
                  </label>
                </div>
              </div>
              {/* Contact Support */}
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
                <h3 className="font-bold mb-4">Butuh Bantuan?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Jika ada pertanyaan tentang pesanan Anda, hubungi kami melalui WhatsApp.
                </p>
                <a
                  href="https://wa.me/6282340915319?text=Saya ingin bertanya tentang pesanan saya"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors text-center"
                >
                  💬 Chat via WhatsApp
                </a>

                <div className="mt-6 pt-6 border-t space-y-3">
                  <Link
                    href="/"
                    className="block w-full bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-center"
                  >
                    Kembali ke Beranda
                  </Link>
                  <Link
                    href="/"
                    className="block w-full bg-white border-2 border-primary-600 text-primary-600 py-2 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-center"
                  >
                    Lanjut Belanja
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
