import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login, loading, error, token } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState('')
  const mfaPromptVisible = Boolean(error?.toLowerCase().includes('authenticator code'))

  useEffect(() => {
    if (token) navigate('/command-center', { replace: true })
  }, [navigate, token])

  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError('Email is required')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Please enter a valid email address')
      return false
    }
    setEmailError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const isEmailValid = validateEmail(email)
    if (!isEmailValid || !password) return
    if (mfaPromptVisible && !/^(\d{6}|[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/i.test(mfaCode.trim())) return
    await login(email, password, mfaPromptVisible ? mfaCode : undefined)
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-dark)] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left panel - branding */}
        <section className="flex flex-col justify-between border-r border-white/10 p-8 lg:p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-sm font-semibold text-black">
              T
            </div>
            <div>
              <div className="font-semibold tracking-tight">Tanaghum</div>
              <div className="text-xs text-white/50">Commercial/Social AI Operating System</div>
            </div>
          </div>

          <div className="max-w-3xl py-16">
            <div className="mb-5 inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
              Production workspace. External writes controlled by policy.
            </div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              AI prepares. Human approves. The system records.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/60">
              A Commercial/Social production module for campaign preparation, platform adaptation,
              reach scoring, approval routing, publishing readiness, and audit evidence.
            </p>
          </div>

          <div className="grid max-w-3xl grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {[
              ['AI Provider', 'Backend governed'],
              ['Postiz', 'Sandbox reachable'],
              ['GHL', 'Handoff prepared'],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="font-medium">{label}</div>
                <div className="mt-1 text-xs text-white/45">{detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Right panel - login form */}
        <section className="flex items-center justify-center bg-[var(--color-surface)] p-6 text-[var(--color-text-primary)] sm:p-8">
          <div className="w-full max-w-md rounded-lg border border-black/10 bg-[var(--color-surface-card)] p-6 shadow-lg sm:p-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Enter Commercial Workspace</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Sign in with your organization account.</p>
            </div>

            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              <div className="font-medium text-amber-800">Account access</div>
              <div className="mt-2 text-amber-700">
                New users receive an invite link from the platform admin. Passwords are set by each user and are never shown in the UI.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (emailError) validateEmail(e.target.value)
                  }}
                  onBlur={e => validateEmail(e.target.value)}
                  placeholder="you@tanaghum.com"
                  className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-4 focus:ring-blue-500/10 ${
                    emailError
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-black/15 focus:border-blue-600'
                  }`}
                  required
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? 'email-error' : undefined}
                />
                {emailError && (
                  <p id="email-error" className="mt-1.5 text-xs text-red-600" role="alert">
                    {emailError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mfaPromptVisible && (
                <div>
                  <label htmlFor="mfaCode" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                    Authenticator or recovery code
                  </label>
                  <input
                    id="mfaCode"
                    inputMode="text"
                    maxLength={14}
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.toUpperCase().slice(0, 14))}
                    placeholder="123456 or AB12-CD34-EF56"
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10"
                    required
                  />
                </div>
              )}

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-[var(--color-text-primary)] py-3 text-sm font-medium text-white transition hover:bg-[var(--color-brand-800)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Opening workspace...' : 'Open Command Center'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
              Production workspace. External publishing, CRM writes, WhatsApp, and voice triggers require explicit authorization.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
