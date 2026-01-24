'use client'

export default function ProfilePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center py-20 bg-white rounded-lg shadow-md border border-gray-200">
        <div className="text-6xl text-gray-300 mb-4">
          <i className="fa-solid fa-user"></i>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Halaman Profil</h1>
        <p className="text-gray-600">
          Fitur profil akan segera hadir. Untuk saat ini, gunakan halaman{' '}
          <strong>Riwayat Pembelian</strong> untuk melihat pesanan Anda.
        </p>
      </div>
    </div>
  )
}
