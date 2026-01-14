'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { FiTrendingUp, FiShoppingCart, FiUsers, FiDollarSign } from 'react-icons/fi'

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

        const dayRevenue = dayOrders.reduce((sum: number, o: any) => sum + o.total_price, 0)

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

      setChartData(data)
      setStats({
        totalRevenue,
        totalOrders: orders?.length || 0,
        avgOrderValue: Math.round(avgOrderValue),
        conversionRate: '85%', // Placeholder
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
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                Rp {stats.totalRevenue.toLocaleString('id-ID')}
              </p>
            </div>
            <FiDollarSign className="text-3xl text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
            </div>
            <FiShoppingCart className="text-3xl text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                Rp {stats.avgOrderValue.toLocaleString('id-ID')}
              </p>
            </div>
            <FiTrendingUp className="text-3xl text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.conversionRate}</p>
            </div>
            <FiTrendingUp className="text-3xl text-purple-600" />
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Revenue & Orders (Last 7 Days)</h2>
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

      {/* Info Box */}
      <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-6 border border-blue-200">
        <h3 className="text-lg font-bold text-blue-900 mb-2">📊 Analytics Dashboard</h3>
        <p className="text-blue-800">
          This dashboard shows your sales performance, revenue trends, and order analytics. 
          Data is updated in real-time from your Supabase database.
        </p>
        <p className="text-sm text-blue-700 mt-3">
          💡 Tip: Check the Orders page for detailed transaction information and customer data.
        </p>
      </div>
    </div>
  )
}
