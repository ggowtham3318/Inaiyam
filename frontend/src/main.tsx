import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './app/AuthContext'
import { I18nProvider } from './app/I18nContext'
import { ProtectedRoute } from './app/ProtectedRoute'
import { AdminLayout } from './components/layout/AdminLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { UserLayout } from './components/layout/UserLayout'
import { AuthPage, ForgotPasswordPage, ResetPasswordPage, VerifyOtpPage } from './pages/AuthPages'
import { SettingsPage, UserDashboard } from './pages/AppPages'
import { DesignSystem } from './pages/DesignSystem'
import { Home, SimplePublicPage } from './pages/PublicPages'
import { PrivacyPage, TermsPage } from './pages/LegalPages'
import { InterestsPage, MyProfilePage, ProfileDetailPage, SearchPage, ShortlistPage } from './pages/UserPages'
import { AdminApprovalsPage, AdminContactMessagesPage, AdminDashboardPage, AdminDeletionRequestsPage, AdminReportsPage, AdminUsersPage } from './pages/AdminPages'
import './styles/global.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}><I18nProvider><AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<SimplePublicPage title="A more thoughtful way to meet." tamil="எங்களை பற்றி" >Inaiyam Matrimony is designed for families who want to begin with trust, clarity and a little more humanity.</SimplePublicPage>} />
            <Route path="/how-it-works" element={<SimplePublicPage title="Simple steps. Meaningful beginnings." tamil="எப்படி செயல்படுகிறது">Create your story, explore approved profiles and begin a respectful conversation when a connection feels right.</SimplePublicPage>} />
            <Route path="/contact" element={<SimplePublicPage variant="contact" title="We are here to listen." tamil="தொடர்பு கொள்ள">Have a question about finding a match or creating a family profile? Our team will be ready to help.</SimplePublicPage>} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="register" />} />
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route path="/design-system" element={<DesignSystem />} />
          <Route element={<ProtectedRoute role="user" />}>
            <Route element={<UserLayout />}>
              <Route path="/complete-profile" element={<MyProfilePage />} />
              <Route path="/app" element={<UserDashboard />} />
              <Route path="/app/search" element={<SearchPage />} />
              <Route path="/app/profile/:profileId" element={<ProfileDetailPage />} />
              <Route path="/app/shortlist" element={<ShortlistPage />} />
              <Route path="/app/interests" element={<InterestsPage />} />
              <Route path="/app/profile" element={<MyProfilePage />} />
              <Route path="/app/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/approvals" element={<AdminApprovalsPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/deletions" element={<AdminDeletionRequestsPage />} />
              <Route path="/admin/messages" element={<AdminContactMessagesPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider></I18nProvider></QueryClientProvider>
  </StrictMode>,
)
