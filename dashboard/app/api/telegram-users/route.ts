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

// GET - Fetch all telegram users
export async function GET() {
  try {
    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('last_activity', { ascending: false })

    if (error) {
      return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    }

    return jsonNoStore({ data: data || [] })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to fetch telegram users' }, 500)
  }
}

// PUT - Update telegram user
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await req.json()
    const { user_id, ...updateFields } = body

    if (!user_id) {
      return jsonNoStore({ error: 'Missing user_id' }, 400)
    }

    // Only allow updating specific fields
    const allowedFields: Record<string, any> = {}
    if (typeof updateFields.username === 'string') allowedFields.username = updateFields.username.trim() || null
    if (typeof updateFields.first_name === 'string') allowedFields.first_name = updateFields.first_name.trim() || null
    if (typeof updateFields.last_name === 'string') allowedFields.last_name = updateFields.last_name.trim() || null
    if (typeof updateFields.language === 'string') allowedFields.language = updateFields.language.trim() || 'id'

    if (Object.keys(allowedFields).length === 0) {
      return jsonNoStore({ error: 'No valid fields to update' }, 400)
    }

    // Validate username (no spaces, alphanumeric + underscore only, like Telegram)
    if (allowedFields.username !== undefined && allowedFields.username !== null) {
      if (!/^[a-zA-Z0-9_]{3,100}$/.test(allowedFields.username)) {
        return jsonNoStore({ error: 'Username hanya boleh berisi huruf, angka, dan underscore (minimal 3 karakter)' }, 400)
      }
    }

    // Validate first_name
    if (allowedFields.first_name !== undefined && allowedFields.first_name !== null) {
      if (allowedFields.first_name.length < 1 || allowedFields.first_name.length > 100) {
        return jsonNoStore({ error: 'Nama depan harus 1-100 karakter' }, 400)
      }
    }

    // Validate last_name
    if (allowedFields.last_name !== undefined && allowedFields.last_name !== null) {
      if (allowedFields.last_name.length > 100) {
        return jsonNoStore({ error: 'Nama belakang maksimal 100 karakter' }, 400)
      }
    }

    // Check duplicate username if provided
    if (allowedFields.username) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('user_id')
        .eq('username', allowedFields.username)
        .neq('user_id', user_id)
        .maybeSingle()

      if (existingUser) {
        return jsonNoStore({ error: 'Username sudah digunakan oleh user lain' }, 400)
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update(allowedFields)
      .eq('user_id', user_id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return jsonNoStore({ error: 'Username sudah digunakan oleh user lain' }, 400)
      }
      return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    }

    return jsonNoStore({ data })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to update telegram user' }, 500)
  }
}

// DELETE - Delete telegram user
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return jsonNoStore({ error: 'Missing user_id' }, 400)
    }

    // Check if user has orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (orders && orders.length > 0) {
      return jsonNoStore({
        error: 'User tidak bisa dihapus karena memiliki riwayat order. Data order terkait dengan user ini.'
      }, 400)
    }

    // Check if user has favorites
    const { data: favorites } = await supabase
      .from('favorites')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1)

    // Delete favorites first (CASCADE should handle this, but just in case)
    if (favorites && favorites.length > 0) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
    }

    // Delete analytics_searches
    await supabase
      .from('analytics_searches')
      .delete()
      .eq('user_id', userId)

    // Delete the user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', userId)

    if (error) {
      // FK violation
      if (error.code === '23503') {
        return jsonNoStore({
          error: 'User tidak bisa dihapus karena masih memiliki data terkait (orders, favorites, dll).'
        }, 400)
      }
      return jsonNoStore({ error: error.message || JSON.stringify(error) }, 400)
    }

    return jsonNoStore({ success: true })
  } catch (err: any) {
    return jsonNoStore({ error: err?.message || 'Failed to delete telegram user' }, 500)
  }
}
