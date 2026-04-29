export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: number
          username: string | null
          first_name: string | null
          last_name: string | null
          language: string | null
          created_at: string
          last_activity: string
        }
        Insert: {
          user_id: number
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          language?: string | null
          created_at?: string
          last_activity?: string
        }
        Update: {
          user_id?: number
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          language?: string | null
          created_at?: string
          last_activity?: string
        }
      }
      products: {
        Row: {
          id: string
          kode: string
          nama: string
          harga_web: number | null
          harga_bot: number | null
          harga_lama: number | null
          deskripsi: string | null
          ikon: string | null
          gambar_url: string | null
          kategori: string | null
          stok: number
          wa: string | null
          alias: string[] | null
          aktif: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kode: string
          nama: string
          harga_web?: number | null
          harga_bot?: number | null
          harga_lama?: number | null
          deskripsi?: string | null
          ikon?: string | null
          gambar_url?: string | null
          kategori?: string | null
          stok?: number
          wa?: string | null
          alias?: string[] | null
          aktif?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kode?: string
          nama?: string
          harga_web?: number | null
          harga_bot?: number | null
          harga_lama?: number | null
          deskripsi?: string | null
          ikon?: string | null
          gambar_url?: string | null
          kategori?: string | null
          stok?: number
          wa?: string | null
          alias?: string[] | null
          aktif?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      product_items: {
        Row: {
          id: string
          product_id: string
          product_code: string
          item_data: string
          status: 'available' | 'reserved' | 'sold' | 'invalid'
          notes: string | null
          batch: string | null
          reserved_for_order: string | null
          reservation_expires_at: string | null
          sold_at: string | null
          order_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          product_code: string
          item_data: string
          status?: 'available' | 'reserved' | 'sold' | 'invalid'
          notes?: string | null
          batch?: string | null
          reserved_for_order?: string | null
          reservation_expires_at?: string | null
          sold_at?: string | null
          order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          product_code?: string
          item_data?: string
          status?: 'available' | 'reserved' | 'sold' | 'invalid'
          notes?: string | null
          batch?: string | null
          reserved_for_order?: string | null
          reservation_expires_at?: string | null
          sold_at?: string | null
          order_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string
          order_number: string
          total_price: number
          status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'
          items_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          order_number: string
          total_price: number
          status?: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'
          items_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          order_number?: string
          total_price?: number
          status?: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'
          items_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      user_web: {
        Row: {
          id: string
          nama: string
          email: string
          phone: string
          password_hash: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nama: string
          email: string
          phone: string
          password_hash: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nama?: string
          email?: string
          phone?: string
          password_hash?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      product_inventory_summary: {
        Row: {
          kode: string | null
          nama: string | null
          stock_count: number | null
          available: number | null
          reserved: number | null
          sold: number | null
        }
      }
    }
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
