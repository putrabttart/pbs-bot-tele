import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Putra BTT Store - Dashboard',
    short_name: 'PBS Dashboard',
    description: 'Dashboard untuk mengelola Putra BTT Store Bot dan WEB',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0f1229',
    theme_color: '#5c63f2',
    icons: [
      {
        src: '/icons/favicon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  }
}
