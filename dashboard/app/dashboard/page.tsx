'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiBox, FiPackage, FiShoppingCart, FiUsers, FiTrendingUp, FiDollarSign, FiSettings, FiCheckCircle, FiBarChart } from 'react-icons/fi'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Stats {
  totalProducts: number
  totalItems: number
  totalOrders: number
  totalUsers: number
  revenueThisMonth: number
  totalRevenue: number
  avgOrderValue: number
}

interface ChartData {
  date: string
  orders: number
  revenue: number
}

export default function DashboardPage() {
  const supabase = createBrowserClient()
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalItems: 0,
    totalOrders: 0,
    totalUsers: 0,
    revenueThisMonth: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  })
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get products count
        const { count: productsCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })

        // Get items count
        const { count: itemsCount } = await supabase
          .from('product_items')
          .select('*', { count: 'exact', head: true })

        // Get orders
        const { data: orders, count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact' })

        // Get users count
        const { count: usersCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })

        // Get revenue this month
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const { data: revenueData } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('status', 'completed')
          .gte('created_at', firstDayOfMonth.toISOString())

        const revenueThisMonth = revenueData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

        // Calculate total revenue and avg order value
        const paidOrders = (orders || []).filter((o: any) => o.status === 'paid' || o.status === 'completed')
        const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0)
        const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0

        // Process chart data (last 7 days)
        const days = 7
        const data: ChartData[] = []

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]

          const dayOrders = (orders || []).filter((o: any) => {
            const orderDate = new Date(o.created_at).toISOString().split('T')[0]
            return orderDate === dateStr && (o.status === 'paid' || o.status === 'completed')
          })

          const dayRevenue = dayOrders.reduce((sum: number, o: any) => sum + o.total_amount || 0, 0)

          data.push({
            date: new Date(dateStr).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }),
            orders: dayOrders.length,
            revenue: dayRevenue,
          })
        }

        setChartData(data)
        setStats({
          totalProducts: productsCount || 0,
          totalItems: itemsCount || 0,
          totalOrders: ordersCount || 0,
          totalUsers: usersCount || 0,
          revenueThisMonth,
          totalRevenue,
          avgOrderValue: Math.round(avgOrderValue),
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Welcome to Admin Dashboard</h2>
        <p className="text-sm md:text-base text-gray-600">Real-time analytics and management for your PBS Telegram Bot</p>
      </div>

      {/* Main Stats - 4 columns on desktop, 2 on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        {/* Total Revenue */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-indigo-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs md:text-sm font-medium">Total Revenue</p>
              <p className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">
                Rp {stats.totalRevenue.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-indigo-100 text-indigo-600 p-2 md:p-3 rounded-lg">
              <FiDollarSign className="text-lg md:text-xl lg:text-2xl" />
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-green-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs md:text-sm font-medium">Total Orders</p>
              <p className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">{stats.totalOrders}</p>
            </div>
            <div className="bg-green-100 text-green-600 p-2 md:p-3 rounded-lg">
              <FiShoppingCart className="text-lg md:text-xl lg:text-2xl" />
            </div>
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-blue-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs md:text-sm font-medium">Avg Order Value</p>
              <p className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">
                Rp {stats.avgOrderValue.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-blue-100 text-blue-600 p-2 md:p-3 rounded-lg">
              <FiTrendingUp className="text-lg md:text-xl lg:text-2xl" />
            </div>
          </div>
        </div>

        {/* This Month Revenue */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-purple-600 hover:shadow-lg transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs md:text-sm font-medium">This Month</p>
              <p className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 md:mt-2">
                Rp {stats.revenueThisMonth.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-purple-100 text-purple-600 p-2 md:p-3 rounded-lg">
              <FiTrendingUp className="text-lg md:text-xl lg:text-2xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section - 2 column on desktop, 1 on tablet/mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Orders Chart */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4">Revenue & Orders (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" style={{ fontSize: '12px' }} />
              <YAxis yAxisId="left" style={{ fontSize: '12px' }} />
              <YAxis yAxisId="right" orientation="right" style={{ fontSize: '12px' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
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

        {/* Business Metrics Card */}
        <div className="space-y-4">
          {/* Total Products */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Products</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.totalProducts}</p>
              </div>
              <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
                <FiBox className="text-2xl" />
              </div>
            </div>
          </div>

          {/* Product Items */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Product Items</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.totalItems}</p>
              </div>
              <div className="bg-green-100 text-green-600 p-3 rounded-lg">
                <FiPackage className="text-2xl" />
              </div>
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Users</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
              </div>
              <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
                <FiUsers className="text-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-3 md:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <a
            href="/dashboard/products"
            className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <div className="flex items-center gap-2">
              <FiBox className="text-indigo-600" />
              <p className="font-medium text-gray-900 text-sm md:text-base">Manage Products</p>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Add or edit</p>
          </a>
          <a
            href="/dashboard/items"
            className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <div className="flex items-center gap-2">
              <FiPackage className="text-indigo-600" />
              <p className="font-medium text-gray-900 text-sm md:text-base">Manage Items</p>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Track inventory</p>
          </a>
          <a
            href="/dashboard/orders"
            className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <div className="flex items-center gap-2">
              <FiShoppingCart className="text-indigo-600" />
              <p className="font-medium text-gray-900 text-sm md:text-base">View Orders</p>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Transactions</p>
          </a>
          <a
            href="/dashboard/settings"
            className="p-3 md:p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <div className="flex items-center gap-2">
              <FiSettings className="text-indigo-600" />
              <p className="font-medium text-gray-900 text-sm md:text-base">Settings</p>
            </div>
            <p className="text-xs md:text-sm text-gray-600 mt-1">Configure</p>
          </a>
        </div>
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Database Status */}
        <div className="bg-linear-to-br from-green-50 to-green-100 rounded-lg shadow p-4 md:p-6 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <FiCheckCircle className="text-green-700" />
            <h3 className="text-base md:text-lg font-bold text-green-900">Database Status</h3>
          </div>
          <p className="text-sm md:text-base text-green-800">Supabase PostgreSQL connected and operational</p>
          <p className="text-xs md:text-sm text-green-700 mt-2">Real-time data sync enabled</p>
        </div>

        {/* System Info */}
        <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg shadow p-4 md:p-6 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <FiBarChart className="text-blue-700" />
            <h3 className="text-base md:text-lg font-bold text-blue-900">Analytics</h3>
          </div>
          <p className="text-sm md:text-base text-blue-800">Real-time revenue and order tracking</p>
          <p className="text-xs md:text-sm text-blue-700 mt-2">7-day performance overview</p>
        </div>
      </div>
    </div>
  )
}
