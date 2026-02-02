'use client'

import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi'

type User = {
  user_id: string
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  language?: string | null
  last_activity?: string | null
}

export default function UsersPage() {
  const supabase = createBrowserClient()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('last_activity', { ascending: false })

      if (error) throw error
      setUsers((data || []) as any)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const searchLower = searchQuery.toLowerCase()
      return (
        String(user.first_name || '').toLowerCase().includes(searchLower) ||
        String(user.username || '').toLowerCase().includes(searchLower) ||
        String(user.user_id || '').includes(searchQuery)
      )
    })
  }, [users, searchQuery])

  const activeUsers30d = useMemo(() => {
    const now = Date.now()
    const cutoff = now - 30 * 24 * 60 * 60 * 1000
    return users.filter(u => u.last_activity && new Date(u.last_activity).getTime() >= cutoff).length
  }, [users])

  const activeUsers24h = useMemo(() => {
    const now = Date.now()
    const cutoff = now - 24 * 60 * 60 * 1000
    return users.filter(u => u.last_activity && new Date(u.last_activity).getTime() >= cutoff).length
  }, [users])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, Math.max(1, totalPages)))
  }, [totalPages])

  if (loading) {
    return <div className="text-center py-8">Loading users...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-xl md:text-2xl font-bold text-gray-900">Users</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <p className="text-gray-600 text-xs md:text-sm font-medium">Total Users</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1 md:mt-2">{users.length}</p>
        </div>
        <div className="bg-blue-50 rounded-lg shadow p-4 md:p-6 border border-blue-200">
          <p className="text-blue-700 text-xs md:text-sm font-medium">Active Users (30d)</p>
          <p className="text-2xl md:text-3xl font-bold text-blue-600 mt-1 md:mt-2">{activeUsers30d}</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4 md:p-6 border border-green-200">
          <p className="text-green-700 text-xs md:text-sm font-medium">Active Users (24h)</p>
          <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1 md:mt-2">{activeUsers24h}</p>
        </div>
      </div>

      {/* Search */}
      {users.length > 0 && (
        <div className="relative">
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      {/* Pagination */}
      {filteredUsers.length > 0 && (
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

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg font-medium mb-2">No User Data Available Yet</p>
            <p className="text-gray-500 text-sm">
              Users will appear here once they start using the Telegram bot
            </p>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg max-w-md mx-auto border border-blue-200">
              <p className="text-blue-900 text-sm">
                <strong>Note:</strong> To track user data, make sure the bot is properly configured to store user information in Supabase.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Name</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">User ID</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Username</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Language</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedUsers.map((user) => (
                    <tr key={user.user_id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900">{user.first_name || ''} {user.last_name || ''}</p>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-mono text-sm text-gray-600">{user.user_id}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{user.username || '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{user.language || '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{user.last_activity ? new Date(user.last_activity).toLocaleString('id-ID') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {paginatedUsers.map((user) => (
                <div key={user.user_id} className="p-4 hover:bg-gray-50">
                  <div className="mb-2">
                    <p className="font-medium text-gray-900 text-base">
                      {user.first_name || ''} {user.last_name || ''}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-1">{user.user_id}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                    <div>
                      <span className="text-gray-500 text-xs">Username:</span>
                      <p className="text-gray-700">{user.username || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Language:</span>
                      <p className="text-gray-700">{user.language || '-'}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-500 text-xs">Last Activity:</span>
                    <p className="text-gray-600 text-sm">
                      {user.last_activity ? new Date(user.last_activity).toLocaleString('id-ID') : '-'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Integration Guide */}
      <div className="bg-linear-to-r from-indigo-50 to-blue-50 rounded-lg shadow p-4 md:p-6 border border-indigo-200">
        <h3 className="text-base md:text-lg font-bold text-indigo-900 mb-2 md:mb-3">👥 User Tracking Setup</h3>
        <p className="text-indigo-800 text-xs md:text-sm mb-2 md:mb-3">
          To enable user tracking in this dashboard, ensure your Telegram bot is configured to store user data in Supabase.
        </p>
        <div className="bg-white rounded p-3 text-xs text-gray-700 font-mono">
          <p className="mb-2">Table: <strong>users</strong></p>
          <p className="mb-2">Columns: user_id, username, first_name, last_name, language, last_activity</p>
          <p>Once data is populated, user statistics will display automatically.</p>
        </div>
      </div>
    </div>
  )
}
