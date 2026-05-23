import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from './api';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import RegisteredUsers from './pages/RegisteredUsers.jsx';
import NonRegisteredUsers from './pages/NonRegisteredUsers.jsx';
import Branches from './pages/Branches.jsx';
import Pdfs from './pages/Pdfs.jsx';
import FlowImages from './pages/FlowImages.jsx';
import RentBills from './pages/RentBills.jsx';

function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kpg_token');
    if (!token) { setLoading(false); return; }
    api
      .get('/auth/verify')
      .then((r) => setAuth(r.data.user || null))
      .catch(() => {
        localStorage.removeItem('kpg_token');
        setAuth(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-brand-700">Loading…</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={auth ? <Navigate to="/" replace /> : <Login setAuth={setAuth} />}
        />
        <Route
          path="/"
          element={auth ? <Layout user={auth} setAuth={setAuth} /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Dashboard />} />
          <Route path="registered" element={<RegisteredUsers />} />
          <Route path="non-registered" element={<NonRegisteredUsers />} />
          <Route path="branches" element={<Branches />} />
          <Route path="rent-bills" element={<RentBills />} />
          <Route path="pdfs" element={<Pdfs />} />
          <Route path="flow-images" element={<FlowImages />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
