'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { 
  FiSearch, FiChevronLeft, FiChevronRight, FiUsers, FiGlobe,
  FiEdit2, FiTrash2, FiX, FiCheck, FiToggleLeft, FiToggleRight,
  FiAlertCircle, FiCheckCircle, FiMail, FiPhone, FiUser, FiEye,
  FiClock, FiHash, FiAtSign, FiMessageSquare
} from 'react-icons/fi'

// ─── Types ───────────────────────────────────────────────────────
type TelegramUser = {
  user_id: string
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  language?: string | null
  created_at?: string | null
  last_activity?: string | null
}

type WebUser = {
  id: string
  nama: string
  email: string
  phone: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type TabKey = 'telegram' | 'web'

// ─── Toast Component ─────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}>
      {type === 'success' ? <FiCheckCircle size={16} /> : <FiAlertCircle size={16} />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80"><FiX size={14} /></button>
    </div>
  )
}

// ─── Confirm Dialog ──────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = 'Hapus', danger = true }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string; danger?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Batal
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm text-white rounded-lg transition ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Telegram Detail Modal ───────────────────────────────────────
function TelegramDetailModal({ user, onClose }: { user: TelegramUser; onClose: () => void }) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || '-'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Detail User Telegram</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition"><FiX size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <FiMessageSquare className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{fullName}</p>
              {user.username && (
                <p className="text-sm text-blue-600">@{user.username}</p>
              )}
            </div>
          </div>
          <div className="space-y-3 bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FiHash className="text-gray-400 shrink-0" size={16} />
              <div>
                <p className="text-xs text-gray-500">User ID</p>
                <p className="text-sm text-gray-900 font-mono">{user.user_id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiAtSign className="text-gray-400 shrink-0" size={16} />
              <div>
                <p className="text-xs text-gray-500">Username</p>
                <p className="text-sm text-gray-900">{user.username ? `@${user.username}` : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiUser className="text-gray-400 shrink-0" size={16} />
              <div>
                <p className="text-xs text-gray-500">Nama Depan</p>
                <p className="text-sm text-gray-900">{user.first_name || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiUser className="text-gray-400 shrink-0" size={16} />
              <div>
                <p className="text-xs text-gray-500">Nama Belakang</p>
                <p className="text-sm text-gray-900">{user.last_name || '-'}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Bahasa</p>
              <p className="text-gray-900 font-medium">{user.language || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Terdaftar</p>
              <p className="text-gray-900 font-medium">
                {user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
              </p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <FiClock className="text-gray-400" size={14} />
              <p className="text-xs text-gray-500">Aktivitas Terakhir</p>
            </div>
            <p className="text-sm text-gray-900 font-medium">
              {user.last_activity ? new Date(user.last_activity).toLocaleString('id-ID') : '-'}
            </p>
          </div>
        </div>
        <div className="p-5 border-t border-gray-200">
          <button onClick={onClose} className="w-full px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Telegram Edit Modal ─────────────────────────────────────────
function TelegramEditModal({ user, onSave, onClose, saving }: {
  user: TelegramUser; onSave: (data: Partial<TelegramUser>) => void; onClose: () => void; saving: boolean
}) {
  const [firstName, setFirstName] = useState(user.first_name || '')
  const [lastName, setLastName] = useState(user.last_name || '')
  const [username, setUsername] = useState(user.username || '')
  const [language, setLanguage] = useState(user.language || 'id')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!firstName.trim()) errs.first_name = 'Nama depan tidak boleh kosong'
    if (username.trim() && !/^[a-zA-Z0-9_]{3,100}$/.test(username.trim())) {
      errs.username = 'Username hanya boleh huruf, angka, underscore (min 3 karakter)'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSave({
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      username: username.trim() || null,
      language: language.trim() || 'id',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Edit User Telegram</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition"><FiX size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* User ID (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
            <div className="relative">
              <FiHash className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text" value={String(user.user_id)} readOnly
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 font-mono cursor-not-allowed"
              />
            </div>
          </div>
          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Depan <span className="text-red-500">*</span></label>
            <div className="relative">
              <FiUser className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.first_name ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="Nama depan"
              />
            </div>
            {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
          </div>
          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Belakang</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nama belakang (opsional)"
              />
            </div>
          </div>
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <div className="relative">
              <FiAtSign className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.username ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="username (opsional)"
              />
            </div>
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
          </div>
          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bahasa</label>
            <select
              value={language} onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="id">Indonesia (id)</option>
              <option value="en">English (en)</option>
              <option value="ms">Melayu (ms)</option>
              <option value="jv">Javanese (jv)</option>
              <option value="su">Sundanese (su)</option>
              <option value="zh">Chinese (zh)</option>
              <option value="ar">Arabic (ar)</option>
            </select>
          </div>
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2">
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
              ) : (
                <><FiCheck size={16} /> Simpan</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Web Edit Modal ──────────────────────────────────────────────
function EditUserModal({ user, onSave, onClose, saving }: {
  user: WebUser; onSave: (data: Partial<WebUser>) => void; onClose: () => void; saving: boolean
}) {
  const [nama, setNama] = useState(user.nama)
  const [email, setEmail] = useState(user.email)
  const [phone, setPhone] = useState(user.phone)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!nama.trim() || nama.trim().length < 2) errs.nama = 'Nama minimal 2 karakter'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Email tidak valid'
    if (!phone.trim() || !/^[0-9+\-\s()]{8,20}$/.test(phone.trim())) errs.phone = 'Nomor telepon tidak valid'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSave({ nama: nama.trim(), email: email.trim(), phone: phone.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Edit User Web</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition"><FiX size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text" value={nama} onChange={(e) => setNama(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.nama ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="Nama lengkap"
              />
            </div>
            {errors.nama && <p className="text-xs text-red-500 mt-1">{errors.nama}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.email ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="email@example.com"
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
            <div className="relative">
              <FiPhone className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.phone ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2">
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
              ) : (
                <><FiCheck size={16} /> Simpan</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Web Detail Modal ────────────────────────────────────────────
function DetailUserModal({ user, onClose }: { user: WebUser; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Detail User Web</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition"><FiX size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <FiUser className="text-indigo-600" size={24} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{user.nama}</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {user.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
          <div className="space-y-3 bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FiMail className="text-gray-400 shrink-0" size={16} />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm text-gray-900">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiPhone className="text-gray-400 shrink-0" size={16} />
              <div>
                <p className="text-xs text-gray-500">No. Telepon</p>
                <p className="text-sm text-gray-900">{user.phone}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Terdaftar</p>
              <p className="text-gray-900 font-medium">{new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <p className="text-xs text-gray-500">{new Date(user.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Terakhir Update</p>
              <p className="text-gray-900 font-medium">{new Date(user.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <p className="text-xs text-gray-500">{new Date(user.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">User ID</p>
            <p className="text-xs text-gray-600 font-mono break-all">{user.id}</p>
          </div>
        </div>
        <div className="p-5 border-t border-gray-200">
          <button onClick={onClose} className="w-full px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function UsersPage() {
  const supabase = createBrowserClient()

  // ─── Tab state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('telegram')

  // ─── Telegram users state ──────────────────────────────────────
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([])
  const [telegramLoading, setTelegramLoading] = useState(true)

  // ─── Web users state ───────────────────────────────────────────
  const [webUsers, setWebUsers] = useState<WebUser[]>([])
  const [webLoading, setWebLoading] = useState(true)

  // ─── Shared state ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // ─── Web modal / action state ──────────────────────────────────
  const [editingWebUser, setEditingWebUser] = useState<WebUser | null>(null)
  const [detailWebUser, setDetailWebUser] = useState<WebUser | null>(null)
  const [deletingWebUser, setDeletingWebUser] = useState<WebUser | null>(null)
  const [togglingWebUser, setTogglingWebUser] = useState<WebUser | null>(null)

  // ─── Telegram modal / action state ─────────────────────────────
  const [detailTgUser, setDetailTgUser] = useState<TelegramUser | null>(null)
  const [editingTgUser, setEditingTgUser] = useState<TelegramUser | null>(null)
  const [deletingTgUser, setDeletingTgUser] = useState<TelegramUser | null>(null)

  // ─── Fetch data ────────────────────────────────────────────────
  useEffect(() => {
    fetchTelegramUsers()
    fetchWebUsers()

    // Supabase Realtime: auto-refresh on user tables change
    const channel = supabase
      .channel('users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchTelegramUsers()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_web' }, () => {
        fetchWebUsers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, activeTab])

  const fetchTelegramUsers = async () => {
    try {
      const res = await fetch('/api/telegram-users')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setTelegramUsers(json.data || [])
    } catch (error) {
      console.error('Error fetching telegram users:', error)
      // Fallback to direct supabase query
      try {
        const { data, error: sbError } = await supabase
          .from('users')
          .select('*')
          .order('last_activity', { ascending: false })
        if (!sbError) setTelegramUsers((data || []) as any)
      } catch {}
    } finally {
      setTelegramLoading(false)
    }
  }

  const fetchWebUsers = async () => {
    try {
      const res = await fetch('/api/user-web')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setWebUsers(json.data || [])
    } catch (error) {
      console.error('Error fetching web users:', error)
    } finally {
      setWebLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TELEGRAM USER ACTIONS
  // ═══════════════════════════════════════════════════════════════
  const handleTgEditSave = useCallback(async (data: Partial<TelegramUser>) => {
    if (!editingTgUser) return
    setSaving(true)
    try {
      const res = await fetch('/api/telegram-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: editingTgUser.user_id, ...data }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setTelegramUsers(prev => prev.map(u => u.user_id === editingTgUser.user_id ? { ...u, ...json.data } : u))
      const displayName = data.first_name || editingTgUser.first_name || editingTgUser.user_id
      setToast({ message: `User ${displayName} berhasil diupdate`, type: 'success' })
      setEditingTgUser(null)
    } catch (err: any) {
      setToast({ message: err.message || 'Gagal mengupdate user', type: 'error' })
    } finally {
      setSaving(false)
    }
  }, [editingTgUser])

  const handleTgDelete = useCallback(async (user: TelegramUser) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/telegram-users?user_id=${user.user_id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setTelegramUsers(prev => prev.filter(u => u.user_id !== user.user_id))
      const displayName = user.first_name || user.username || user.user_id
      setToast({ message: `User ${displayName} berhasil dihapus`, type: 'success' })
    } catch (err: any) {
      setToast({ message: err.message || 'Gagal menghapus user', type: 'error' })
    } finally {
      setSaving(false)
      setDeletingTgUser(null)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // WEB USER ACTIONS
  // ═══════════════════════════════════════════════════════════════
  const handleWebToggleActive = useCallback(async (user: WebUser) => {
    setSaving(true)
    try {
      const res = await fetch('/api/user-web', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setWebUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active, updated_at: json.data?.updated_at || u.updated_at } : u))
      setToast({ message: `User ${user.nama} berhasil ${user.is_active ? 'dinonaktifkan' : 'diaktifkan'}`, type: 'success' })
    } catch (err: any) {
      setToast({ message: err.message || 'Gagal mengubah status user', type: 'error' })
    } finally {
      setSaving(false)
      setTogglingWebUser(null)
    }
  }, [])

  const handleWebEditSave = useCallback(async (data: Partial<WebUser>) => {
    if (!editingWebUser) return
    setSaving(true)
    try {
      const res = await fetch('/api/user-web', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingWebUser.id, ...data }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setWebUsers(prev => prev.map(u => u.id === editingWebUser.id ? { ...u, ...json.data } : u))
      setToast({ message: `User ${data.nama || editingWebUser.nama} berhasil diupdate`, type: 'success' })
      setEditingWebUser(null)
    } catch (err: any) {
      setToast({ message: err.message || 'Gagal mengupdate user', type: 'error' })
    } finally {
      setSaving(false)
    }
  }, [editingWebUser])

  const handleWebDelete = useCallback(async (user: WebUser) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/user-web?id=${user.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setWebUsers(prev => prev.filter(u => u.id !== user.id))
      setToast({ message: `User ${user.nama} berhasil dihapus`, type: 'success' })
    } catch (err: any) {
      setToast({ message: err.message || 'Gagal menghapus user', type: 'error' })
    } finally {
      setSaving(false)
      setDeletingWebUser(null)
    }
  }, [])

  // ─── Telegram filtering & stats ────────────────────────────────
  const filteredTelegramUsers = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return telegramUsers.filter(user =>
      String(user.first_name || '').toLowerCase().includes(q) ||
      String(user.last_name || '').toLowerCase().includes(q) ||
      String(user.username || '').toLowerCase().includes(q) ||
      String(user.user_id || '').includes(searchQuery)
    )
  }, [telegramUsers, searchQuery])

  const activeUsers30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    return telegramUsers.filter(u => u.last_activity && new Date(u.last_activity).getTime() >= cutoff).length
  }, [telegramUsers])

  const activeUsers24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return telegramUsers.filter(u => u.last_activity && new Date(u.last_activity).getTime() >= cutoff).length
  }, [telegramUsers])

  // ─── Web filtering & stats ─────────────────────────────────────
  const filteredWebUsers = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return webUsers.filter(user =>
      user.nama.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.phone.includes(searchQuery)
    )
  }, [webUsers, searchQuery])

  const activeWebUsers = useMemo(() => webUsers.filter(u => u.is_active).length, [webUsers])
  const inactiveWebUsers = useMemo(() => webUsers.filter(u => !u.is_active).length, [webUsers])

  // ─── Pagination ────────────────────────────────────────────────
  const currentItems = activeTab === 'telegram' ? filteredTelegramUsers : filteredWebUsers
  const totalPages = Math.max(1, Math.ceil(currentItems.length / pageSize))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return currentItems.slice(start, start + pageSize)
  }, [currentItems, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, Math.max(1, totalPages)))
  }, [totalPages])

  // ─── Loading state ─────────────────────────────────────────────
  const isLoading = activeTab === 'telegram' ? telegramLoading : webLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Memuat data user...</p>
        </div>
      </div>
    )
  }

  // ─── Helper: get telegram display name ─────────────────────────
  const tgDisplayName = (user: TelegramUser) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
    return name || user.username || String(user.user_id)
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ═══ TELEGRAM MODALS ═══ */}
      {detailTgUser && (
        <TelegramDetailModal user={detailTgUser} onClose={() => setDetailTgUser(null)} />
      )}
      {editingTgUser && (
        <TelegramEditModal user={editingTgUser} onSave={handleTgEditSave} onClose={() => setEditingTgUser(null)} saving={saving} />
      )}
      {deletingTgUser && (
        <ConfirmDialog
          title="Hapus User Telegram"
          message={`Apakah Anda yakin ingin menghapus user "${tgDisplayName(deletingTgUser)}" (ID: ${deletingTgUser.user_id})? Data favorites dan analytics terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => handleTgDelete(deletingTgUser)}
          onCancel={() => setDeletingTgUser(null)}
        />
      )}

      {/* ═══ WEB MODALS ═══ */}
      {editingWebUser && (
        <EditUserModal user={editingWebUser} onSave={handleWebEditSave} onClose={() => setEditingWebUser(null)} saving={saving} />
      )}
      {detailWebUser && (
        <DetailUserModal user={detailWebUser} onClose={() => setDetailWebUser(null)} />
      )}
      {deletingWebUser && (
        <ConfirmDialog
          title="Hapus User Web"
          message={`Apakah Anda yakin ingin menghapus user "${deletingWebUser.nama}"? Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => handleWebDelete(deletingWebUser)}
          onCancel={() => setDeletingWebUser(null)}
        />
      )}
      {togglingWebUser && (
        <ConfirmDialog
          title={togglingWebUser.is_active ? 'Nonaktifkan User' : 'Aktifkan User'}
          message={`Apakah Anda yakin ingin ${togglingWebUser.is_active ? 'menonaktifkan' : 'mengaktifkan'} user "${togglingWebUser.nama}"?${
            togglingWebUser.is_active ? ' User tidak akan bisa login ke web store.' : ' User akan bisa login kembali ke web store.'
          }`}
          confirmLabel={togglingWebUser.is_active ? 'Nonaktifkan' : 'Aktifkan'}
          danger={togglingWebUser.is_active}
          onConfirm={() => handleWebToggleActive(togglingWebUser)}
          onCancel={() => setTogglingWebUser(null)}
        />
      )}

      {/* Header */}
      <h1 className="text-xl md:text-2xl font-bold text-gray-900">Users</h1>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('telegram')}
            className={`flex items-center gap-2 px-4 md:px-6 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'telegram'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiUsers size={16} />
            <span>User Telegram</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              activeTab === 'telegram' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
            }`}>{telegramUsers.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('web')}
            className={`flex items-center gap-2 px-4 md:px-6 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'web'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FiGlobe size={16} />
            <span>User Web</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              activeTab === 'web' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
            }`}>{webUsers.length}</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TELEGRAM TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'telegram' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-indigo-600 hover:shadow-lg transition">
              <p className="text-gray-600 text-xs md:text-sm font-medium">Total Users</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1 md:mt-2">{telegramUsers.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-blue-600 hover:shadow-lg transition">
              <p className="text-blue-700 text-xs md:text-sm font-medium">Active Users (30d)</p>
              <p className="text-2xl md:text-3xl font-bold text-blue-600 mt-1 md:mt-2">{activeUsers30d}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-green-600 hover:shadow-lg transition">
              <p className="text-green-700 text-xs md:text-sm font-medium">Active Users (24h)</p>
              <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1 md:mt-2">{activeUsers24h}</p>
            </div>
          </div>

          {/* Search */}
          {telegramUsers.length > 0 && (
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Cari user berdasarkan nama, username, atau ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Pagination */}
          {filteredTelegramUsers.length > 0 && (
            <PaginationBar
              currentPage={currentPage} totalPages={totalPages} pageSize={pageSize}
              onPageChange={setCurrentPage} onPageSizeChange={setPageSize}
            />
          )}

          {/* Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filteredTelegramUsers.length === 0 ? (
              <div className="text-center py-12">
                <FiUsers className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-600 text-lg font-medium mb-2">Belum Ada Data User</p>
                <p className="text-gray-500 text-sm">
                  User akan muncul di sini setelah mereka mulai menggunakan Telegram bot
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Nama</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">User ID</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Username</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Bahasa</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Aktivitas Terakhir</th>
                        <th className="text-center px-6 py-3 font-semibold text-gray-900 text-sm">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(paginatedItems as TelegramUser[]).map((user) => (
                        <tr key={user.user_id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-3">
                            <button onClick={() => setDetailTgUser(user)} className="text-left hover:underline">
                              <p className="font-medium text-gray-900">{user.first_name || ''} {user.last_name || ''}</p>
                            </button>
                          </td>
                          <td className="px-6 py-3">
                            <span className="font-mono text-sm text-gray-600">{user.user_id}</span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">{user.username ? `@${user.username}` : '-'}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{user.language || '-'}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {user.last_activity ? new Date(user.last_activity).toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setDetailTgUser(user)}
                                title="Detail"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              >
                                <FiEye size={16} />
                              </button>
                              <button
                                onClick={() => setEditingTgUser(user)}
                                title="Edit"
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              >
                                <FiEdit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeletingTgUser(user)}
                                title="Hapus"
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-gray-200">
                  {(paginatedItems as TelegramUser[]).map((user) => (
                    <div key={user.user_id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <button onClick={() => setDetailTgUser(user)} className="text-left">
                          <p className="font-medium text-gray-900 text-base">
                            {user.first_name || ''} {user.last_name || ''}
                          </p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{user.user_id}</p>
                        </button>
                        {user.username && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 shrink-0">
                            @{user.username}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                        <div>
                          <span className="text-gray-500 text-xs">Bahasa:</span>
                          <p className="text-gray-700">{user.language || '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Aktivitas Terakhir:</span>
                          <p className="text-gray-700 text-xs">
                            {user.last_activity ? new Date(user.last_activity).toLocaleString('id-ID') : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => setDetailTgUser(user)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                        >
                          <FiEye size={14} /> Detail
                        </button>
                        <button
                          onClick={() => setEditingTgUser(user)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
                        >
                          <FiEdit2 size={14} /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingTgUser(user)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition"
                        >
                          <FiTrash2 size={14} /> Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg shadow p-4 md:p-6 border border-indigo-200">
            <h3 className="text-base md:text-lg font-bold text-indigo-900 mb-2 md:mb-3">Manajemen User Telegram</h3>
            <p className="text-indigo-800 text-xs md:text-sm mb-2 md:mb-3">
              Halaman ini menampilkan semua user yang terdaftar melalui Telegram bot. Anda dapat mengelola user dengan fitur berikut:
            </p>
            <div className="bg-white rounded p-3 text-xs text-gray-700 space-y-1.5">
              <p><strong>Detail:</strong> Lihat informasi lengkap user (ID, username, nama, bahasa, aktivitas)</p>
              <p><strong>Edit:</strong> Ubah nama depan, nama belakang, username, dan bahasa user</p>
              <p><strong>Hapus:</strong> Hapus user beserta data favorites dan analytics terkait</p>
              <p className="text-amber-700 mt-2"><strong>Catatan:</strong> User yang memiliki riwayat order tidak dapat dihapus. Data akan diperbarui otomatis saat user berinteraksi dengan bot.</p>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* WEB TAB */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'web' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-indigo-600 hover:shadow-lg transition">
              <p className="text-gray-600 text-xs md:text-sm font-medium">Total User Web</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1 md:mt-2">{webUsers.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-green-600 hover:shadow-lg transition">
              <p className="text-green-700 text-xs md:text-sm font-medium">User Aktif</p>
              <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1 md:mt-2">{activeWebUsers}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6 border-l-4 border-red-500 hover:shadow-lg transition">
              <p className="text-red-600 text-xs md:text-sm font-medium">User Nonaktif</p>
              <p className="text-2xl md:text-3xl font-bold text-red-500 mt-1 md:mt-2">{inactiveWebUsers}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama, email, atau no. telepon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Pagination */}
          {filteredWebUsers.length > 0 && (
            <PaginationBar
              currentPage={currentPage} totalPages={totalPages} pageSize={pageSize}
              onPageChange={setCurrentPage} onPageSizeChange={setPageSize}
            />
          )}

          {/* Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filteredWebUsers.length === 0 ? (
              <div className="text-center py-12">
                <FiGlobe className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-600 text-lg font-medium mb-2">
                  {webUsers.length === 0 ? 'Belum Ada User Web Terdaftar' : 'Tidak Ada Hasil'}
                </p>
                <p className="text-gray-500 text-sm">
                  {webUsers.length === 0
                    ? 'User web akan muncul di sini setelah mereka mendaftar melalui halaman register web store'
                    : 'Coba ubah kata kunci pencarian Anda'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Nama</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Email</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">No. Telepon</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Status</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Terdaftar</th>
                        <th className="text-center px-6 py-3 font-semibold text-gray-900 text-sm">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(paginatedItems as WebUser[]).map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-3">
                            <button onClick={() => setDetailWebUser(user)} className="text-left hover:underline">
                              <p className="font-medium text-gray-900">{user.nama}</p>
                            </button>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">{user.email}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{user.phone}</td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {user.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600">
                            {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setDetailWebUser(user)}
                                title="Detail"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              >
                                <FiEye size={16} />
                              </button>
                              <button
                                onClick={() => setTogglingWebUser(user)}
                                title={user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                className={`p-1.5 rounded-lg transition ${
                                  user.is_active
                                    ? 'text-green-600 hover:bg-green-50'
                                    : 'text-red-500 hover:bg-red-50'
                                }`}
                              >
                                {user.is_active ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />}
                              </button>
                              <button
                                onClick={() => setEditingWebUser(user)}
                                title="Edit"
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              >
                                <FiEdit2 size={16} />
                              </button>
                              <button
                                onClick={() => setDeletingWebUser(user)}
                                title="Hapus"
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-gray-200">
                  {(paginatedItems as WebUser[]).map((user) => (
                    <div key={user.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <button onClick={() => setDetailWebUser(user)} className="text-left">
                          <p className="font-medium text-gray-900 text-base">{user.nama}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                        </button>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                          user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                        <div>
                          <span className="text-gray-500 text-xs">No. Telepon:</span>
                          <p className="text-gray-700">{user.phone}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Terdaftar:</span>
                          <p className="text-gray-700">
                            {new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => setDetailWebUser(user)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                        >
                          <FiEye size={14} /> Detail
                        </button>
                        <button
                          onClick={() => setTogglingWebUser(user)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            user.is_active
                              ? 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                              : 'text-green-700 bg-green-50 hover:bg-green-100'
                          }`}
                        >
                          {user.is_active ? <FiToggleLeft size={14} /> : <FiToggleRight size={14} />}
                          {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          onClick={() => setEditingWebUser(user)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
                        >
                          <FiEdit2 size={14} /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingWebUser(user)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition"
                        >
                          <FiTrash2 size={14} /> Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg shadow p-4 md:p-6 border border-indigo-200">
            <h3 className="text-base md:text-lg font-bold text-indigo-900 mb-2 md:mb-3">Manajemen User Web</h3>
            <p className="text-indigo-800 text-xs md:text-sm mb-2 md:mb-3">
              Halaman ini menampilkan semua user yang terdaftar melalui web store. Anda dapat mengelola user dengan fitur berikut:
            </p>
            <div className="bg-white rounded p-3 text-xs text-gray-700 space-y-1.5">
              <p><strong>Detail:</strong> Lihat informasi lengkap user (ID, email, telepon, status, tanggal registrasi)</p>
              <p><strong>Edit:</strong> Ubah nama, email, atau nomor telepon user</p>
              <p><strong>Aktifkan/Nonaktifkan:</strong> Kontrol akses login user ke web store</p>
              <p><strong>Hapus:</strong> Hapus user yang belum memiliki riwayat order</p>
              <p className="text-amber-700 mt-2"><strong>Catatan:</strong> User yang memiliki riwayat order tidak dapat dihapus, hanya bisa dinonaktifkan.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Pagination Component ────────────────────────────────────────
function PaginationBar({ currentPage, totalPages, pageSize, onPageChange, onPageSizeChange }: {
  currentPage: number; totalPages: number; pageSize: number
  onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-800">
          Halaman {currentPage} dari {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700">Per halaman</label>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
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
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 disabled:text-gray-400 disabled:opacity-60"
        >
          <FiChevronLeft size={14} /> Prev
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 disabled:text-gray-400 disabled:opacity-60"
        >
          Next <FiChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
