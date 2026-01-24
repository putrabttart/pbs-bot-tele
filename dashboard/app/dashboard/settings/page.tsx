'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiLogOut, FiMail, FiKey, FiSave, FiSettings as FiSettingsIcon } from 'react-icons/fi'
import { useRouter } from 'next/navigation'
import { getSettings, updateSettings, AppSettings } from '@/lib/settings'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [storeSettings, setStoreSettings] = useState<AppSettings | null>(null)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user)
        
        // Load store settings
        const settings = await getSettings()
        setStoreSettings(settings)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage('')

    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters')
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error
      setPasswordMessage('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMessage(''), 3000)
    } catch (error: any) {
      setPasswordMessage(error.message || 'Failed to update password')
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeSettings) return

    setSavingSettings(true)
    setSettingsMessage('')

    try {
      await updateSettings(storeSettings, user?.id)
      setSettingsMessage('Settings saved successfully!')
      setTimeout(() => setSettingsMessage(''), 3000)
    } catch (error: any) {
      setSettingsMessage(error.message || 'Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  if (loading || !storeSettings) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-xl md:text-2xl font-bold text-gray-900">Settings</h1>

      {/* Store Settings Cards - 2 column grid on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information Card */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiSettingsIcon /> Basic Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Store Name
              </label>
              <input
                type="text"
                value={storeSettings.store_name}
                onChange={(e) => setStoreSettings({ ...storeSettings, store_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Putra Btt Store"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Store Description
              </label>
              <textarea
                value={storeSettings.store_description}
                onChange={(e) => setStoreSettings({ ...storeSettings, store_description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Toko Digital Terpercaya #1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Support Contact
              </label>
              <input
                type="text"
                value={storeSettings.support_contact}
                onChange={(e) => setStoreSettings({ ...storeSettings, support_contact: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., @username or +62xxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Catalog Banner URL
              </label>
              <input
                type="url"
                value={storeSettings.catalog_banner_url}
                onChange={(e) => setStoreSettings({ ...storeSettings, catalog_banner_url: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://example.com/banner.jpg"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty to disable banner</p>
            </div>
          </div>
        </div>

        {/* Display Settings Card */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4">Display Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Items Per Page
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={storeSettings.items_per_page}
                onChange={(e) => setStoreSettings({ ...storeSettings, items_per_page: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Number of products per page (5-50)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Grid Columns
              </label>
              <input
                type="number"
                min="2"
                max="8"
                value={storeSettings.grid_cols}
                onChange={(e) => setStoreSettings({ ...storeSettings, grid_cols: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Product grid layout (2-8 columns)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment & Currency Settings - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Settings Card */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4">Payment Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Expiry (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="60"
                value={storeSettings.payment_ttl_minutes}
                onChange={(e) => setStoreSettings({ ...storeSettings, payment_ttl_minutes: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Auto-cancel unpaid orders after this time</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={storeSettings.currency}
                onChange={(e) => setStoreSettings({ ...storeSettings, currency: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="IDR">IDR (Indonesian Rupiah)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="MYR">MYR (Malaysian Ringgit)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Features Card */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4">Features</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition">
              <input
                type="checkbox"
                checked={storeSettings.enable_promo}
                onChange={(e) => setStoreSettings({ ...storeSettings, enable_promo: e.target.checked })}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Promo Codes</span>
                <p className="text-xs text-gray-500">Allow discount codes</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition">
              <input
                type="checkbox"
                checked={storeSettings.enable_referral}
                onChange={(e) => setStoreSettings({ ...storeSettings, enable_referral: e.target.checked })}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Referral System</span>
                <p className="text-xs text-gray-500">User referrals & rewards</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition">
              <input
                type="checkbox"
                checked={storeSettings.enable_analytics}
                onChange={(e) => setStoreSettings({ ...storeSettings, enable_analytics: e.target.checked })}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Analytics</span>
                <p className="text-xs text-gray-500">Track behavior & sales</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition">
              <input
                type="checkbox"
                checked={storeSettings.enable_favorites}
                onChange={(e) => setStoreSettings({ ...storeSettings, enable_favorites: e.target.checked })}
                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Favorites</span>
                <p className="text-xs text-gray-500">Save favorite products</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Save Settings Button */}
      {settingsMessage && (
        <div className={`p-3 rounded-lg text-sm ${
          settingsMessage.includes('successfully')
            ? 'bg-green-50 text-green-800'
            : 'bg-red-50 text-red-800'
        }`}>
          {settingsMessage}
        </div>
      )}
      
      <button
        onClick={handleSaveSettings}
        disabled={savingSettings}
        className="w-full lg:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium px-8 py-3 rounded-lg transition flex items-center justify-center gap-2"
      >
        <FiSave /> {savingSettings ? 'Saving Settings...' : 'Save All Settings'}
      </button>

      {/* Divider */}
      <div className="border-t border-gray-200 my-8"></div>

      {/* Account & Security - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Information Card */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiMail /> Account Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
              <input
                type="text"
                value={user?.id || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Member Since</label>
              <input
                type="text"
                value={user?.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FiKey /> Change Password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {passwordMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                passwordMessage.includes('successfully')
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}>
                {passwordMessage}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>

      {/* System & Logout - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Information Card */}
        <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-lg shadow p-4 md:p-6 border border-blue-200">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4">System Information</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex justify-between items-center py-2 border-b border-blue-100">
              <span>Dashboard Version:</span>
              <span className="font-mono font-semibold text-gray-900">1.0.0</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-blue-100">
              <span>Database:</span>
              <span className="font-mono font-semibold text-gray-900">Supabase PostgreSQL</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-blue-100">
              <span>Framework:</span>
              <span className="font-mono font-semibold text-gray-900">Next.js 14</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span>Last Updated:</span>
              <span className="font-mono font-semibold text-gray-900">{new Date().toLocaleDateString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Logout Card */}
        <div className="bg-linear-to-br from-red-50 to-orange-50 rounded-lg shadow p-4 md:p-6 border border-red-200">
          <h2 className="text-base md:text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
            <FiLogOut /> Sign Out
          </h2>
          <p className="text-red-800 text-sm mb-4">
            You will be logged out from this session and redirected to the login page.
          </p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-6 py-2.5 rounded-lg transition"
          >
            <FiLogOut /> Sign Out Now
          </button>
        </div>
      </div>
    </div>
  )
}
