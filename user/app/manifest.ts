import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Putra BTT Store',
    short_name: 'Putra BTT',
    description: 'Toko online Putra BTT Store dengan berbagai produk digital premium',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f1229',
    theme_color: '#5c63f2',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable'
      }
    ]
  }
}
