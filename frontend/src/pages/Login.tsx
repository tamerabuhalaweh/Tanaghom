import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'

export default function Login() {
  const { login, loading, error, token } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@tanaghum.com')
  const [password, setPassword] = useState('password123')

  useEffect(() => {
    if (token) navigate('/command-center', { replace: true })
  }, [navigate, token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(email, password)
  }

  return (
    <div className="min-h-screen bg-[#0f0f0e] text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-between border-r border-white/10 p-8 lg:p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-sm font-semibold text-black">
              T
            </div>
            <div>
              <div className="font-semibold tracking-tight">Tanaghum STITCH</div>
              <div className="text-xs text-white/50">Commercial/Social operating demo</div>
            </div>
          </div>

          <div className="max-w-3xl py-16">
            <div className="mb-5 inline-flex rounded-full border border-[#f5d56f]/25 bg-[#2a2411] px-3 py-1 text-xs font-medium text-[#f5d56f]">
              Controlled demo. M5 blocked. External execution disabled.
            </div>
            <h1 className="text-5xl font-semibold tracking-tight lg:text-6xl">
              AI prepares. Human approves. The system records.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/60">
              A working Commercial/Social model for campaign preparation, platform adaptation,
              reach scoring, approval routing, publishing readiness, and audit evidence.
            </p>
          </div>

          <div className="grid max-w-3xl grid-cols-3 gap-3 text-sm">
            {[
              ['Mock LLM', 'Default provider'],
              ['Postiz', 'Sandbox ready'],
              ['GHL', 'Write blocked'],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="font-medium">{label}</div>
                <div className="mt-1 text-xs text-white/45">{detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center bg-[#f7f7f3] p-8 text-black">
          <div className="w-full max-w-md rounded-lg border border-black/10 bg-white p-8 shadow-[0_16px_60px_rgba(0,0,0,0.12)]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Enter demo workspace</h2>
              <p className="mt-2 text-sm text-black/55">Use one of the prepared pilot identities.</p>
            </div>

            <div className="mt-6 rounded-lg border border-black/10 bg-[#fafaf7] p-4 text-sm">
              <div className="font-medium">Demo users</div>
              <div className="mt-3 space-y-1.5 text-black/60">
                <div>demand.specialist@tanaghum.com</div>
                <div>brand.head@tanaghum.com</div>
                <div>admin@tanaghum.com</div>
              </div>
              <div className="mt-3 text-xs font-medium text-black">Password: password123</div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black/70">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-4 focus:ring-black/5"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black/70">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-4 focus:ring-black/5"
                  required
                />
              </div>
              {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-black py-3 text-sm font-medium text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Opening workspace...' : 'Open Command Center'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-black/40">
              Mock providers only. Live publishing, CRM, WhatsApp, voice, and M5 are blocked.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
