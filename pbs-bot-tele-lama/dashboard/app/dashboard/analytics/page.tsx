'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { FiTrendingUp, FiShoppingCart, FiUsers, FiDollarSign, FiBarChart, FiInfo, FiPackage, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi'

interface ChartData {
  date: string
  orders: number
  revenue: number
}

interface ProductSales {
  kode: string
  nama: string
  sales: number
  revenue: number
}

export default function AnalyticsPage() {
  const supabase = createBrowserClient()
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [productSales, setProductSales] = useState<ProductSales[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    conversionRate: '0%',
    pendingOrders: 0,
    paidOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    ordersLast7d: 0,
    ordersLast30d: 0,
    totalItemsSold: 0,
    avgItemsPerOrder: 0,
  })

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      // Get orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('order_id, product_code, product_name, quantity, price')

      const { data: products } = await supabase
        .from('products')
        .select('kode, nama')

      if (ordersError) throw ordersError

      // Process chart data (last 7 days)
      const days = 7
      const data: ChartData[] = []
      const now = new Date()

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]

        const dayOrders = (orders || []).filter((o: any) => {
          const orderDate = new Date(o.created_at).toISOString().split('T')[0]
          return orderDate === dateStr && (o.status === 'paid' || o.status === 'completed')
        })

        const dayRevenue = dayOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0)

        data.push({
          date: new Date(dateStr).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
          orders: dayOrders.length,
          revenue: dayRevenue,
        })
      }

      // Calculate stats
      const paidOrders = (orders || []).filter((o: any) => o.status === 'paid' || o.status === 'completed')
      const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0)
      const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0

      const pendingOrders = (orders || []).filter((o: any) => o.status === 'pending').length
      const paidCount = (orders || []).filter((o: any) => o.status === 'paid').length
      const completedOrders = (orders || []).filter((o: any) => o.status === 'completed').length
      const cancelledOrders = (orders || []).filter((o: any) => o.status === 'cancelled').length

      const nowTs = now.getTime()
      const last7dTs = nowTs - 7 * 24 * 60 * 60 * 1000
      const last30dTs = nowTs - 30 * 24 * 60 * 60 * 1000
      const ordersLast7d = (orders || []).filter((o: any) => new Date(o.created_at).getTime() >= last7dTs).length
      const ordersLast30d = (orders || []).filter((o: any) => new Date(o.created_at).getTime() >= last30dTs).length

      // Build product sales from order_items (bot) and orders.items (web)
      const productMap = new Map<string, ProductSales>()
      const productNameByCode = new Map((products || []).map((p: any) => [p.kode, p.nama]))
      const paidOrderIds = new Set(paidOrders.map((o: any) => o.id))

      let totalItemsSold = 0

      ;(orderItems || []).forEach((item: any) => {
        if (!paidOrderIds.has(item.order_id)) return
        const code = item.product_code || 'UNKNOWN'
        const name = item.product_name || productNameByCode.get(code) || code
        const qty = Number(item.quantity || 1)
        const revenue = Number(item.price || 0) * qty

        totalItemsSold += qty
        const existing = productMap.get(code) || { kode: code, nama: name, sales: 0, revenue: 0 }
        existing.sales += qty
        existing.revenue += revenue
        productMap.set(code, existing)
      })

      ;(orders || []).forEach((order: any) => {
        if (order.status !== 'paid' && order.status !== 'completed') return
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const code = item.product_code || item.code || item.product_id || 'UNKNOWN'
            const name = item.product_name || item.name || productNameByCode.get(code) || code
            const qty = Number(item.quantity || 1)
            const revenue = Number(item.price || 0) * qty

            totalItemsSold += qty
            const existing = productMap.get(code) || { kode: code, nama: name, sales: 0, revenue: 0 }
            existing.sales += qty
            existing.revenue += revenue
            productMap.set(code, existing)
          })
        }
      })

      const productSalesData = Array.from(productMap.values())
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10)

      const avgItemsPerOrder = paidOrders.length > 0 ? Math.round(totalItemsSold / paidOrders.length) : 0

      setChartData(data)
      setProductSales(productSalesData)
      setStats({
        totalRevenue,
        totalOrders: orders?.length || 0,
        avgOrderValue: Math.round(avgOrderValue),
        conversionRate: '85%', // Placeholder
        pendingOrders,
        paidOrders: paidCount,
        completedOrders,
        cancelledOrders,
        ordersLast7d,
        ordersLast30d,
        totalItemsSold,
        avgItemsPerOrder,
      })

      setLoading(false)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-600 mt-1">Overview of revenue, orders, and operational metrics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-indigo-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                Rp {stats.totalRevenue.toLocaleString('id-ID')}
              </p>
            </div>
            <FiDollarSign className="text-2xl text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-green-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
            </div>
            <FiShoppingCart className="text-2xl text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-blue-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                Rp {stats.avgOrderValue.toLocaleString('id-ID')}
              </p>
            </div>
            <FiTrendingUp className="text-2xl text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-purple-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.conversionRate}</p>
            </div>
            <FiTrendingUp className="text-2xl text-purple-600" />
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-gray-300 hover:shadow-lg transition">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Order Status Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-700">
              <FiClock />
              <p className="text-xs font-medium">Pending</p>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-2">{stats.pendingOrders}</p>
          </div>
          <div className="rounded-lg border border-blue-200 p-4">
            <div className="flex items-center gap-2 text-blue-700">
              <FiShoppingCart />
              <p className="text-xs font-medium">Paid</p>
            </div>
            <p className="text-xl font-bold text-blue-700 mt-2">{stats.paidOrders}</p>
          </div>
          <div className="rounded-lg border border-green-200 p-4">
            <div className="flex items-center gap-2 text-green-700">
              <FiCheckCircle />
              <p className="text-xs font-medium">Completed</p>
            </div>
            <p className="text-xl font-bold text-green-700 mt-2">{stats.completedOrders}</p>
          </div>
          <div className="rounded-lg border border-red-200 p-4">
            <div className="flex items-center gap-2 text-red-700">
              <FiXCircle />
              <p className="text-xs font-medium">Cancelled</p>
            </div>
            <p className="text-xl font-bold text-red-700 mt-2">{stats.cancelledOrders}</p>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Revenue & Orders (Last 7 Days)</h2>
          <span className="text-xs text-gray-500">Daily</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke="#4f46e5"
              name="Revenue (Rp)"
              strokeWidth={2}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="orders"
              stroke="#10b981"
              name="Orders"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Operational Metrics & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Operational Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Orders (Last 7 Days)</p>
              <p className="text-xl font-bold text-gray-900 mt-2">{stats.ordersLast7d}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Orders (Last 30 Days)</p>
              <p className="text-xl font-bold text-gray-900 mt-2">{stats.ordersLast30d}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Total Items Sold</p>
              <p className="text-xl font-bold text-gray-900 mt-2">{stats.totalItemsSold}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Avg Items / Order</p>
              <p className="text-xl font-bold text-gray-900 mt-2">{stats.avgItemsPerOrder}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Top Products</h3>
          {productSales.length === 0 ? (
            <p className="text-sm text-gray-500">No sales data available.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {productSales.slice(0, 5).map((p, idx) => (
                <div key={p.kode} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{idx + 1}. {p.nama}</p>
                    <p className="text-xs text-gray-500">Code: {p.kode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{p.sales} sold</p>
                    <p className="text-xs text-gray-500">Rp {p.revenue.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-5 border border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <FiBarChart className="text-blue-700" />
          <h3 className="text-base font-semibold text-blue-900">Analytics Dashboard</h3>
        </div>
        <p className="text-blue-800">
          This dashboard shows your sales performance, revenue trends, and order analytics. 
          Data is updated in real-time from your Supabase database.
        </p>
        <p className="text-sm text-blue-700 mt-3">
          <span className="inline-flex items-center gap-2">
            <FiInfo className="text-blue-700" />
            Tip: Check the Orders page for detailed transaction information and customer data.
          </span>
        </p>
      </div>
    </div>
  )
}
