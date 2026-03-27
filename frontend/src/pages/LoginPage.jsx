import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import LoginForm from '../components/auth/LoginForm'

export default function LoginPage() {
  const user = useAuthStore((s) => s.user)
  if (user) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary-600">Axion</h1>
          <p className="text-sm text-gray-500 mt-1">Anmelden</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
