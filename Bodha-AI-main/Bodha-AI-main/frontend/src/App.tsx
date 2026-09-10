import { Route, Routes } from 'react-router-dom';

import { RequireAuth } from './components/auth/RequireAuth';
import { RequireOnboarding } from './components/auth/RequireOnboarding';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { VoiceAssistant } from './components/voice/VoiceAssistant';
import { AnalyzePage } from './pages/AnalyzePage';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PricingPage } from './pages/PricingPage';
import { ReportPage } from './pages/ReportPage';
import { SignupPage } from './pages/SignupPage';

function SignedIn({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireOnboarding>{children}</RequireOnboarding>
    </RequireAuth>
  );
}

export function App() {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <ScrollToTop />
      <Navbar />

      <main id="main" className="min-w-0 flex-1 pb-20 md:pb-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <OnboardingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/analyze"
            element={
              <SignedIn>
                <AnalyzePage />
              </SignedIn>
            }
          />
          <Route
            path="/report/:productId"
            element={
              <SignedIn>
                <ReportPage />
              </SignedIn>
            }
          />
          <Route
            path="/dashboard"
            element={
              <SignedIn>
                <DashboardPage />
              </SignedIn>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
      <BottomNav />
      <VoiceAssistant />
    </div>
  );
}
