import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function jsonNoStore(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

// GET - Fetch all user_web
export async function GET() {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('user_web')
      .select('id, nama, email, phone, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    }

    return jsonNoStore({ data: data || [] })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch web users' }, 500)
  }
}

// PUT - Update user_web (edit profile or toggle is_active)
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { id, ...updateFields } = body

    if (!id) {
      return jsonNoStore({ error: 'Missing user id' }, 400)
    }

    // Only allow updating specific fields from admin
    const allowedFields: Record<string, any> = {}
    if (typeof updateFields.nama === 'string') allowedFields.nama = updateFields.nama.trim()
    if (typeof updateFields.email === 'string') allowedFields.email = updateFields.email.trim().toLowerCase()
    if (typeof updateFields.phone === 'string') allowedFields.phone = updateFields.phone.trim()
    if (typeof updateFields.is_active === 'boolean') allowedFields.is_active = updateFields.is_active

    if (Object.keys(allowedFields).length === 0) {
      return jsonNoStore({ error: 'No valid fields to update' }, 400)
    }

    // Validate email format if provided
    if (allowedFields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allowedFields.email)) {
      return jsonNoStore({ error: 'Format email tidak valid' }, 400)
    }

    // Validate phone format if provided
    if (allowedFields.phone && !/^[0-9+\-\s()]{8,20}$/.test(allowedFields.phone)) {
      return jsonNoStore({ error: 'Format nomor telepon tidak valid' }, 400)
    }

    // Validate nama if provided
    if (allowedFields.nama !== undefined && allowedFields.nama.length < 2) {
      return jsonNoStore({ error: 'Nama minimal 2 karakter' }, 400)
    }

    // Check for duplicate email
    if (allowedFields.email) {
      const { data: existingEmail } = await supabase
        .from('user_web')
        .select('id')
        .eq('email', allowedFields.email)
        .neq('id', id)
        .maybeSingle()

      if (existingEmail) {
        return jsonNoStore({ error: 'Email sudah digunakan oleh user lain' }, 400)
      }
    }

    // Check for duplicate phone
    if (allowedFields.phone) {
      const { data: existingPhone } = await supabase
        .from('user_web')
        .select('id')
        .eq('phone', allowedFields.phone)
        .neq('id', id)
        .maybeSingle()

      if (existingPhone) {
        return jsonNoStore({ error: 'Nomor telepon sudah digunakan oleh user lain' }, 400)
      }
    }

    allowedFields.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('user_web')
      .update(allowedFields)
      .eq('id', id)
      .select('id, nama, email, phone, is_active, created_at, updated_at')
      .single()

    if (error) {
      // Handle unique constraint violations
      if (error.code === '23505') {
        if (error.message?.includes('email')) {
          return jsonNoStore({ error: 'Email sudah digunakan oleh user lain' }, 400)
        }
        if (error.message?.includes('phone')) {
          return jsonNoStore({ error: 'Nomor telepon sudah digunakan oleh user lain' }, 400)
        }
        return jsonNoStore({ error: 'Data duplikat terdeteksi' }, 400)
      }
      return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    }

    return jsonNoStore({ data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to update web user' }, 500)
  }
}

// DELETE - Delete user_web
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return jsonNoStore({ error: 'Missing user id' }, 400)
    }

    // Check if user has orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('user_web_id', id)
      .limit(1)

    if (orders && orders.length > 0) {
      return jsonNoStore({ 
        error: 'User tidak bisa dihapus karena memiliki riwayat order. Nonaktifkan user sebagai gantinya.' 
      }, 400)
    }

    const { error } = await supabase
      .from('user_web')
      .delete()
      .eq('id', id)

    if (error) {
      return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    }

    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to delete web user' }, 500)
  }
}
