import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import WeatherPage from './pages/WeatherPage';
import AirportPage from './pages/AirportPage';
import WindsAloftPage from './pages/WindsAloftPage';
import RouteBriefingPage from './pages/RouteBriefingPage';
import CurrencyPage from './pages/CurrencyPage';
import DispatchPage from './pages/DispatchPage';
import MapPage from './pages/MapPage';
import ObservabilityPage from './pages/ObservabilityPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

const FULL_WIDTH_PATHS = ['/', '/map'];

function AppShell() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const location = useLocation();
  const isFullWidth = FULL_WIDTH_PATHS.includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Landing page has its own header */}
      {location.pathname !== '/' && (
        <NavBar dark={dark} onToggle={() => setDark(d => !d)} />
      )}
      <main className={
        isFullWidth
          ? 'flex-1 overflow-hidden'
          : 'flex-1 container mx-auto px-4 py-6 max-w-5xl'
      }>
        <div key={location.pathname} className="h-full animate-fade-in">
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/map"      element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
          <Route path="/weather"  element={<ProtectedRoute><WeatherPage /></ProtectedRoute>} />
          <Route path="/airports" element={<ProtectedRoute><AirportPage /></ProtectedRoute>} />
          <Route path="/winds"    element={<ProtectedRoute><WindsAloftPage /></ProtectedRoute>} />
          <Route path="/route"    element={<ProtectedRoute><RouteBriefingPage /></ProtectedRoute>} />
          <Route path="/currency" element={<ProtectedRoute><CurrencyPage /></ProtectedRoute>} />
          <Route path="/dispatch" element={<ProtectedRoute><DispatchPage /></ProtectedRoute>} />
          <Route path="/ops"      element={<ProtectedRoute><ObservabilityPage /></ProtectedRoute>} />
        </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
