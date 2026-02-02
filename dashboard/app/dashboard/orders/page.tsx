'use client'

import { useEffect, useState, Fragment, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiSearch, FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight } from 'react-icons/fi'

type Order = {
  id: string
  order_id: string
  user_id: string | null
  status: string
  total_amount: number
  created_at: string
  // Web store fields (OPSI B)
  transaction_id?: string | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  payment_method?: string | null
  items?: any[] | null
}

type OrderItem = {
  id: string
  order_id: string
  product_id: string
  product_code: string
  product_name: string
  quantity: number
  price: number
  item_data: string | null
}

type Product = {
  id: string
  kode: string
  nama: string
}

export default function OrdersPage() {
  const supabase = createBrowserClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilterType, setDateFilterType] = useState<'all' | 'date' | 'month' | 'year'>('all')
  const [dateValue, setDateValue] = useState('')
  const [monthValue, setMonthValue] = useState('')
  const [yearValue, setYearValue] = useState('')
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({})
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, dateFilterType, dateValue, monthValue, yearValue])

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])

      // Fetch order items from order_items table (bot orders)
      const orderUUIDs = (data || []).map((o: any) => o.id)
      if (orderUUIDs.length > 0) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderUUIDs)

        if (!itemsErr && itemsData && itemsData.length > 0) {
          // Map items by order UUID
          const itemsByOrder: Record<string, OrderItem[]> = {}
          itemsData.forEach((item: any) => {
            if (!itemsByOrder[item.order_id]) {
              itemsByOrder[item.order_id] = []
            }
            itemsByOrder[item.order_id].push(item)
          })
          setOrderItems(itemsByOrder)
        }
      }

      // Web store orders already have items in orders.items (JSONB)
      // No need to fetch separately - they're included in the order data
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'paid':
        return 'bg-blue-100 text-blue-800'
      case 'shipped':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        String(order.order_id || '').toLowerCase().includes(searchLower) ||
        String(order.user_id || '').toLowerCase().includes(searchLower) ||
        String(order.customer_phone || '').toLowerCase().includes(searchLower)

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter

      const created = new Date(order.created_at)
      let matchesDate = true

      if (dateFilterType === 'date' && dateValue) {
        const target = new Date(dateValue)
        matchesDate =
          created.getFullYear() === target.getFullYear() &&
          created.getMonth() === target.getMonth() &&
          created.getDate() === target.getDate()
      }

      if (dateFilterType === 'month' && monthValue) {
        const [y, m] = monthValue.split('-').map(Number)
        matchesDate = created.getFullYear() === y && created.getMonth() + 1 === m
      }

      if (dateFilterType === 'year' && yearValue) {
        matchesDate = created.getFullYear() === Number(yearValue)
      }

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [orders, searchQuery, statusFilter, dateFilterType, dateValue, monthValue, yearValue])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredOrders.slice(start, start + pageSize)
  }, [filteredOrders, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, Math.max(1, totalPages)))
  }, [totalPages])

  const handleCopyItemData = async (text: string) => {
    try {
      setCopyError(null)
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      setTimeout(() => setCopiedText(null), 1500)
    } catch (error) {
      console.error('Failed to copy item data:', error)
      setCopyError('Copy failed')
      setTimeout(() => setCopyError(null), 2000)
    }
  }

  const stats = {
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => o.status === 'pending').length,
    paid: filteredOrders.filter(o => o.status === 'paid').length,
    completed: filteredOrders.filter(o => o.status === 'completed').length,
    revenue: filteredOrders
      .filter(o => o.status === 'paid' || o.status === 'completed')
      .reduce((sum, o) => sum + (o.total_amount as any || 0), 0),
  }

  const getItemCount = (orderUUID: string) => {
    // Check order_items first (bot orders)
    const botItems = orderItems[orderUUID]?.length || 0
    if (botItems > 0) return botItems

    // Check orders.items JSONB (web store orders - OPSI B)
    const order = orders.find(o => o.id === orderUUID)
    if (order && order.items && Array.isArray(order.items)) {
      return order.items.length
    }

    return 0
  }

  const getOrderItemDetails = (orderUUID: string) => {
    const items = orderItems[orderUUID] || []
    
    // If we have items from order_items table (bot orders)
    if (items.length > 0) {
      // Group items by product
      const groupedByProduct = items.reduce((acc, item) => {
        const key = item.product_code || item.product_name
        if (!acc[key]) {
          acc[key] = {
            productName: item.product_name,
            productCode: item.product_code,
            items: [],
            totalPrice: 0,
            totalQty: 0
          }
        }
        
        // Extract actual item data from JSON
        if (item.item_data) {
          try {
            const parsed = JSON.parse(item.item_data)
            
            // If it's an array, loop and extract item_data field
            if (Array.isArray(parsed)) {
              parsed.forEach((obj: any) => {
                if (obj && typeof obj === 'object' && obj.item_data) {
                  acc[key].items.push(obj.item_data)
                } else if (typeof obj === 'string') {
                  acc[key].items.push(obj)
                }
              })
            } 
            // If it's a single object with item_data
            else if (parsed && typeof parsed === 'object' && parsed.item_data) {
              acc[key].items.push(parsed.item_data)
            }
            // If it's a plain string
            else if (typeof parsed === 'string') {
              acc[key].items.push(parsed)
            }
            // Fallback: use original if nothing matched
            else if (acc[key].items.length === 0) {
              acc[key].items.push(item.item_data)
            }
          } catch (e) {
            // Not JSON, use as plain text
            acc[key].items.push(item.item_data)
          }
        }
        
        acc[key].totalPrice += item.price || 0
        acc[key].totalQty += item.quantity || 1
        
        return acc
      }, {} as Record<string, any>)
      
      // Convert to array
      return Object.values(groupedByProduct).map((group: any) => ({
        productName: group.productName,
        productCode: group.productCode,
        itemData: group.items.join('\n'),
        itemCount: group.items.length,
        quantity: group.totalQty,
        price: group.totalPrice
      }))
    }

    // If no order_items, check orders.items JSONB (web store orders - OPSI B)
    const order = orders.find(o => o.id === orderUUID)
    if (order && order.items && Array.isArray(order.items)) {
      return order.items.map((item: any) => ({
        productName: item.product_name || item.name || '-',
        productCode: item.product_code || item.code || item.product_id || '-',
        itemData: 'Menunggu diproses oleh admin',
        itemCount: 1,
        quantity: item.quantity || 1,
        price: item.price || 0
      }))
    }

    return []
  }

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-xl md:text-2xl font-bold text-gray-900">Orders</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <p className="text-gray-600 text-xs md:text-sm font-medium">Total Orders</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4 md:p-6 border border-yellow-200">
          <p className="text-yellow-700 text-xs md:text-sm font-medium">Pending</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-yellow-600 mt-1 md:mt-2">{stats.pending}</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 md:p-6 border border-green-200">
          <p className="text-green-700 text-xs md:text-sm font-medium">Completed</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold text-green-600 mt-1 md:mt-2">{stats.completed}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4 md:p-6 border border-blue-200">
          <p className="text-blue-700 text-xs md:text-sm font-medium">Revenue</p>
          <p className="text-lg md:text-xl lg:text-2xl font-bold text-blue-600 mt-1 md:mt-2">
            Rp {stats.revenue.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="flex-1">
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order number or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="shipped">Shipped</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={dateFilterType}
          onChange={(e) => {
            const value = e.target.value as 'all' | 'date' | 'month' | 'year'
            setDateFilterType(value)
            if (value !== 'date') setDateValue('')
            if (value !== 'month') setMonthValue('')
            if (value !== 'year') setYearValue('')
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Dates</option>
          <option value="date">Filter by Date</option>
          <option value="month">Filter by Month</option>
          <option value="year">Filter by Year</option>
        </select>
        {dateFilterType === 'date' && (
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
        {dateFilterType === 'month' && (
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
        {dateFilterType === 'year' && (
          <select
            value={yearValue}
            onChange={(e) => setYearValue(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Year</option>
            {Array.from(new Set(orders.map(o => new Date(o.created_at).getFullYear())))
              .sort((a, b) => b - a)
              .map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
          </select>
        )}
      </div>

      {/* Pagination */}
      {filteredOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-800">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700">Per page</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                {[10, 20, 30, 40, 50].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 disabled:text-gray-400 disabled:opacity-60"
            >
              <FiChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 disabled:text-gray-400 disabled:opacity-60"
            >
              Next <FiChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {orders.length === 0 ? 'No orders yet' : 'No orders match your search'}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 w-12"></th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Order ID</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">User ID/Nomor HP</th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-900">Total (IDR)</th>
                    <th className="text-center px-6 py-3 font-semibold text-gray-900">Items</th>
                    <th className="text-center px-6 py-3 font-semibold text-gray-900">Status</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedOrders.map((order) => (
                    <Fragment key={order.order_id}>
                      <tr className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setExpandedOrderId(expandedOrderId === order.order_id ? null : order.order_id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            {expandedOrderId === order.order_id ? (
                              <FiChevronUp className="text-gray-600" />
                            ) : (
                              <FiChevronDown className="text-gray-600" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-3">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {order.order_id}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {order.user_id}
                          {order.customer_phone && (
                            <div className="text-l text-gray-600 mt-1">
                              {order.customer_phone}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="font-semibold text-gray-900">
                            Rp {Number(order.total_amount || 0).toLocaleString('id-ID')}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className="inline-block bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">
                            {getItemCount(order.id)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">
                          {new Date(order.created_at).toLocaleDateString('id-ID')} • {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {expandedOrderId === order.order_id && (
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-gray-900">Purchased Items</h4>
                              {(order.customer_name || order.customer_email || order.customer_phone) && (
                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                  <h5 className="text-sm font-semibold text-gray-900 mb-2">Customer Info</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    <div>
                                      <p className="text-xs text-gray-500">Name</p>
                                      <p className="text-gray-900">{order.customer_name || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Email</p>
                                      <p className="text-gray-900">{order.customer_email || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Phone</p>
                                      <p className="text-gray-900">{order.customer_phone || '-'}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div className="bg-white border border-gray-200 rounded-lg p-4">
                                {getOrderItemDetails(order.id).length > 0 ? (
                                  <div className="space-y-4">
                                    {getOrderItemDetails(order.id).map((item, idx) => (
                                      <div key={idx} className={`pb-4 ${idx !== getOrderItemDetails(order.id).length - 1 ? 'border-b border-gray-200' : ''}`}>
                                        <div className="space-y-2">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <p className="text-gray-900 font-semibold">{item.productName}</p>
                                              <p className="text-gray-600 text-xs">Code: {item.productCode}</p>
                                            </div>
                                            <p className="text-gray-900 font-semibold">Rp {item.price.toLocaleString('id-ID')}</p>
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-2 mb-1">
                                              <p className="text-gray-500 text-xs font-medium">Item Data</p>
                                              <button
                                                onClick={() => handleCopyItemData(item.itemData)}
                                                className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                                                  copiedText === item.itemData
                                                    ? 'bg-green-50 text-green-700 border-green-200'
                                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                                }`}
                                              >
                                                {copiedText === item.itemData ? 'Copied' : 'Copy'}
                                              </button>
                                              {copyError && (
                                                <span className="text-xs text-red-600">{copyError}</span>
                                              )}
                                            </div>
                                            <code className="text-xs bg-gray-50 px-3 py-2 rounded block break-all text-gray-700 whitespace-pre-wrap border border-gray-200">
                                              {item.itemData}
                                            </code>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    <div className="pt-3 border-t-2 border-gray-300 flex justify-between items-center">
                                      <span className="text-base font-semibold text-gray-700">Total</span>
                                      <span className="text-lg font-bold text-indigo-600">
                                        Rp {Number(order.total_amount || 0).toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 text-sm">No items</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {paginatedOrders.map((order) => (
                <div key={order.order_id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-mono text-sm font-medium text-gray-900">{order.order_id}</p>
                      <p className="text-xs text-gray-500 mt-1">{order.user_id}</p>
                    </div>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                    <div>
                      <span className="text-gray-500 text-xs">Total:</span>
                      <p className="text-gray-900 font-semibold">Rp {Number(order.total_amount || 0).toLocaleString('id-ID')}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Items:</span>
                      <p className="text-gray-700 font-medium">{getItemCount(order.id)}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-500 text-xs">Date:</span>
                    <p className="text-gray-600 text-sm">
                      {new Date(order.created_at).toLocaleDateString('id-ID')} • {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                  </div>

                  {/* Mobile Expandable Details */}
                  <button
                    onClick={() => setExpandedOrderId(expandedOrderId === order.order_id ? null : order.order_id)}
                    className="mt-3 w-full py-2 text-center border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {expandedOrderId === order.order_id ? (
                      <>
                        <FiChevronUp size={16} /> Hide Details
                      </>
                    ) : (
                      <>
                        <FiChevronDown size={16} /> Show Details
                      </>
                    )}
                  </button>

                  {expandedOrderId === order.order_id && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      <h4 className="font-semibold text-gray-900 text-sm mb-3">Purchased Items</h4>
                      {(order.customer_name || order.customer_email || order.customer_phone) && (
                        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
                          <h5 className="text-xs font-semibold text-gray-900 mb-2">Customer Info</h5>
                          <div className="grid grid-cols-1 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Name:</span>
                              <span className="text-gray-900 ml-1">{order.customer_name || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Email:</span>
                              <span className="text-gray-900 ml-1">{order.customer_email || '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Phone:</span>
                              <span className="text-gray-900 ml-1">{order.customer_phone || '-'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        {getOrderItemDetails(order.id).length > 0 ? (
                          <div className="space-y-3">
                            {getOrderItemDetails(order.id).map((item, idx) => (
                              <div key={idx} className={`pb-3 ${idx !== getOrderItemDetails(order.id).length - 1 ? 'border-b border-gray-300' : ''}`}>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <p className="text-gray-900 font-semibold text-sm">{item.productName}</p>
                                      <p className="text-gray-600 text-xs">Code: {item.productCode}</p>
                                    </div>
                                    <p className="text-gray-900 font-semibold text-xs ml-2">Rp {item.price.toLocaleString('id-ID')}</p>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-gray-500 text-xs font-medium">Item Data</p>
                                      <button
                                        onClick={() => handleCopyItemData(item.itemData)}
                                        className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                                          copiedText === item.itemData
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                        }`}
                                      >
                                        {copiedText === item.itemData ? 'Copied' : 'Copy'}
                                      </button>
                                      {copyError && (
                                        <span className="text-xs text-red-600">{copyError}</span>
                                      )}
                                    </div>
                                    <code className="text-xs bg-white px-2 py-2 rounded block break-all text-gray-700 border border-gray-300 whitespace-pre-wrap">
                                      {item.itemData}
                                    </code>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="pt-3 border-t-2 border-gray-400 flex justify-between items-center">
                              <span className="text-sm font-semibold text-gray-700">Total</span>
                              <span className="text-base font-bold text-indigo-600">
                                Rp {Number(order.total_amount || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">No items</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
