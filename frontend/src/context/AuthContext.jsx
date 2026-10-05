import { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { toast } from "react-toastify";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(localStorage.getItem("lc_token") || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [token]);

  async function fetchMe() {
    try {
      const { data } = await axios.get("/api/auth/me");
      setUser(data.user);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function connectWallet() {
    try {
      if (!window.ethereum)
        return toast.error("MetaMask not found. Please install MetaMask.");

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer   = provider.getSigner();
      const wallet   = (await signer.getAddress()).toLowerCase();

      const { data: nonceData } = await axios.get(`/api/auth/nonce/${wallet}`);
      const signature = await signer.signMessage(nonceData.message);
      const { data: loginData } = await axios.post("/api/auth/login", { walletAddress: wallet, signature });

      if (loginData.requireOTP) {
        toast.info("OTP sent to your phone.");
        return { requireOTP: true, walletAddress: wallet };
      }

      localStorage.setItem("lc_token", loginData.token);
      setToken(loginData.token);
      setUser(loginData.user);
      axios.defaults.headers.common["Authorization"] = `Bearer ${loginData.token}`;
      toast.success("Wallet connected!");
      return { success: true };
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
      return { success: false };
    }
  }

  function logout() {
    localStorage.removeItem("lc_token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, connectWallet, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);