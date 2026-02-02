'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { FiPlus, FiTrash2, FiSearch, FiX, FiCopy, FiCheck, FiDownload, FiCheckSquare, FiSquare, FiArrowDown, FiMoreVertical, FiChevronLeft, FiChevronRight, FiInfo } from 'react-icons/fi'
import type { Database } from '@/lib/database.types'

type Product = Database['public']['Tables']['products']['Row']
type ProductItem = Database['public']['Tables']['product_items']['Row']

type SortOption = 'recent' | 'oldest' | 'available' | 'sold' | 'reserved'
type StatusFilter = 'all' | 'available' | 'reserved' | 'sold'

export default function ProductItemsPage() {
  const supabase = createBrowserClient()
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<ProductItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [newItems, setNewItems] = useState('')
  const [batchName, setBatchName] = useState('')
  const [itemNotes, setItemNotes] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusChangeTarget, setStatusChangeTarget] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState<'available' | 'sold'>('available')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (selectedProduct) {
      fetchItems(selectedProduct)
      setCurrentPage(1)
      setSelectedItems(new Set())
    }
  }, [selectedProduct])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, sortBy])

  const fetchProducts = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .order('nama')
        .returns<Product[]>()

      if (fetchError) throw fetchError
      setProducts(data || [])
      if (data && data.length > 0) {
        setSelectedProduct(data[0].kode)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchItems = async (productCode: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('product_items')
        .select('*')
        .eq('product_code', productCode)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setItems(data || [])
    } catch (error) {
      console.error('Error fetching items:', error)
    }
  }

  const toggleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const toggleSelectAll = () => {
    const pageIds = paginatedItems.map(i => i.id)
    const allSelectedOnPage = pageIds.every(id => selectedItems.has(id))
    if (allSelectedOnPage) {
      const next = new Set(selectedItems)
      pageIds.forEach(id => next.delete(id))
      setSelectedItems(next)
    } else {
      const next = new Set(selectedItems)
      pageIds.forEach(id => next.add(id))
      setSelectedItems(next)
    }
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 2200)
  }

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const splitRegex = new RegExp(`(${escaped})`, 'ig')
    const testRegex = new RegExp(`^${escaped}$`, 'i')
    const parts = text.split(splitRegex)
    return parts.map((part, idx) =>
      testRegex.test(part) ? (
        <mark key={idx} className="bg-yellow-100 text-gray-900 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        <span key={idx}>{part}</span>
      )
    )
  }

  const handleBatchDelete = async () => {
    if (selectedItems.size === 0) return
    setShowBatchDeleteModal(true)
  }

  const confirmBatchDelete = async () => {
    const availableItemsSelected = Array.from(selectedItems).filter(id => {
      const item = items.find(i => i.id === id)
      return item?.status === 'available'
    })

    if (availableItemsSelected.length === 0) {
      alert('Only available items can be deleted. Selected items are not available.')
      return
    }

    try {
      const { error } = await supabase
        .from('product_items')
        .delete()
        .in('id', availableItemsSelected)

      if (error) throw error

      alert(`Successfully deleted ${availableItemsSelected.length} item(s)`)
      setSelectedItems(new Set())
      setShowBatchDeleteModal(false)
      fetchItems(selectedProduct)
    } catch (error) {
      console.error('Error batch deleting:', error)
      alert('Error deleting items')
    }
  }

  const exportToCSV = () => {
    const itemsToExport = items.filter(i => selectedItems.size === 0 || selectedItems.has(i.id))
    if (itemsToExport.length === 0) {
      alert('No items to export')
      return
    }

    const headers = ['Product Code', 'Item Data', 'Status', 'Batch', 'Notes', 'Created At']
    const rows = itemsToExport.map(i => [
      i.product_code,
      i.item_data,
      i.status,
      i.batch || '',
      i.notes || '',
      new Date(i.created_at).toLocaleString('id-ID')
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    downloadFile(csvContent, `items_${selectedProduct}.csv`, 'text/csv')
  }

  const exportToTXT = () => {
    const itemsToExport = items.filter(i => selectedItems.size === 0 || selectedItems.has(i.id))
    if (itemsToExport.length === 0) {
      alert('No items to export')
      return
    }

    // Simple format: one item per line
    const txtContent = itemsToExport.map(i => i.item_data).join('\n')
    downloadFile(txtContent, `items_${selectedProduct}.txt`, 'text/plain')
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

  const handleAddItems = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedProduct || !newItems.trim()) {
      alert('Please select a product and enter items')
      return
    }

    try {
      const product = products.find(p => p.kode === selectedProduct)
      if (!product) throw new Error('Product not found')

      const itemLines = newItems
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      const itemsToInsert = itemLines.map(itemData => ({
        product_id: product.id,
        product_code: product.kode,
        item_data: itemData,
        status: 'available' as const,
        batch: batchName.trim() || null,
        notes: itemNotes.trim() || null,
      }))

      const { error: insertError } = await supabase
        .from('product_items')
        .insert(itemsToInsert as any)

      if (insertError) throw insertError

      setNewItems('')
      setBatchName('')
      setItemNotes('')
      setShowAddModal(false)
      await fetchItems(selectedProduct)
      alert(`Successfully added ${itemLines.length} items!`)
      
      // Trigger bot refresh
      try {
        await fetch('/api/bot/refresh', { method: 'POST' })
        console.log('✅ Bot refreshed after adding items')
      } catch (refreshErr) {
        console.warn('⚠️ Failed to trigger bot refresh:', refreshErr)
      }
    } catch (error: any) {
      console.error('Error adding items:', error)
      alert('Failed to add items: ' + error.message)
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const { error: deleteError } = await supabase
        .from('product_items')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setItems(items.filter(i => i.id !== id))
    } catch (error: any) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item')
    }
  }

  const handleCopyItem = (itemData: string, id: string) => {
    navigator.clipboard.writeText(itemData)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    showToast('Copied to clipboard')
  }

  const handleStatusChange = async (itemId: string, currentStatus: string) => {
    const newStat = currentStatus === 'available' ? 'sold' : 'available'
    setStatusChangeTarget(itemId)
    setNewStatus(newStat as any)
    setShowStatusModal(true)
  }

  const handleBatchStatusChange = () => {
    if (selectedItems.size === 0) {
      alert('Please select items first')
      return
    }
    setStatusChangeTarget('batch')
    setShowStatusModal(true)
  }

  const confirmStatusChange = async () => {
    try {
      if (statusChangeTarget === 'batch') {
        // Batch update
        const { error } = await supabase
          .from('product_items')
          .update({ status: newStatus })
          .in('id', Array.from(selectedItems))

        if (error) throw error
        alert(`Successfully updated ${selectedItems.size} item(s) to ${newStatus}`)
        setSelectedItems(new Set())
      } else if (statusChangeTarget) {
        // Single update
        const { error } = await supabase
          .from('product_items')
          .update({ status: newStatus })
          .eq('id', statusChangeTarget)

        if (error) throw error
        alert(`Status updated to ${newStatus}`)
      }

      setShowStatusModal(false)
      setStatusChangeTarget(null)
      await fetchItems(selectedProduct)
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    }
  }

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return items.filter(item => {
      const matchesQuery =
        item.item_data.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query)

      const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [items, searchQuery, statusFilter])

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      switch (sortBy) {
        case 'recent': {
          if (a.status === 'sold' && b.status !== 'sold') return 1
          if (a.status !== 'sold' && b.status === 'sold') return -1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }
        case 'oldest': {
          if (a.status === 'sold' && b.status !== 'sold') return 1
          if (a.status !== 'sold' && b.status === 'sold') return -1
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        }
        case 'available':
          if (a.status === 'available' && b.status !== 'available') return -1
          if (a.status !== 'available' && b.status === 'available') return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'sold':
          if (a.status === 'sold' && b.status !== 'sold') return -1
          if (a.status !== 'sold' && b.status === 'sold') return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'reserved':
          if (a.status === 'reserved' && b.status !== 'reserved') return -1
          if (a.status !== 'reserved' && b.status === 'reserved') return 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default:
          return 0
      }
    })
  }, [filteredItems, sortBy])

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedItems.slice(start, start + pageSize)
  }, [sortedItems, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, Math.max(1, totalPages)))
  }, [totalPages])

  const selectedProductData = products.find(p => p.kode === selectedProduct)
  const availableCount = items.filter(i => i.status === 'available').length
  const reservedCount = items.filter(i => i.status === 'reserved').length
  const soldCount = items.filter(i => i.status === 'sold').length
  const pageIds = paginatedItems.map(i => i.id)
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every(id => selectedItems.has(id))
  const selectedAvailableCount = Array.from(selectedItems).filter(id => {
    const item = items.find(i => i.id === id)
    return item?.status === 'available'
  }).length

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
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
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Product Items</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm md:text-base"
          >
            <FiPlus /> <span className="whitespace-nowrap">Upload Batch</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition text-sm md:text-base"
          >
            <FiPlus /> <span className="whitespace-nowrap">Add Items</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Total Items</p>
          <p className="text-lg font-bold text-gray-900">{items.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Available</p>
          <p className="text-lg font-bold text-green-700">{availableCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Reserved</p>
          <p className="text-lg font-bold text-yellow-700">{reservedCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Sold</p>
          <p className="text-lg font-bold text-blue-700">{soldCount}</p>
        </div>
      </div>

      {/* Product Selector */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6">
        <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">Select Product</label>
        <select
          value={selectedProduct}
          onChange={(e) => {
            setSelectedProduct(e.target.value)
            setSelectedItems(new Set())
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:text-base"
        >
          {products.map(product => (
            <option key={product.id} value={product.kode}>
              {product.nama} ({product.kode})
            </option>
          ))}
        </select>
      </div>

      {/* Batch Actions */}
      {selectedItems.size > 0 && (
        <div className="bg-indigo-50/95 border border-indigo-200 rounded-lg p-4 md:p-6 space-y-3 sticky bottom-4 z-20 backdrop-blur">
          <p className="text-indigo-900 font-semibold text-sm md:text-base">
            ✓ {selectedItems.size} item(s) selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedItems(new Set())}
              className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg transition text-sm font-medium border border-gray-300"
            >
              <FiX size={16} /> Clear
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              <FiDownload size={16} /> Export CSV
            </button>
            <button
              onClick={exportToTXT}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              <FiDownload size={16} /> Export TXT
            </button>
            <button
              onClick={handleBatchStatusChange}
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              Change Status
            </button>
            <button
              onClick={handleBatchDelete}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition text-sm font-medium"
            >
              <FiTrash2 size={16} /> Delete Available
            </button>
          </div>
        </div>
      )}

      {/* Export All Options & Search/Sort */}
      {items.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 md:p-6 space-y-4">
          {/* Export Options */}
          {selectedItems.size === 0 && (
            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Export All Items</p>
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

          {/* Search & Sort */}
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">Search & Filter</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Search Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Search Items</label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-2.5 text-gray-400 text-sm" />
                  <input
                    type="text"
                    placeholder="Search items or notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-2 p-1 text-gray-400 hover:text-gray-600"
                      title="Clear"
                    >
                      <FiX size={14} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {sortedItems.length} result(s)
                </p>
              </div>

              {/* Sort Dropdown */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <FiArrowDown size={14} /> Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="recent">Recent (Newest First)</option>
                  <option value="oldest">Oldest (Oldest First)</option>
                  <option value="available">Available Items First</option>
                  <option value="sold">Sold Items First</option>
                  <option value="reserved">Reserved Items First</option>
                </select>
              </div>
            </div>

            {/* Status Filter */}
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-700 mb-2">Status Filter</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'available', label: 'Available' },
                  { key: 'reserved', label: 'Reserved' },
                  { key: 'sold', label: 'Sold' },
                ].map(option => (
                  <button
                    key={option.key}
                    onClick={() => setStatusFilter(option.key as StatusFilter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      statusFilter === option.key
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {sortedItems.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-lg shadow p-4">
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
      )}

      {/* Items List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {sortedItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {items.length === 0 ? (
              <div className="space-y-4">
                <p className="font-medium">No items for this product yet</p>
                <p className="text-sm text-gray-500">
                  Add items manually or upload a batch file to get started.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
                  >
                    Add Items
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm"
                  >
                    Upload Batch
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  Example: user1@gmail.com:pass123
                </div>
              </div>
            ) : (
              'No items match your search'
            )}
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
                        title={allSelectedOnPage ? 'Deselect Page' : 'Select Page'}
                      >
                        {allSelectedOnPage ? (
                          <FiCheckSquare className="text-indigo-600" size={18} />
                        ) : (
                          <FiSquare className="text-gray-400" size={18} />
                        )}
                      </button>
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Item Data</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Status</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Notes</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900">Batch</th>
                    <th className="text-center px-6 py-3 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedItems.map((item) => (
                    <tr key={item.id} className={`hover:bg-gray-50 transition ${
                      selectedItems.has(item.id) ? 'bg-indigo-50' : ''
                    }`}>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelectItem(item.id)}
                          className="p-1 hover:bg-gray-200 rounded transition"
                        >
                          {selectedItems.has(item.id) ? (
                            <FiCheckSquare className="text-indigo-600" size={18} />
                          ) : (
                            <FiSquare className="text-gray-400" size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-between group">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono max-w-xs truncate">
                            {highlightText(item.item_data, searchQuery)}
                          </code>
                          <button
                            onClick={() => handleCopyItem(item.item_data, item.id)}
                            className="ml-2 p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition"
                            title="Copy"
                          >
                            {copiedId === item.id ? <FiCheck /> : <FiCopy />}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          item.status === 'available'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'reserved'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {item.notes || '-'}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {item.batch || '-'}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleStatusChange(item.id, item.status)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                              item.status === 'available'
                                ? 'bg-green-600'
                                : 'bg-blue-600'
                            }`}
                            title={`Toggle to ${item.status === 'available' ? 'Sold' : 'Available'}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                item.status === 'available' ? 'translate-x-1' : 'translate-x-6'
                              }`}
                            />
                          </button>
                          <span className={`text-xs font-medium ${
                            item.status === 'available' ? 'text-green-700' : 'text-blue-700'
                          }`}>
                            {item.status === 'available' ? 'Available' : 'Sold'}
                          </span>
                          <button
                            onClick={() => handleCopyItem(item.item_data, item.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                          >
                            Copy
                          </button>
                          {item.status === 'available' && (
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {paginatedItems.map((item) => (
                <div key={item.id} className={`p-4 hover:bg-gray-50 ${
                  selectedItems.has(item.id) ? 'bg-indigo-50' : ''
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => toggleSelectItem(item.id)}
                        className="mt-1 p-1 hover:bg-gray-200 rounded transition"
                      >
                        {selectedItems.has(item.id) ? (
                          <FiCheckSquare className="text-indigo-600" size={18} />
                        ) : (
                          <FiSquare className="text-gray-400" size={18} />
                        )}
                      </button>
                      <div className="flex-1">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 font-mono break-all">
                          {highlightText(item.item_data, searchQuery)}
                        </code>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => handleCopyItem(item.item_data, item.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                      >
                        Copy
                      </button>
                      {item.status === 'available' && (
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div>
                      <span className="text-gray-500 text-xs">Status:</span>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleStatusChange(item.id, item.status)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                            item.status === 'available'
                              ? 'bg-green-600'
                              : 'bg-blue-600'
                          }`}
                          title={`Toggle to ${item.status === 'available' ? 'Sold' : 'Available'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              item.status === 'available' ? 'translate-x-1' : 'translate-x-6'
                            }`}
                          />
                        </button>
                        <span className={`text-xs font-medium ${
                          item.status === 'available' ? 'text-green-700' : 'text-blue-700'
                        }`}>
                          {item.status === 'available' ? 'Available' : 'Sold'}
                        </span>
                      </div>
                    </div>
                    {(item.notes || item.batch) && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {item.notes && (
                          <div>
                            <span className="text-gray-500 text-xs">Notes:</span>
                            <p className="text-gray-700 text-xs">{item.notes}</p>
                          </div>
                        )}
                        {item.batch && (
                          <div>
                            <span className="text-gray-500 text-xs">Batch:</span>
                            <p className="text-gray-700 text-xs">{item.batch}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Items Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add Items</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Product: <span className="font-medium text-indigo-600">{selectedProductData?.nama}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewItems('')
                  setBatchName('')
                  setItemNotes('')
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <FiX className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddItems} className="p-6 space-y-6">
              {/* Items Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Items Data <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-600">
                  Enter one item per line. Supported formats:
                </p>
                <ul className="text-xs text-gray-600 space-y-1 ml-4 mb-2">
                  <li>• Email & Password: <code className="bg-gray-100 px-1 rounded">email@example.com:password123</code></li>
                  <li>• Voucher Code: <code className="bg-gray-100 px-1 rounded">VOUCHER-ABC-123</code></li>
                  <li>• Account Info: <code className="bg-gray-100 px-1 rounded">username||password||extra_info</code></li>
                </ul>
                <textarea
                  value={newItems}
                  onChange={(e) => setNewItems(e.target.value)}
                  placeholder="user1@gmail.com:pass123&#10;user2@gmail.com:pass456&#10;VOUCHER-XYZ-789"
                  rows={10}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
                {newItems.trim() && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
                      {newItems.split('\n').filter(line => line.trim()).length} items ready
                    </div>
                  </div>
                )}
              </div>

              {/* Batch Name */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Batch Name <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <p className="text-xs text-gray-600">
                  Group items by batch for easier management (e.g., "JAN-2026", "Promo-Week1")
                </p>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g., JAN-2026 or PROMO-BATCH-1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notes / After Message */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Notes / After-Purchase Message <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <p className="text-xs text-gray-600">
                  Add notes for internal use or message to be sent to customer after purchase
                </p>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="e.g., Login via app only. Password can be changed after first login."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <FiInfo className="text-blue-500 text-xl" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 text-sm mb-1">Tips:</p>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• Paste multiple items at once - each line becomes one item</li>
                      <li>• Use batch names to organize seasonal or promotional items</li>
                      <li>• Notes will be stored with items for future reference</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setNewItems('')
                    setBatchName('')
                    setItemNotes('')
                  }}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newItems.trim()}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition shadow-sm"
                >
                  {newItems.trim() 
                    ? `Add ${newItems.split('\n').filter(line => line.trim()).length} Items`
                    : 'Add Items'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Upload Product Items (CSV/TXT)</h2>
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(null); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-700">Format columns (with header):</p>
              <pre className="bg-gray-100 p-3 rounded text-xs text-gray-800 overflow-auto">product_code,item_data,status,notes,batch\nPAKET-30H,email1@test.com:pass123,available,,JAN-2026\nPAKET-30H,VCHR-ABC-123,available,Promo batch,JAN-2026</pre>
              <p className="text-xs text-gray-600">If <strong>product_code</strong> is omitted, the currently selected product will be used.</p>
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
                    const hasProductCode = idx('product_code') !== -1
                    if (!hasProductCode && !selectedProduct) throw new Error('Select a product or include product_code')
                    const rows = lines.slice(1).map((line) => line.split(',').map(c => c.trim()))
                    const inserts = rows.map(cols => ({
                      product_code: hasProductCode ? (cols[idx('product_code')] || selectedProduct) : selectedProduct,
                      item_data: idx('item_data') !== -1 ? (cols[idx('item_data')] || '') : '',
                      status: (idx('status') !== -1 ? (cols[idx('status')] || 'available') : 'available') as 'available' | 'reserved' | 'sold' | 'error',
                      notes: idx('notes') !== -1 ? (cols[idx('notes')] || null) : null,
                      batch: idx('batch') !== -1 ? (cols[idx('batch')] || null) : null,
                    }))
                    const invalid = inserts.find(i => !i.product_code || !i.item_data)
                    if (invalid) throw new Error('Invalid row detected')
                    const { error } = await supabase.from('product_items').insert(inserts as any)
                    if (error) throw error
                    await fetchItems(selectedProduct || inserts[0].product_code)
                    setShowUploadModal(false)
                    alert(`Uploaded ${inserts.length} items successfully`)
                    
                    // Trigger bot refresh
                    try {
                      await fetch('/api/bot/refresh', { method: 'POST' })
                      console.log('✅ Bot refreshed after batch upload')
                    } catch (refreshErr) {
                      console.warn('⚠️ Failed to trigger bot refresh:', refreshErr)
                    }
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

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Delete Selected Items</h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                You selected {selectedItems.size} item(s). Only available items can be deleted.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                Available selected: {selectedAvailableCount}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmBatchDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {statusChangeTarget === 'batch' ? 'Change Status (Batch)' : 'Change Item Status'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                {statusChangeTarget === 'batch' 
                  ? `Change status for ${selectedItems.size} selected item(s)`
                  : 'Change status for this item'}
              </p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">New Status</p>
                    <p className="text-xs text-gray-600">Toggle between available and sold</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${
                      newStatus === 'available' ? 'text-green-700' : 'text-gray-400'
                    }`}>
                      Available
                    </span>
                    <button
                      onClick={() => setNewStatus(newStatus === 'available' ? 'sold' : 'available')}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        newStatus === 'available'
                          ? 'bg-green-600'
                          : 'bg-blue-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          newStatus === 'available' ? 'translate-x-1' : 'translate-x-7'
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-medium ${
                      newStatus === 'sold' ? 'text-blue-700' : 'text-gray-400'
                    }`}>
                      Sold
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> This will immediately update the status of {statusChangeTarget === 'batch' ? `${selectedItems.size} item(s)` : 'the selected item'}.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowStatusModal(false)
                  setStatusChangeTarget(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
