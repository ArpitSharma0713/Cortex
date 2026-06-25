import { useRef, useState } from "react";
import api from "../api/axiosInstance";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function UploadButton({ accessToken, onUnauthorized, onUploaded, workspaceId }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setMessage("Only PDF files are accepted");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setMessage("PDF must be 10MB or smaller");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name);

    setIsUploading(true);
    setProgress(0);
    setMessage("");

    try {
      const response = await api.post(
        `/workspaces/${workspaceId}/documents`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          onUploadProgress: (event) => {
            if (event.total) {
              setProgress(Math.round((event.loaded * 100) / event.total));
            }
          },
        },
      );

      setMessage("Processing...");
      onUploaded(response.data.documentId);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        onUnauthorized();
      } else {
        setMessage(requestError.response?.data?.error || "Upload failed");
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="upload-control">
      <input
        accept="application/pdf"
        hidden
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <button
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {isUploading ? `Uploading ${progress}%` : "Upload PDF"}
      </button>
      {message && <span>{message}</span>}
    </div>
  );
}

export default UploadButton;
