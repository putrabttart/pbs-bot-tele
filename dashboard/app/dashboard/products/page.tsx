'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiDownload, FiCheckSquare, FiSquare, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import type { Database } from '@/lib/database.types'

type Product = Database['public']['Tables']['products']['Row']
type ProductWithItemCount = Product & { availableItems?: number; totalItems?: number }

export default function ProductsPage() {
  const supabase = createBrowserClient()
  const [products, setProducts] = useState<ProductWithItemCount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [nameSort, setNameSort] = useState<'az' | 'za'>('az')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showModal, setShowModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState<Database['public']['Tables']['products']['Insert']>({
    kode: '',
    nama: '',
    harga: 0,
    kategori: '',
    stok: 0,
    deskripsi: '',
    ikon: '',
    aktif: true,
    harga_lama: undefined,
    wa: undefined,
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, nameSort])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products', { method: 'GET' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to fetch products')
      setProducts(json?.data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 2200)
  }

  const toggleSelectAll = () => {
    const allSelectedOnPage = pageIds.length > 0 && pageIds.every(id => selectedProducts.has(id))
    if (allSelectedOnPage) {
      const next = new Set(selectedProducts)
      pageIds.forEach(id => next.delete(id))
      setSelectedProducts(next)
    } else {
      const next = new Set(selectedProducts)
      pageIds.forEach(id => next.add(id))
      setSelectedProducts(next)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedProducts.size === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedProducts.size} product(s)? This will also delete all associated items.`)) {
      return
    }

    try {
      // Delete product_items first
      const productIds = Array.from(selectedProducts)
      const { error: itemsError } = await supabase
        .from('product_items')
        .delete()
        .in('product_id', productIds)

      if (itemsError) throw itemsError

      // Delete products
      const { error: productsError } = await supabase
        .from('products')
        .delete()
        .in('id', productIds)

      if (productsError) throw productsError

      alert(`Successfully deleted ${selectedProducts.size} product(s)`)
      showToast(`Deleted ${selectedProducts.size} product(s)`)
      setSelectedProducts(new Set())
      fetchProducts()
    } catch (error) {
      console.error('Error batch deleting:', error)
      alert('Error deleting products')
    }
  }

  const exportToCSV = () => {
    const productsToExport = products.filter(p => selectedProducts.size === 0 || selectedProducts.has(p.id))
    if (productsToExport.length === 0) {
      alert('No products to export')
      return
    }

    const headers = ['Code', 'Name', 'Category', 'Price', 'Stock', 'Description', 'Available Items', 'Total Items']
    const rows = productsToExport.map(p => [
      p.kode,
      p.nama,
      p.kategori || '',
      p.harga,
      p.stok,
      p.deskripsi || '',
      p.availableItems || 0,
      p.totalItems || 0
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    downloadFile(csvContent, 'products.csv', 'text/csv')
  }

  const exportToTXT = () => {
    const productsToExport = products.filter(p => selectedProducts.size === 0 || selectedProducts.has(p.id))
    if (productsToExport.length === 0) {
      alert('No products to export')
      return
    }

    const txtContent = productsToExport.map(p => 
      `Code: ${p.kode}\nName: ${p.nama}\nCategory: ${p.kategori || '-'}\nPrice: Rp ${p.harga.toLocaleString('id-ID')}\nStock: ${p.stok}\nDescription: ${p.deskripsi || '-'}\nAvailable Items: ${p.availableItems || 0}\nTotal Items: ${p.totalItems || 0}\n${'-'.repeat(50)}`
    ).join('\n\n')

    downloadFile(txtContent, 'products.txt', 'text/plain')
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleAddNew = () => {
    setEditingProduct(null)
    setFormData({
      kode: '',
      nama: '',
      harga: 0,
      kategori: '',
      stok: 0,
      deskripsi: '',
      ikon: '',
      aktif: true,
      harga_lama: undefined,
      wa: undefined,
    })
    setShowModal(true)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      kode: product.kode,
      nama: product.nama,
      harga: product.harga,
      kategori: product.kategori || '',
      stok: product.stok,
      deskripsi: product.deskripsi || '',
      ikon: product.ikon || '',
      aktif: product.aktif !== undefined ? product.aktif : true,
      harga_lama: product.harga_lama || undefined,
      wa: product.wa || undefined,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product and all associated items?')) return

    try {
      const p = products.find(pr => pr.id === id)
      if (!p) throw new Error('Product not found')

      // Delete product_items (will cascade to other tables via FK)
      const { error: itemDelErr } = await supabase
        .from('product_items')
        .delete()
        .eq('product_code', p.kode)
      if (itemDelErr) throw itemDelErr

      // Delete order_items that reference this product
      const { error: orderItemDelErr } = await supabase
        .from('order_items')
        .delete()
        .eq('product_code', p.kode)
      if (orderItemDelErr) console.warn('Error deleting order_items:', orderItemDelErr)

      // Delete stock_reservations (will now cascade with the FK fix)
      const { error: reservDelErr } = await supabase
        .from('stock_reservations')
        .delete()
        .eq('product_id', id)
      if (reservDelErr) console.warn('Error deleting reservations:', reservDelErr)

      // Finally delete the product itself
      const { error: prodDelErr } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (prodDelErr) throw prodDelErr
      setProducts(products.filter(p => p.id !== id))
      alert('Product and all associated data deleted successfully')
      showToast('Product deleted successfully')
    } catch (error: any) {
      console.error('Error deleting product:', error)
      alert(`Failed to delete product: ${error.message}`)
    }
  }

  const handleQuickToggleActive = async (product: ProductWithItemCount) => {
    const nextActive = !(product.aktif === true)

    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, aktif: nextActive }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to update status')

      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, aktif: nextActive } : p)))
      showToast(`Produk ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}`)

      try {
        await fetch('/api/bot/refresh', { method: 'POST' })
      } catch (refreshErr) {
        console.warn('Failed to trigger bot refresh:', refreshErr)
      }
    } catch (error: any) {
      console.error('Error updating product status:', error)
      alert(`Failed to update product status: ${error?.message || 'Unknown error'}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        ...formData,
        kategori: formData.kategori || null,
        deskripsi: formData.deskripsi || null,
        ikon: formData.ikon || null,
        wa: formData.wa || null,
        harga_lama: formData.harga_lama ?? null,
      }

      if (editingProduct) {
        const res = await fetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProduct.id, ...payload }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to update product')
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to create product')
      }

      await fetchProducts()
      setShowModal(false)
      showToast(editingProduct ? 'Product updated successfully' : 'Product created successfully')
      
      // Trigger bot refresh
      try {
        await fetch('/api/bot/refresh', { method: 'POST' })
        console.log('✅ Bot refreshed after product update')
      } catch (refreshErr) {
        console.warn('⚠️ Failed to trigger bot refresh:', refreshErr)
      }
    } catch (error: any) {
      console.error('Error saving product:', error)
      const msg = error?.message || error?.details || error?.hint || JSON.stringify(error) || 'Unknown error'
      alert(`Failed to save product: ${msg}`)
    }
  }

  const filteredProducts = products
    .filter((p) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesQuery = p.nama.toLowerCase().includes(q) || p.kode.toLowerCase().includes(q)
      if (!matchesQuery) return false

      if (statusFilter === 'active') return p.aktif !== false
      if (statusFilter === 'inactive') return p.aktif === false
      return true
    })
    .sort((a, b) => {
      const compare = a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
      return nameSort === 'az' ? compare : -compare
    })

  const activeCount = products.filter((p) => p.aktif !== false).length
  const inactiveCount = products.filter((p) => p.aktif === false).length
  const totalAvailableItems = products.reduce((sum, p) => sum + (p.availableItems || 0), 0)
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageIds = paginatedProducts.map(p => p.id)
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every(id => selectedProducts.has(id))

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, Math.max(1, totalPages)))
  }, [totalPages])

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>
  }

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          {toastMessage}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Products Management</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm md:text-base"
            title="Upload CSV/TXT"
          >
            <FiPlus /> <span className="whitespace-nowrap">Upload Batch</span>
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition text-sm md:text-base"
          >
            <FiPlus /> <span className="whitespace-nowrap">Add Product</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-600 hover:shadow-lg transition">
          <p className="text-xs text-gray-500">Total Products</p>
          <p className="text-lg font-bold text-gray-900">{products.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-600 hover:shadow-lg transition">
          <p className="text-xs text-gray-500">Active</p>
          <p className="text-lg font-bold text-emerald-700">{activeCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500 hover:shadow-lg transition">
          <p className="text-xs text-gray-500">Inactive</p>
          <p className="text-lg font-bold text-gray-700">{inactiveCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600 hover:shadow-lg transition">
          <p className="text-xs text-gray-500">Available Items</p>
          <p className="text-lg font-bold text-blue-700">{totalAvailableItems}</p>
        </div>
      </div>

      {/* Batch Actions */}
      {selectedProducts.size > 0 && (
        <div className="bg-indigo-50/95 border border-indigo-200 rounded-lg p-4 md:p-6 space-y-3 sticky bottom-4 z-20 backdrop-blur">
          <p className="text-indigo-900 font-medium">
            ✓ {selectedProducts.size} product(s) selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedProducts(new Set())}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg transition text-sm font-medium border border-gray-300"
            >
              Clear Selection
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              <FiDownload /> Export CSV
            </button>
            <button
              onClick={exportToTXT}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              <FiDownload /> Export TXT
            </button>
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              <FiTrash2 /> Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Export All Options */}
      {selectedProducts.size === 0 && products.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 md:p-6 space-y-4">
          <p className="text-sm font-semibold text-gray-900">Export All Products</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              <FiDownload /> Export All to CSV
            </button>
            <button
              onClick={exportToTXT}
              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              <FiDownload /> Export All to TXT
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">Search Products</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base bg-white"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{filteredProducts.length} result(s)</p>
          </div>

          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">Filter & Sort</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Filter status produk"
              >
                <option value="all">Semua</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>

              <select
                value={nameSort}
                onChange={(e) => setNameSort(e.target.value as 'az' | 'za')}
                className="h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Urutkan nama produk"
              >
                <option value="az">Nama A-Z</option>
                <option value="za">Nama Z-A</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {products.length === 0 ? (
              <div className="space-y-4">
                <p className="font-medium">No products yet</p>
                <p className="text-sm text-gray-500">Add products manually or upload a batch file to get started.</p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={handleAddNew}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
                  >
                    Add Product
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm"
                  >
                    Upload Batch
                  </button>
                </div>
              </div>
            ) : (
              'No products match your filter'
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-white">
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

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 hover:bg-gray-200 rounded transition"
                        title={allSelectedOnPage ? 'Deselect Page' : 'Select Page'}
                      >
                        {allSelectedOnPage ? (
                          <FiCheckSquare className="text-indigo-600" size={18} />
                        ) : (
                          <FiSquare className="text-gray-400" size={18} />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Code</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Name</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Category</th>
                    <th className="text-center px-6 py-3 font-semibold text-gray-900">Status</th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-900">Price</th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-900">Items (Available / Total)</th>
                    <th className="text-center px-6 py-3 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedProducts.map((product) => (
                    <tr key={product.id} className={`hover:bg-gray-50 transition ${
                      selectedProducts.has(product.id) ? 'bg-indigo-50' : ''
                    }`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelectProduct(product.id)}
                          className="p-1 hover:bg-gray-200 rounded transition"
                        >
                          {selectedProducts.has(product.id) ? (
                            <FiCheckSquare className="text-indigo-600" size={18} />
                          ) : (
                            <FiSquare className="text-gray-400" size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-mono text-sm text-gray-700">{product.kode}</span>
                      </td>
                      <td className="px-6 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{product.nama}</p>
                          {product.deskripsi && (
                            <p className="text-xs text-gray-500 mt-1">{product.deskripsi}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-700">
                        {product.kategori || '-'}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          product.aktif === false ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {product.aktif === false ? 'Nonaktif' : 'Aktif'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="font-semibold text-gray-900">
                          Rp {product.harga.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          (product.availableItems || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {product.availableItems || 0} / {product.totalItems || 0}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            onClick={() => handleQuickToggleActive(product)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                              product.aktif === true ? 'bg-emerald-600' : 'bg-gray-400'
                            }`}
                            title={product.aktif === true ? 'Nonaktifkan produk' : 'Aktifkan produk'}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                product.aktif === true ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {paginatedProducts.map((product) => (
                <div key={product.id} className={`p-4 hover:bg-gray-50 ${
                  selectedProducts.has(product.id) ? 'bg-indigo-50' : ''
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => toggleSelectProduct(product.id)}
                        className="mt-1 p-1 hover:bg-gray-200 rounded transition"
                      >
                        {selectedProducts.has(product.id) ? (
                          <FiCheckSquare className="text-indigo-600" size={18} />
                        ) : (
                          <FiSquare className="text-gray-400" size={18} />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{product.nama}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            product.aktif === false ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {product.aktif === false ? 'Nonaktif' : 'Aktif'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-mono mt-1">{product.kode}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => handleQuickToggleActive(product)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                          product.aktif === true ? 'bg-emerald-600' : 'bg-gray-400'
                        }`}
                        title={product.aktif === true ? 'Nonaktifkan produk' : 'Aktifkan produk'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            product.aktif === true ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Edit"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {product.deskripsi && (
                    <p className="text-xs text-gray-500 mb-2">{product.deskripsi}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                    <div>
                      <span className="text-gray-500 text-xs">Category:</span>
                      <p className="text-gray-700 font-medium">{product.kategori || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Price:</span>
                      <p className="text-gray-900 font-semibold">Rp {product.harga.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-gray-500 text-xs">Stock:</span>
                    <div className="mt-1">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        (product.availableItems || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {product.availableItems || 0} / {product.totalItems || 0} items
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">Kelola data produk dan status aktif produk.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <FiX className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.kode}
                  onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Example: PAKET-30H (unique per product)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Descriptive product name shown to users.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.kategori || ''}
                  onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: e.g., Internet, Voucher, Subscription.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (IDR)</label>
                <input
                  type="number"
                  value={formData.harga}
                  onChange={(e) => setFormData({ ...formData, harga: Number(e.target.value) })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Numeric only. Example: 15000</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                <input
                  type="number"
                  value={formData.stok}
                  onChange={(e) => setFormData({ ...formData, stok: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional for non-item products. Leave 0 if managed by items.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.deskripsi || ''}
                  onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: brief details or usage instructions.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <input
                  type="text"
                  value={formData.ikon || ''}
                  onChange={(e) => setFormData({ ...formData, ikon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: emoji or icon URL (e.g., 🎬 or https://...)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Old Price (IDR)</label>
                <input
                  type="number"
                  value={formData.harga_lama || ''}
                  onChange={(e) => setFormData({ ...formData, harga_lama: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: used to show discount/price comparison.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Contact</label>
                <input
                  type="text"
                  value={formData.wa || ''}
                  onChange={(e) => setFormData({ ...formData, wa: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: WhatsApp number or URL for inquiries (e.g., +62812345678 or https://wa.me/...)</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                  <input
                    type="checkbox"
                    checked={formData.aktif !== false}
                    onChange={(e) => setFormData({ ...formData, aktif: e.target.checked })}
                    className="w-4 h-4 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                  <span>Product Active</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Uncheck to deactivate product (it won't appear in searches)</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition shadow-sm"
                >
                  {editingProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Upload Products (CSV/TXT)</h2>
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <FiX className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">Format columns (with header):</p>
              <pre className="bg-gray-100 p-3 rounded text-xs text-gray-800 overflow-auto">kode,nama,harga,kategori,stok,deskripsi\nPAKET-30H,Paket Internet 30 Hari,50000,Internet,0,Kuota 10GB per 30 hari\nVCHR-XYZ,Voucher Game XYZ,15000,Game,0,Kode voucher XYZ</pre>
              <input
                type="file"
                accept=".csv,.txt"
                className="block w-full text-sm text-gray-700"
                onChange={async (e) => {
                  setUploadError(null)
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const text = await file.text()
                    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
                    if (lines.length < 2) throw new Error('No data rows')
                    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
                    const idx = (name: string) => header.indexOf(name)
                    const required = ['kode','nama','harga']
                    for (const r of required) if (idx(r) === -1) throw new Error(`Missing column: ${r}`)
                    const rows = lines.slice(1).map((line) => line.split(',').map(c => c.trim()))
                    const inserts = rows.map(cols => ({
                      kode: cols[idx('kode')] || '',
                      nama: cols[idx('nama')] || '',
                      harga: Number(cols[idx('harga')] || 0),
                      kategori: idx('kategori') !== -1 ? (cols[idx('kategori')] || null) : null,
                      stok: idx('stok') !== -1 ? Number(cols[idx('stok')] || 0) : 0,
                      deskripsi: idx('deskripsi') !== -1 ? (cols[idx('deskripsi')] || null) : null,
                    }))
                    const invalid = inserts.find(p => !p.kode || !p.nama || isNaN(p.harga))
                    if (invalid) throw new Error('Invalid row detected')
                    const { error } = await supabase.from('products').insert(inserts as any)
                    if (error) throw error
                    await fetchProducts()
                    setShowUploadModal(false)
                    alert(`Uploaded ${inserts.length} products successfully`)
                  } catch (err: any) {
                    console.error('Upload error:', err)
                    setUploadError(err.message || 'Upload failed')
                  }
                }}
              />
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{uploadError}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
