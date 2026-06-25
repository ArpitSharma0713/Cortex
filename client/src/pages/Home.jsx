import { useEffect, useState } from "react";
import api from "../api/axiosInstance";

const styles = {
  page: {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "48px 24px",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: "#f6f7f9",
    color: "#17202a",
  },
  panel: {
    maxWidth: "720px",
    margin: "0 auto",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#5d6675",
    fontSize: "14px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0",
  },
  title: {
    margin: "0 0 12px",
    fontSize: "40px",
    lineHeight: 1.1,
  },
  copy: {
    margin: "0 0 28px",
    color: "#4c5565",
    fontSize: "17px",
    lineHeight: 1.6,
  },
  healthBox: {
    border: "1px solid #d9dee8",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "20px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "16px",
    fontWeight: 700,
  },
  indicator: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    flex: "0 0 auto",
  },
  pre: {
    margin: 0,
    padding: "16px",
    borderRadius: "6px",
    overflowX: "auto",
    background: "#111827",
    color: "#f9fafb",
    fontSize: "14px",
    lineHeight: 1.5,
  },
};

function Home() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const isHealthy = health?.status === "ok" && health?.db === "connected";

  useEffect(() => {
    let isMounted = true;

    async function fetchHealth() {
      try {
        const response = await api.get("/health");

        if (isMounted) {
          setHealth(response.data);
          setError("");
        }
      } catch (requestError) {
        if (isMounted) {
          setHealth(
            requestError.response?.data || {
              status: "error",
              timestamp: new Date().toISOString(),
              db: "disconnected",
            },
          );
          setError(requestError.message);
        }
      }
    }

    fetchHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <p style={styles.eyebrow}>Assignment 1 Scaffold</p>
        <h1 style={styles.title}>Cortex</h1>
        <p style={styles.copy}>
          Express, React, and PostgreSQL are wired together with a live health
          check.
        </p>

        <div style={styles.healthBox}>
          <div style={styles.statusRow}>
            <span
              aria-label={isHealthy ? "Healthy" : "Unhealthy"}
              style={{
                ...styles.indicator,
                background: isHealthy ? "#16a34a" : "#dc2626",
              }}
            />
            <span>{isHealthy ? "Backend connected" : "Backend unavailable"}</span>
          </div>

          <pre style={styles.pre}>
            {JSON.stringify(
              health || {
                status: "loading",
                timestamp: new Date().toISOString(),
                db: "checking",
                ...(error && { error }),
              },
              null,
              2,
            )}
          </pre>
        </div>
      </section>
    </main>
  );
}

export default Home;
