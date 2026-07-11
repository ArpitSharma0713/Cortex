import React, { useCallback, useRef, useState } from "react";
import api from "../../api/axiosInstance";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function UploadDropzone({
  onUnauthorized,
  onUploadStart,
  token,
  workspaceId,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = useCallback(
    async (file) => {
      setError(null);

      if (file.type !== "application/pdf") {
        setError("Only PDF files are accepted");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("File must be under 10MB");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);

      try {
        setProgress(0);
        await api.post(`/workspaces/${workspaceId}/documents`, formData, {
          headers: { Authorization: `Bearer ${token}` },
          onUploadProgress: (event) => {
            if (event.total) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          },
        });
        setProgress(null);
        onUploadStart();
      } catch (requestError) {
        if (requestError.response?.status === 401) {
          onUnauthorized?.();
        } else {
          setError(requestError.response?.data?.error || "Upload failed");
        }
        setProgress(null);
      }
    },
    [workspaceId, token, onUploadStart, onUnauthorized],
  );

  return (
    <div
      className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragLeave={() => setIsDragging(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];

        if (file) {
          handleFile(file);
        }
      }}
      role="button"
      tabIndex="0"
    >
      {progress !== null ? (
        <p>Uploading... {progress}%</p>
      ) : (
        <>
          <p>Drag a PDF here, or click to browse</p>
          <input
            accept="application/pdf"
            hidden
            onChange={(event) =>
              event.target.files[0] && handleFile(event.target.files[0])
            }
            ref={inputRef}
            type="file"
          />
        </>
      )}
      {error && <p className="dropzone-error">{error}</p>}
    </div>
  );
}
