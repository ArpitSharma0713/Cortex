import React, { useEffect, useState } from "react";
import api from "../api/axiosInstance";

const activeStatuses = new Set(["pending", "processing"]);

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function DocumentList({ accessToken, onUnauthorized, refreshSignal, workspaceId }) {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function fetchDocuments({ quiet = false } = {}) {
    if (!quiet) {
      setIsLoading(true);
    }

    try {
      const response = await api.get(`/workspaces/${workspaceId}/documents`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setDocuments(response.data.documents);
      setError("");
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onUnauthorized();
      } else {
        setError("Could not load documents");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, [workspaceId, refreshSignal]);

  useEffect(() => {
    const hasActiveDocument = documents.some((document) =>
      activeStatuses.has(document.status),
    );

    if (!hasActiveDocument) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchDocuments({ quiet: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [documents, workspaceId, accessToken]);

  if (isLoading) {
    return <p className="status-line">Loading documents...</p>;
  }

  return (
    <section className="document-section">
      <h2>Documents</h2>
      {error && <p className="form-error">{error}</p>}
      {documents.length === 0 && (
        <p className="empty-state">No documents yet - upload your first PDF</p>
      )}
      <div className="document-list">
        {documents.map((document) => (
          <article className="document-row" key={document.id}>
            <div>
              <h3>{document.name}</h3>
              <p>{document.originalFilename}</p>
            </div>
            <span className={`status-badge status-${document.status}`}>
              {statusLabel(document.status)}
            </span>
            <dl>
              <div>
                <dt>Chunks</dt>
                <dd>{document.chunkCount}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{document.pageCount || "-"}</dd>
              </div>
              <div>
                <dt>Uploaded</dt>
                <dd>{new Date(document.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
            {document.errorMessage && (
              <p className="form-error">{document.errorMessage}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default DocumentList;
