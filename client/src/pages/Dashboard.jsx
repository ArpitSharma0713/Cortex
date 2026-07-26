import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axiosInstance";
import WorkspaceDashboard from "../components/WorkspaceDashboard";

function Dashboard({ auth, setAuth }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState("Loading dashboard...");
  const oauthAccessToken = searchParams.get("accessToken");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (oauthAccessToken) {
      setAuth((currentAuth) => ({
        ...currentAuth,
        accessToken: oauthAccessToken,
      }));
      setSearchParams({});
    }
  }, [oauthAccessToken, setAuth, setSearchParams]);

  useEffect(() => {
    if (oauthAccessToken) {
      return undefined;
    }

    let isMounted = true;

    async function loadUser() {
      try {
        let accessToken = auth.accessToken;

        if (!accessToken) {
          const refreshResponse = await api.post("/auth/refresh");
          accessToken = refreshResponse.data.accessToken;
          setAuth(refreshResponse.data);
        }

        const meResponse = await api.get("/auth/me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (isMounted) {
          setAuth((currentAuth) => ({
            ...currentAuth,
            user: meResponse.data.user,
            accessToken,
          }));
          setStatus("Authenticated");
        }
      } catch (requestError) {
        if (isMounted) {
          setAuth({ accessToken: "", user: null });
          setStatus("Session expired");
          navigate("/login");
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [auth.accessToken, navigate, oauthAccessToken, setAuth]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await api.post("/auth/logout");
    } finally {
      setAuth({ accessToken: "", user: null });
      setIsLoggingOut(false);
      navigate("/login");
    }
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-panel">
        <nav className="top-nav">
          <Link to="/">Cortex</Link>
          <button disabled={isLoggingOut} onClick={handleLogout} type="button">
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </nav>
        <p className="status-line">{status}</p>
        {auth.user && auth.accessToken && (
          <WorkspaceDashboard accessToken={auth.accessToken} setAuth={setAuth} />
        )}
      </section>
    </main>
  );
}

export default Dashboard;
