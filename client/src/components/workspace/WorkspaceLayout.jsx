import { useState } from "react";
import ChatInterface from "../chat/ChatInterface";
import DocumentSidebar from "../documents/DocumentSidebar";
import UploadDropzone from "../documents/UploadDropzone";

export default function WorkspaceLayout({ onUnauthorized, token, workspaceId }) {
  const [refreshDocs, setRefreshDocs] = useState(0);

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <UploadDropzone
          onUnauthorized={onUnauthorized}
          onUploadStart={() => setRefreshDocs((currentValue) => currentValue + 1)}
          token={token}
          workspaceId={workspaceId}
        />
        <DocumentSidebar
          onUnauthorized={onUnauthorized}
          refreshKey={refreshDocs}
          token={token}
          workspaceId={workspaceId}
        />
      </aside>
      <main className="workspace-chat">
        <ChatInterface
          onUnauthorized={onUnauthorized}
          token={token}
          workspaceId={workspaceId}
        />
      </main>
    </div>
  );
}

