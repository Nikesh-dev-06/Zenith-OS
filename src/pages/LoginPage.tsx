import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@zenithcreative.in')
  const [password, setPassword] = useState('password')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      if (!err?.response) {
        setError('Network/CORS error: Cannot reach the backend server. Please verify that the backend is running.')
      } else {
        setError(err.response.data?.error || 'Invalid credentials. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const demoLogin = async (role: 'super_admin' | 'team_member' | 'client') => {
    setLoading(true)
    try {
      const defaultCredentials = {
        super_admin: { email: 'admin@zenithcreative.in', password: 'password' },
        team_member: { email: 'team@zenithcreative.in', password: 'password' },
        client: { email: 'client@novatech.com', password: 'password' },
      }
      const creds = defaultCredentials[role]
      await login(creds.email, creds.password)
      navigate(role === 'client' ? '/portal' : '/dashboard')
    } catch (err: any) {
      if (!err?.response) {
        setError('Network/CORS error: Cannot reach the backend server. Please verify that the backend is running.')
      } else {
        setError(err.response.data?.error || 'Demo login failed. Please use a real account.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding Panel */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #182f63 0%, #1e293b 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #F4511E, transparent)' }} />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #FF8C42, transparent)' }} />

          <div className="flex justify-start">
  <img
    src="/favicon.png"
    alt="Company Logo"
    className="h-16 w-auto relative z-10"
  />
</div>

        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            One Platform.<br />
            <span style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg, #F4511E, #FF8C42)', backgroundClip: 'text' }}>
              Every Client.
            </span><br />
            Every Project.
          </h2>
          <p className="text-slate-400 text-base leading-relaxed max-w-xs">
            The complete operations system built specifically for Zenith Creative.
          </p>
        </div>

        {/* <div className="relative z-10 space-y-3">
          {[
            { stat: '12 Modules', label: 'Built-in tools' },
            { stat: '100% Branded', label: 'Client experience' },
            { stat: 'Zero Chaos', label: 'Guaranteed' },
          ].map(item => (
            <div key={item.stat} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F4511E' }} />
              <span className="text-white font-semibold text-sm">{item.stat}</span>
              <span className="text-slate-500 text-sm">— {item.label}</span>
            </div>
          ))}
        </div> */}
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <div className="flex justify-start">
  <img
    src="/favicon.png"
    alt="Company Logo"
    className="h-16 w-auto relative z-10"
  />
</div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-navy-900 mb-1.5">Welcome back</h1>
            <p className="text-slate-500 text-sm">Sign in to your ZenithOS account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@zenithcreative.in"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-rose-600 text-sm bg-rose-50 border border-rose-100 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">Demo accounts</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Super Admin', role: 'super_admin' as const, color: '#F4511E' },
                { label: 'Team Member', role: 'team_member' as const, color: '#4F46E5' },
                { label: 'Client', role: 'client' as const, color: '#10B981' },
              ].map(d => (
                <button
                  key={d.role}
                  onClick={() => demoLogin(d.role)}
                  disabled={loading}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all duration-150 disabled:opacity-50"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
