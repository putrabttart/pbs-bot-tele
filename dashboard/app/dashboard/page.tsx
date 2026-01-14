'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiBox, FiPackage, FiShoppingCart, FiUsers } from 'react-icons/fi'

interface Stats {
  totalProducts: number
  totalItems: number
  totalOrders: number
  totalUsers: number
  revenueThisMonth: number
}

export default function DashboardPage() {
  const supabase = createBrowserClient()
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalItems: 0,
    totalOrders: 0,
    totalUsers: 0,
    revenueThisMonth: 0,
  })
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

        // Get orders count
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })

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

        const revenue = revenueData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

        setStats({
          totalProducts: productsCount || 0,
          totalItems: itemsCount || 0,
          totalOrders: ordersCount || 0,
          totalUsers: usersCount || 0,
          revenueThisMonth: revenue,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const statCards = [
    {
      name: 'Total Products',
      value: stats.totalProducts,
      key: 'totalProducts',
      icon: FiBox,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      name: 'Product Items',
      value: stats.totalItems,
      key: 'totalItems',
      icon: FiPackage,
      color: 'bg-green-100 text-green-600',
    },
    {
      name: 'Total Orders',
      value: stats.totalOrders,
      key: 'totalOrders',
      icon: FiShoppingCart,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      name: 'Total Users',
      value: stats.totalUsers,
      key: 'totalUsers',
      icon: FiUsers,
      color: 'bg-orange-100 text-orange-600',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Admin Dashboard</h2>
        <p className="text-gray-600">Manage your PBS Telegram Bot products, items, and orders</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.name}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium">{card.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="text-2xl" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/dashboard/products"
            className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <p className="font-medium text-gray-900">📦 Manage Products</p>
            <p className="text-sm text-gray-600 mt-1">Add, edit, or delete products</p>
          </a>
          <a
            href="/dashboard/items"
            className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <p className="font-medium text-gray-900">📄 Manage Items</p>
            <p className="text-sm text-gray-600 mt-1">Add items to products</p>
          </a>
          <a
            href="/dashboard/orders"
            className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition"
          >
            <p className="font-medium text-gray-900">📊 View Orders</p>
            <p className="text-sm text-gray-600 mt-1">Track customer orders</p>
          </a>
        </div>
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Database Status */}
        <div className="bg-linear-to-br from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <h3 className="text-lg font-bold text-green-900 mb-2">✅ Database Status</h3>
          <p className="text-green-800">Supabase PostgreSQL connected and operational</p>
          <p className="text-sm text-green-700 mt-2">All data synced in real-time</p>
        </div>

        {/* System Info */}
        <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 border border-blue-200">
          <h3 className="text-lg font-bold text-blue-900 mb-2">📊 System Info</h3>
          <p className="text-blue-800">PBS Telegram Bot Admin Panel v1.0</p>
          <p className="text-sm text-blue-700 mt-2">Next.js 14 + Supabase</p>
        </div>
      </div>
    </div>
  )
}
