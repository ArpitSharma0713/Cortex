import React, { useEffect, useState } from "react";
import api from "../../api/axiosInstance";

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function isEmbeddingComplete(document) {
  return (
    document.status === "ready" &&
    (document.chunkCount || 0) === (document.embeddedChunkCount || 0)
  );
}

function shouldPoll(document) {
  return (
    ["pending", "processing"].includes(document.status) ||
    (document.status === "ready" && !isEmbeddingComplete(document))
  );
}

export default function DocumentSidebar({
  onUnauthorized,
  refreshKey,
  token,
  workspaceId,
}) {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function fetchDocuments({ quiet = false } = {}) {
    if (!quiet) {
      setIsLoading(true);
    }

    try {
      const response = await api.get(`/workspaces/${workspaceId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocuments(response.data.documents);
      setError("");
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onUnauthorized?.();
      } else {
        setError("Could not load documents");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, [workspaceId, refreshKey]);

  useEffect(() => {
    if (!documents.some(shouldPoll)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchDocuments({ quiet: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [documents, workspaceId, token]);

  return (
    <section className="document-sidebar-section">
      <h2>Documents</h2>
      {error && <p className="form-error">{error}</p>}
      {isLoading && <p className="status-line">Loading documents...</p>}
      {!isLoading && documents.length === 0 && (
        <p className="empty-state">No documents yet</p>
      )}
      <div className="sidebar-document-list">
        {documents.map((document) => (
          // TODO: Filter chat context to this document when document-scoped chat is added.
          <button className="sidebar-document" key={document.id} type="button">
            <div>
              <h3>{document.name}</h3>
              <p>{document.originalFilename}</p>
            </div>
            <span className={`status-badge status-${document.status}`}>
              {statusLabel(document.status)}
            </span>
            <div className="embedding-progress">
              {(document.embeddedChunkCount || 0)} / {document.chunkCount || 0}{" "}
              embedded
            </div>
            {document.errorMessage && (
              <p className="form-error">{document.errorMessage}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
