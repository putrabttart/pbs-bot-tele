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
      products: {
        Row: {
          id: string
          kode: string
          nama: string
          harga: number
          deskripsi: string | null
          ikon: string | null
          gambar_url: string | null
          kategori: string | null
          stok: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kode: string
          nama: string
          harga: number
          deskripsi?: string | null
          ikon?: string | null
          gambar_url?: string | null
          kategori?: string | null
          stok?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kode?: string
          nama?: string
          harga?: number
          deskripsi?: string | null
          ikon?: string | null
          gambar_url?: string | null
          kategori?: string | null
          stok?: number
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
