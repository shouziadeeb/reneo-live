import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RoleRoute } from './routes/RoleRoute'
import { HomeRedirect } from './pages/HomeRedirect'
import { LoginPage } from './pages/Login'
import { SignupPage } from './pages/Signup'
import { SellerDashboardPage } from './pages/SellerDashboard'
import { CreateProductPage } from './pages/CreateProduct'
import { SellerLivePage } from './pages/SellerLive'
import { CustomerLivesPage } from './pages/CustomerLives'
import { CustomerLivePage } from './pages/CustomerLive'
import { CartPage } from './pages/Cart'

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<RoleRoute role="seller" />}>
                <Route path="/seller" element={<SellerDashboardPage />} />
                <Route path="/seller/products/new" element={<CreateProductPage />} />
                <Route path="/seller/live/:liveId" element={<SellerLivePage />} />
              </Route>

              <Route element={<RoleRoute role="customer" />}>
                <Route path="/lives" element={<CustomerLivesPage />} />
                <Route path="/lives/:liveId" element={<CustomerLivePage />} />
                <Route path="/cart" element={<CartPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}
