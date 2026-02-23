'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/components/CartProvider'

export default function BottomNav() {
  const pathname = usePathname()
  const { itemCount } = useCart()

  const navItems = [
    { href: '/', label: 'Beranda', icon: 'fa-house' },
    { href: '/cart', label: 'Keranjang', icon: 'fa-shopping-cart' },
    { href: '/orders', label: 'Riwayat', icon: 'fa-receipt' },
    { href: '/profile', label: 'Profil', icon: 'fa-user' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg md:hidden z-50">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href
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
                <i className={`fa-solid ${item.icon} text-xl mb-1`}></i>
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
