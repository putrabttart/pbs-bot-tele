'use client'

import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin h-10 w-10 border-3 border-[#5c63f2] border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500 text-sm">Memuat profil...</p>
        </div>
      </div>
    )
  }

  // Not logged in - show login/register options
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-user text-gray-400 text-3xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-[#1c2340]">Akun Saya</h1>
            <p className="text-gray-500 text-sm mt-1">
              Masuk atau daftar untuk mengakses fitur lengkap
            </p>
          </div>

          {/* Benefits */}
          <div className="bg-gradient-to-br from-[#f2f3ff] to-[#ecebff] rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-[#1c2340] mb-3 flex items-center gap-2">
              <i className="fa-solid fa-star text-[#7b5cf7]"></i>
              Keuntungan Punya Akun
            </h3>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5">
                <i className="fa-solid fa-circle-check text-green-500 mt-0.5 flex-shrink-0"></i>
                <span className="text-sm text-gray-700">Lihat riwayat semua pesanan Anda dari database</span>
              </li>
              <li className="flex items-start gap-2.5">
                <i className="fa-solid fa-circle-check text-green-500 mt-0.5 flex-shrink-0"></i>
                <span className="text-sm text-gray-700">Akses riwayat dari perangkat mana saja</span>
              </li>
              <li className="flex items-start gap-2.5">
                <i className="fa-solid fa-circle-check text-green-500 mt-0.5 flex-shrink-0"></i>
                <span className="text-sm text-gray-700">Data pesanan tersimpan aman di server</span>
              </li>
              <li className="flex items-start gap-2.5">
                <i className="fa-solid fa-circle-check text-green-500 mt-0.5 flex-shrink-0"></i>
                <span className="text-sm text-gray-700">Checkout lebih cepat dengan data tersimpan</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full bg-gradient-to-r from-[#5c63f2] to-[#7b5cf7] text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-[#5c63f2]/25 transition-all text-center"
            >
              <i className="fa-solid fa-right-to-bracket mr-2"></i>
              Masuk
            </Link>
            <Link
              href="/register"
              className="block w-full bg-white border-2 border-[#5c63f2] text-[#5c63f2] py-3 rounded-xl font-semibold hover:bg-[#f2f3ff] transition-all text-center"
            >
              <i className="fa-solid fa-user-plus mr-2"></i>
              Daftar Akun Baru
            </Link>
          </div>

          {/* Info */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <i className="fa-solid fa-circle-info text-amber-500 mt-0.5"></i>
              <p className="text-xs text-amber-700">
                Pendaftaran bersifat opsional. Anda tetap bisa berbelanja tanpa akun, 
                namun riwayat pesanan hanya bisa dilihat jika sudah login.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Logged in - show profile
  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
        {/* Profile Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-[#5c63f2] to-[#7b5cf7] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-3xl font-bold">
              {user.nama.charAt(0).toUpperCase()}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#1c2340]">{user.nama}</h1>
          <p className="text-gray-500 text-sm mt-1">Akun Terdaftar</p>
        </div>

        {/* User Info */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-envelope text-blue-600 text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-800 truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-phone text-green-600 text-sm"></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Nomor HP</p>
              <p className="text-sm font-medium text-gray-800">{user.phone}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3 mb-6">
          <Link
            href="/orders"
            className="flex items-center gap-3 w-full bg-gradient-to-r from-[#f2f3ff] to-[#ecebff] hover:from-[#e8e9ff] hover:to-[#e0dfff] p-4 rounded-xl transition-all group"
          >
            <div className="w-10 h-10 bg-[#5c63f2] rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-receipt text-white"></i>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#1c2340]">Riwayat Pesanan</p>
              <p className="text-xs text-gray-500">Lihat semua pesanan Anda</p>
            </div>
            <i className="fa-solid fa-chevron-right text-gray-400 group-hover:text-[#5c63f2] transition-colors"></i>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-3 w-full bg-gray-50 hover:bg-gray-100 p-4 rounded-xl transition-all group"
          >
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-bag-shopping text-white"></i>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#1c2340]">Belanja</p>
              <p className="text-xs text-gray-500">Lihat katalog produk</p>
            </div>
            <i className="fa-solid fa-chevron-right text-gray-400 group-hover:text-gray-600 transition-colors"></i>
          </Link>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-white border-2 border-red-200 text-red-600 py-3 rounded-xl font-semibold hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-right-from-bracket"></i>
          Keluar
        </button>
      </div>
    </div>
  )
}
