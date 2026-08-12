import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AuthLayout, OtpAuthForm } from '../components/auth/OtpAuthForm'

export function LoginPage() {
  const { sendOtp, verifyOtp, user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!loading && user && profile) {
    const from = (location.state as { from?: string } | null)?.from
    if (from) return <Navigate to={from} replace />
    return <Navigate to={profile.role === 'seller' ? '/seller' : '/lives'} replace />
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Enter your email and we'll send a one-time code — no password needed."
    >
      <OtpAuthForm
        mode="login"
        onSendOtp={({ email }) => sendOtp({ email, isSignup: false })}
        onVerifyOtp={async (email, token) => {
          await verifyOtp(email, token)
          navigate('/')
        }}
        alternateLink={{
          href: '/signup',
          label: 'Create an account',
          prompt: 'New here?',
        }}
      />
    </AuthLayout>
  )
}

export function SignupPage() {
  const { sendOtp, verifyOtp, user, profile, loading } = useAuth()
  const navigate = useNavigate()

  if (!loading && user && profile) {
    return <Navigate to={profile.role === 'seller' ? '/seller' : '/lives'} replace />
  }

  return (
    <AuthLayout
      title="Join Reneo Live"
      subtitle="Create a seller or customer account with a one-time email code."
    >
      <OtpAuthForm
        mode="signup"
        onSendOtp={({ email, name, role }) => {
          if (!name?.trim()) throw new Error('Name is required.')
          if (!role) throw new Error('Please choose seller or customer.')
          return sendOtp({ email, name: name.trim(), role, isSignup: true })
        }}
        onVerifyOtp={async (email, token) => {
          await verifyOtp(email, token)
          navigate('/')
        }}
        alternateLink={{
          href: '/login',
          label: 'Sign in',
          prompt: 'Already have an account?',
        }}
      />
    </AuthLayout>
  )
}
