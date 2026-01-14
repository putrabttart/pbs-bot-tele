'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiSearch } from 'react-icons/fi'
// Use a runtime-aligned type with current schema
type Order = {
  order_id: string
  user_id: string
  status: string
  total_amount: number
  created_at: string
}

export default function OrdersPage() {
  const supabase = createBrowserClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])

      // Fetch item counts per order
      const orderIds = (data || []).map((o: any) => o.order_id)
      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from('order_items')
          .select('order_id')
          .in('order_id', orderIds)
        if (!itemsErr && itemsData) {
          const counts: Record<string, number> = {}
          itemsData.forEach((it: any) => {
            counts[it.order_id] = (counts[it.order_id] || 0) + 1
          })
          setItemCounts(counts)
        }
      }
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
        return 'bg-purple-100 text-purple-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      (order.order_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user_id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    paid: orders.filter(o => o.status === 'paid').length,
    completed: orders.filter(o => o.status === 'completed').length,
    revenue: orders
      .filter(o => o.status === 'paid' || o.status === 'completed')
      .reduce((sum, o) => sum + (o.total_amount as any || 0), 0),
  }

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900">Orders</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Total Orders</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-6 border border-yellow-200">
          <p className="text-yellow-700 text-sm font-medium">Pending</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-6 border border-blue-200">
          <p className="text-blue-700 text-sm font-medium">Paid</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.paid}</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-6 border border-green-200">
          <p className="text-green-700 text-sm font-medium">Revenue</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            Rp {stats.revenue.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-72">
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
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {orders.length === 0 ? 'No orders yet' : 'No orders match your search'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-900">Order ID</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900">User ID</th>
                <th className="text-right px-6 py-3 font-semibold text-gray-900">Total (IDR)</th>
                <th className="text-center px-6 py-3 font-semibold text-gray-900">Items</th>
                <th className="text-center px-6 py-3 font-semibold text-gray-900">Status</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.order_id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-3">
                    <span className="font-mono text-sm font-medium text-gray-900">
                      {order.order_id}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {order.user_id}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="font-semibold text-gray-900">
                      Rp {Number(order.total_amount || 0).toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className="text-sm text-gray-600">{itemCounts[order.order_id] || 0}</span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
