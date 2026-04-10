export type OrderDeliveryEmailItem = {
  productName: string
  productCode: string
  quantity: number
  price: number
  itemData?: string
  productNotes?: string
}

export type OrderDeliveryEmailPayload = {
  orderId: string
  customerName?: string
  customerEmail: string
  transactionTime?: string
  totalAmount: number
  items: OrderDeliveryEmailItem[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDateTime(dateString?: string) {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleString('id-ID')
  } catch {
    return dateString
  }
}

function splitNotes(notes?: string): string[] {
  if (!notes) return []
  return String(notes)
    .split(/\r?\n|\|\|/)
    .map((n) => n.trim())
    .filter(Boolean)
}

function normalizeItemDataText(text: string) {
  return String(text)
    .replace(/\s*\|\|\s*/g, '\n')
    .trim()
}

function itemDataLines(itemData?: string): string[] {
  if (!itemData) return []
  return String(itemData)
    .split(/\r?\n/)
    .map((line) => normalizeItemDataText(line))
    .filter(Boolean)
}

export function buildOrderDeliveryEmail(payload: OrderDeliveryEmailPayload) {
  const customerName = payload.customerName || 'Customer'
  const transactionTime = formatDateTime(payload.transactionTime)
  const orderId = payload.orderId

  const subject = `Salinan Item Digital Pembelian - Order ${orderId}`

  const textItemSections = payload.items
    .map((item, idx) => {
      const notes = splitNotes(item.productNotes)
      const dataLines = itemDataLines(item.itemData)

      const lines: string[] = [
        `${idx + 1}. ${item.productName}`,
        `   - Kode Produk: ${item.productCode}`,
        `   - Quantity: ${item.quantity}x @ ${formatCurrency(item.price)}`,
      ]

      if (notes.length > 0) {
        lines.push('   - Ketentuan Produk:')
        for (const note of notes) {
          lines.push(`     * ${note}`)
        }
      }

      if (dataLines.length > 0) {
        lines.push('   - Detail Item Digital:')
        for (let i = 0; i < dataLines.length; i += 1) {
          lines.push(`     #${i + 1}: ${dataLines[i]}`)
        }
      } else {
        lines.push('   - Detail Item Digital: (belum tersedia)')
      }

      return lines.join('\n')
    })
    .join('\n\n')

  const text = [
    `Halo ${customerName},`,
    '',
    'Pembayaran Anda sudah berhasil diproses.',
    'Ini adalah salinan item digital dari pembelian Anda.',
    '',
    `Order ID: ${orderId}`,
    `Tanggal Transaksi: ${transactionTime}`,
    `Email Pembeli: ${payload.customerEmail}`,
    '',
    '=== ITEM PEMBELIAN ===',
    textItemSections || '(Tidak ada item)',
    '',
    `Total Pembayaran: ${formatCurrency(payload.totalAmount)}`,
    '',
    'Simpan email ini sebagai salinan data pembelian Anda.',
    'Jika ada kendala, hubungi admin dengan menyertakan Order ID.',
  ].join('\n')

  const htmlItemSections = payload.items
    .map((item, idx) => {
      const notes = splitNotes(item.productNotes)
      const dataLines = itemDataLines(item.itemData)

      const notesHtml = notes.length
        ? `<div style="margin-top:8px;"><div style="font-weight:600;">Ketentuan Produk</div><ul style="margin:6px 0 0 18px; padding:0;">${notes
            .map((note) => `<li>${escapeHtml(note)}</li>`)
            .join('')}</ul></div>`
        : ''

      const dataHtml = dataLines.length
        ? `<div style="margin-top:8px;"><div style="font-weight:600;">Detail Item Digital</div><ol style="margin:6px 0 0 18px; padding:0;">${dataLines
            .map((line) => `<li><pre style=\"display:inline;white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;\">${escapeHtml(line)}</pre></li>`)
            .join('')}</ol></div>`
        : '<div style="margin-top:8px;color:#a16207;">Detail item digital belum tersedia.</div>'

      return `
        <div style="border:1px solid #d1fae5;background:#f0fdf4;border-radius:10px;padding:14px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:16px;margin-bottom:6px;">${idx + 1}. ${escapeHtml(item.productName)}</div>
          <div>Kode Produk: <strong>${escapeHtml(item.productCode)}</strong></div>
          <div>Quantity: <strong>${item.quantity}x</strong> @ ${formatCurrency(item.price)}</div>
          ${notesHtml}
          ${dataHtml}
        </div>
      `
    })
    .join('')

  const html = `
    <div style="font-family:Segoe UI,Roboto,Arial,sans-serif;max-width:720px;margin:0 auto;color:#111827;line-height:1.5;">
      <h2 style="margin:0 0 10px;color:#065f46;">Pembayaran Berhasil</h2>
      <p style="margin:0 0 12px;">Halo <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0 0 14px;">Ini adalah salinan item digital dari pembelian Anda.</p>

      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;background:#f9fafb;margin-bottom:14px;">
        <div>Order ID: <strong>${escapeHtml(orderId)}</strong></div>
        <div>Tanggal Transaksi: <strong>${escapeHtml(transactionTime)}</strong></div>
        <div>Email Pembeli: <strong>${escapeHtml(payload.customerEmail)}</strong></div>
      </div>

      <h3 style="margin:0 0 10px;">Item Pembelian</h3>
      ${htmlItemSections || '<p>Tidak ada item.</p>'}

      <div style="border-top:1px solid #e5e7eb;margin-top:14px;padding-top:12px;">
        <div style="font-size:16px;">Total Pembayaran: <strong>${formatCurrency(payload.totalAmount)}</strong></div>
      </div>

      <p style="margin-top:14px;">Simpan email ini sebagai salinan data pembelian Anda.</p>
      <p style="margin-top:8px;">Jika ada kendala, hubungi admin dan sertakan Order ID di atas.</p>
    </div>
  `

  return { subject, text, html }
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
