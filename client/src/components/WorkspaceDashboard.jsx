import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";
import CreateWorkspaceModal from "./CreateWorkspaceModal";
import WorkspaceLayout from "./workspace/WorkspaceLayout";
import WorkspaceCard from "./WorkspaceCard";

function WorkspaceDashboard({ accessToken, setAuth }) {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  function authHeaders() {
    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  function handleUnauthorized(requestError) {
    if (requestError.response?.status === 401) {
      setAuth({ accessToken: "", user: null });
      navigate("/login");
      return true;
    }

    return false;
  }

  function clearAuthAndRedirect() {
    setAuth({ accessToken: "", user: null });
    navigate("/login");
  }

  useEffect(() => {
    let isMounted = true;

    async function fetchWorkspaces() {
      if (!accessToken) {
        return;
      }

      try {
        const response = await api.get("/workspaces", {
          headers: authHeaders(),
        });

        if (isMounted) {
          setWorkspaces(response.data.workspaces);
          setError("");
        }
      } catch (requestError) {
        if (!handleUnauthorized(requestError) && isMounted) {
          setError("Could not load workspaces");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  async function handleCreate(payload) {
    const response = await api.post("/workspaces", payload, {
      headers: authHeaders(),
    });

    setWorkspaces((currentWorkspaces) => [
      response.data,
      ...currentWorkspaces,
    ]);
  }

  async function handleEdit(workspace) {
    const name = window.prompt("Rename workspace", workspace.name);

    if (!name || name.trim() === workspace.name) {
      return;
    }

    try {
      const response = await api.patch(
        `/workspaces/${workspace.id}`,
        { name: name.trim() },
        { headers: authHeaders() },
      );

      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.map((currentWorkspace) =>
          currentWorkspace.id === workspace.id ? response.data : currentWorkspace,
        ),
      );
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError("Could not update workspace");
      }
    }
  }

  async function handleDelete(workspace) {
    const shouldDelete = window.confirm(
      `Delete "${workspace.name}"? This cannot be undone.`,
    );

    if (!shouldDelete) {
      return;
    }

    try {
      await api.delete(`/workspaces/${workspace.id}`, {
        headers: authHeaders(),
      });
      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.filter(
          (currentWorkspace) => currentWorkspace.id !== workspace.id,
        ),
      );
      if (selectedWorkspace?.id === workspace.id) {
        setSelectedWorkspace(null);
      }
    } catch (requestError) {
      if (!handleUnauthorized(requestError)) {
        setError("Could not delete workspace");
      }
    }
  }

  return (
    <>
      {selectedWorkspace ? (
        <div className="workspace-detail">
          <button onClick={() => setSelectedWorkspace(null)} type="button">
            Back
          </button>
          <div className="workspace-toolbar">
            <div>
              <h1>{selectedWorkspace.name}</h1>
              <p>{selectedWorkspace.description || "No description"}</p>
            </div>
          </div>
          <WorkspaceLayout
            onUnauthorized={clearAuthAndRedirect}
            token={accessToken}
            workspaceId={selectedWorkspace.id}
          />
        </div>
      ) : (
        <>
      <div className="workspace-toolbar">
        <div>
          <h1>Workspaces</h1>
          <p>{workspaces.length} total</p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} type="button">
          New Workspace
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {isLoading && <p className="status-line">Loading workspaces...</p>}
      {!isLoading && workspaces.length === 0 && (
        <p className="empty-state">No workspaces yet - create your first one</p>
      )}
      <div className="workspace-grid">
        {workspaces.map((workspace) => (
          <WorkspaceCard
            key={workspace.id}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onOpen={setSelectedWorkspace}
            workspace={workspace}
          />
        ))}
      </div>
      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
        </>
      )}
    </>
  );
}

export default WorkspaceDashboard;
