import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClienteProvider } from './context/ClienteContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Credentials from './pages/Credentials';
import Reports from './pages/Reports';
import History from './pages/History';
import Facturas from './pages/Facturas';
import Consultas from './pages/Consultas';
import EmitirFactura from './pages/EmitirFactura';
import Clientes from './pages/Clientes';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <ClienteProvider>
      <Layout>{children}</Layout>
    </ClienteProvider>
  );
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/credentials" element={<ProtectedRoute><Credentials /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/facturas" element={<ProtectedRoute><Facturas /></ProtectedRoute>} />
          <Route path="/emitir" element={<ProtectedRoute><EmitirFactura /></ProtectedRoute>} />
          <Route path="/consultas" element={<ProtectedRoute><Consultas /></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
