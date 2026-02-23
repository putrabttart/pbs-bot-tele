export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          kode: string
          nama: string
          kategori: string | null
          harga: number
          harga_lama: number | null
          stok: number
          ikon: string | null
          deskripsi: string | null
          wa: string | null
          alias: string[] | null
          aktif: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kode: string
          nama: string
          kategori?: string | null
          harga: number
          harga_lama?: number | null
          stok: number
          ikon?: string | null
          deskripsi?: string | null
          wa?: string | null
          alias?: string[] | null
          aktif?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kode?: string
          nama?: string
          kategori?: string | null
          harga?: number
          harga_lama?: number | null
          stok?: number
          ikon?: string | null
          deskripsi?: string | null
          wa?: string | null
          alias?: string[] | null
          aktif?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string | null
          total_amount: number
          status: string
          payment_method: string | null
          midtrans_order_id: string | null
          midtrans_transaction_id: string | null
          customer_name: string | null
          customer_email: string | null
          customer_phone: string | null
          created_at: string
          updated_at: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          price: number
          created_at: string
        }
      }
    }
  }
}
