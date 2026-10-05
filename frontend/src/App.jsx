import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout          from "./components/Layout";
import Login           from "./pages/Login";
import Dashboard       from "./pages/Dashboard";
import RegisterLand    from "./pages/RegisterLand";
import NFTDeeds        from "./pages/NFTDeeds";
import Disputes        from "./pages/Disputes";
import Loans           from "./pages/Loans";
import Verify          from "./pages/Verify";
import AdminPanel      from "./pages/AdminPanel";
import Market          from "./pages/Market";
import Transfers       from "./pages/Transfers";
import SMSNotifications from "./pages/SMSNotifications";
import AuditTrail      from "./pages/AuditTrail";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" />;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/verify/:parcelId?" element={<Verify />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/register"   element={<ProtectedRoute roles={["owner","admin"]}><RegisterLand /></ProtectedRoute>} />
        <Route path="/nft-deeds"  element={<NFTDeeds />} />
        <Route path="/disputes"   element={<Disputes />} />
        <Route path="/loans"      element={<Loans />} />
        <Route path="/market"     element={<Market />} />
        <Route path="/transfers"  element={<Transfers />} />
        <Route path="/sms"        element={<ProtectedRoute roles={["admin","official"]}><SMSNotifications /></ProtectedRoute>} />
        <Route path="/audit"      element={<ProtectedRoute roles={["admin","official"]}><AuditTrail /></ProtectedRoute>} />
        <Route path="/admin"      element={<ProtectedRoute roles={["admin","official"]}><AdminPanel /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}