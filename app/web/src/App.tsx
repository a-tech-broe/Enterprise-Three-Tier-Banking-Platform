import { Route, Routes } from 'react-router-dom';
import NavBar from './components/NavBar';
import AccountPage from './pages/AccountPage';
import AccountsPage from './pages/AccountsPage';
import TransferPage from './pages/TransferPage';

export default function App() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountPage />} />
          <Route path="/transfer" element={<TransferPage />} />
        </Routes>
      </main>
    </div>
  );
}
