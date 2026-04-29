'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/components/CartProvider'
import { useAuth } from '@/components/AuthProvider'

export default function BottomNav() {
  const pathname = usePathname()
  const { itemCount } = useCart()
  const { user } = useAuth()

  const navItems = [
    { href: '/', label: 'Beranda', icon: 'fa-house' },
    { href: '/cart', label: 'Keranjang', icon: 'fa-shopping-cart' },
    { href: '/orders', label: 'Riwayat', icon: 'fa-receipt' },
    { href: user ? '/profile' : '/login', label: user ? 'Profil' : 'Masuk', icon: user ? 'fa-user' : 'fa-right-to-bracket' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg md:hidden z-50">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href === '/login' && (pathname === '/login' || pathname === '/register')) ||
            (item.href === '/profile' && pathname === '/profile')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors ${
                isActive
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="relative inline-flex">
                {item.href === '/profile' && user ? (
                  <span className="w-6 h-6 bg-[#5c63f2] rounded-full flex items-center justify-center text-white text-[10px] font-bold mb-1">
                    {user.nama.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <i className={`fa-solid ${item.icon} text-xl mb-1`}></i>
                )}
                {item.href === '/cart' && itemCount > 0 && (
                  <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-[#5c63f2] text-white text-[10px] font-bold flex items-center justify-center">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium text-center">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
