import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSessionUser(request)

  if (!session) {
    return NextResponse.json({ authenticated: false, user: null })
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      nama: session.nama,
      email: session.email,
      phone: session.phone,
    },
  })
}
