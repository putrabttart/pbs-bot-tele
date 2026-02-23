'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { FiMail, FiLock, FiAlertCircle, FiHelpCircle } from 'react-icons/fi'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@pbs.com')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    const checkConfig = () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      console.log('🔍 Checking Supabase Configuration...')
      console.log('URL:', url ? '✅ Set' : '❌ Missing')
      console.log('Key:', key ? '✅ Set' : '❌ Missing')
      
      setDebugInfo({
        url: url ? '✅' : '❌',
        key: key ? '✅' : '❌',
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      })
    }
    checkConfig()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('🔐 ========== LOGIN PROCESS START ==========')
      console.log('📧 Email:', email)
      console.log('⏰ Timestamp:', new Date().toISOString())
      
      const supabase = createBrowserClient()
      console.log('✅ Supabase client created')

      console.log('🔑 Attempting to sign in...')
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('📡 Sign in response received')

      if (signInError) {
        console.error('❌ Sign in error:', {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name,
        })
        
        let userMessage = 'Login failed'
        
        if (signInError.message.includes('Invalid login credentials')) {
          userMessage = 'Invalid email or password. Please check and try again.'
        } else if (signInError.message.includes('Email not confirmed')) {
          userMessage = 'Please confirm your email address first. Check your email inbox for confirmation link.'
        } else if (signInError.message.includes('User not found')) {
          userMessage = 'User not found. Please create account in Supabase Dashboard first.'
        } else if (signInError.message.includes('too_many_requests')) {
          userMessage = 'Too many login attempts. Please wait a moment and try again.'
        } else {
          userMessage = `Error: ${signInError.message}`
        }
        
        setError(userMessage)
        setShowDebug(true)
        throw new Error(userMessage)
      }

      if (!data?.session) {
        console.error('❌ No session in response')
        setError('Login failed: No session created. Check console for details.')
        setShowDebug(true)
        throw new Error('No session returned')
      }

      console.log('✅ Session created successfully')
      console.log('👤 User ID:', data.user?.id)
      console.log('🔐 Session:', {
        accessToken: data.session.access_token ? '✅ Set' : '❌ Missing',
        refreshToken: data.session.refresh_token ? '✅ Set' : '❌ Missing',
        expiresIn: data.session.expires_in,
      })
      
      // Wait a moment for cookies to be fully set by auth-helpers
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const cookies = document.cookie.split(';').map(c => c.trim())
      const authCookies = cookies.filter(c => c.includes('sb-'))
      console.log('🍪 Auth cookies found:', authCookies.length)
      console.log('🍪 All cookies:', cookies)
      
      // Verify session was persisted
      const { data: { session } } = await supabase.auth.getSession()
      console.log('🔍 Verified session after login:', session ? '✅ Session exists' : '❌ No session')
      
      console.log('🔄 Preparing redirect to dashboard...')
      
      console.log('✅ Redirecting to /dashboard...')
      router.push('/dashboard')
      
      // Refresh after a short delay to ensure middleware checks new auth state
      setTimeout(() => {
        router.refresh()
      }, 500)
      
      console.log('🔐 ========== LOGIN SUCCESS ==========')
      
    } catch (err: any) {
      console.error('❌ ========== LOGIN ERROR ==========')
      console.error('Error message:', err.message)
      console.error('Error stack:', err.stack)
      
      if (!error) {
        setError(err.message || 'Login failed. Check console (F12) for details.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-lg mb-4">
              <FiLock className="text-white text-xl" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 text-sm mt-2">PBS Telegram Bot Management</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-600 rounded">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="text-red-600 shrink-0 mt-0.5 text-lg" />
                <div className="flex-1">
                  <p className="text-red-800 text-sm font-bold">Login Error</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                  <p className="text-red-600 text-xs mt-2">Check browser console (F12) for logs</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-3 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pbs.com"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-3 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition mt-6 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-xs text-gray-600">
              Secure Admin Dashboard - Authentication Required
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-2 items-start">
            <FiHelpCircle className="text-blue-600 shrink-0 mt-1" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-2">Not able to login?</p>
              <ul className="text-xs space-y-1 text-blue-800">
                <li>1. Check browser console: F12 → Console</li>
                <li>2. Create user in Supabase Dashboard</li>
                <li>3. Confirm email if not auto-confirmed</li>
                <li>4. Add http://localhost:3000/ to Supabase Redirect URLs</li>
              </ul>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-blue-600 hover:text-blue-700 text-xs font-semibold mt-3 underline"
              >
                {showDebug ? 'Hide' : 'Show'} Debug Info
              </button>
            </div>
          </div>
        </div>

        {showDebug && debugInfo && (
          <div className="mt-4 p-4 bg-gray-900 text-gray-100 rounded-lg font-mono text-xs overflow-auto max-h-48">
            <p className="text-yellow-400 mb-2">Debug Info:</p>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
