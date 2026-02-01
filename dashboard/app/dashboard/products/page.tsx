'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiDownload, FiCheckSquare, FiSquare } from 'react-icons/fi'
import type { Database } from '@/lib/database.types'

type Product = Database['public']['Tables']['products']['Row']
type ProductWithItemCount = Product & { availableItems?: number; totalItems?: number }

export default function ProductsPage() {
  const supabase = createBrowserClient()
  const [products, setProducts] = useState<ProductWithItemCount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
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
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (productsError) throw productsError
      
      // Fetch item counts for each product
      if (productsData && productsData.length > 0) {
        const { data: itemCounts, error: itemsError } = await supabase
          .from('product_items')
          .select('product_code, status', { count: 'exact' })

        if (!itemsError && itemCounts) {
          const countsMap = new Map<string, { available: number; total: number }>()
          itemCounts.forEach((item: any) => {
            const key = item.product_code
            if (!countsMap.has(key)) {
              countsMap.set(key, { available: 0, total: 0 })
            }
            const counts = countsMap.get(key)!
            counts.total++
            if (item.status === 'available') counts.available++
          })

          const enrichedProducts = productsData.map(p => ({
            ...p,
            availableItems: countsMap.get(p.kode)?.available || 0,
            totalItems: countsMap.get(p.kode)?.total || 0,
          }))
          setProducts(enrichedProducts)
        } else {
          setProducts(productsData)
        }
      } else {
        setProducts(productsData || [])
      }
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

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)))
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
    } catch (error: any) {
      console.error('Error deleting product:', error)
      alert(`Failed to delete product: ${error.message}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingProduct) {
        // Update
        const { error: updateError } = await supabase
          .from('products')
          .update(formData as any)
          .eq('id', editingProduct.id)

        if (updateError) throw updateError
      } else {
        // Create
        const { error: insertError } = await supabase
          .from('products')
          .insert([formData] as any)

        if (insertError) throw insertError
      }

      await fetchProducts()
      setShowModal(false)
      
      // Trigger bot refresh
      try {
        await fetch('/api/bot/refresh', { method: 'POST' })
        console.log('✅ Bot refreshed after product update')
      } catch (refreshErr) {
        console.warn('⚠️ Failed to trigger bot refresh:', refreshErr)
      }
    } catch (error: any) {
      console.error('Error saving product:', error)
      alert('Failed to save product')
    }
  }

  const filteredProducts = products.filter(
    p =>
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kode.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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

      {/* Batch Actions */}
      {selectedProducts.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-indigo-900 font-medium">
            {selectedProducts.size} product(s) selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedProducts(new Set())}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg transition text-sm border border-gray-300"
            >
              Clear Selection
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition text-sm"
            >
              <FiDownload /> Export CSV
            </button>
            <button
              onClick={exportToTXT}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition text-sm"
            >
              <FiDownload /> Export TXT
            </button>
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition text-sm"
            >
              <FiTrash2 /> Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Export All Options */}
      {selectedProducts.size === 0 && products.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition text-sm"
          >
            <FiDownload /> Export All to CSV
          </button>
          <button
            onClick={exportToTXT}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition text-sm"
          >
            <FiDownload /> Export All to TXT
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'No products found' : 'No products yet. Add your first product!'}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="p-1 hover:bg-gray-200 rounded transition"
                        title={selectedProducts.size === filteredProducts.length ? 'Deselect All' : 'Select All'}
                      >
                        {selectedProducts.size === filteredProducts.length ? (
                          <FiCheckSquare className="text-indigo-600" size={18} />
                        ) : (
                          <FiSquare className="text-gray-400" size={18} />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Code</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Name</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Category</th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-900">Price</th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-900">Items (Available / Total)</th>
                    <th className="text-center px-6 py-3 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
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
                        <div className="flex gap-2 justify-center">
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
              {filteredProducts.map((product) => (
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
                        <p className="font-medium text-gray-900">{product.nama}</p>
                        <p className="text-xs text-gray-500 font-mono mt-1">{product.kode}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                >
                  {editingProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Upload Products (CSV/TXT)</h2>
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(null); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
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
