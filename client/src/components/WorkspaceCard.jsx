function modeLabel(mode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function WorkspaceCard({ workspace, onDelete, onEdit }) {
  return (
    <article className="workspace-card">
      <div className="workspace-card-header">
        <div>
          <h2>{workspace.name}</h2>
          <span className={`mode-badge mode-${workspace.mode}`}>
            {modeLabel(workspace.mode)}
          </span>
        </div>
        <div className="workspace-actions">
          <button onClick={() => onEdit(workspace)} type="button">
            Edit
          </button>
          <button
            className="danger-button"
            onClick={() => onDelete(workspace)}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      <p className="workspace-description">
        {workspace.description || "No description"}
      </p>
      <dl className="workspace-meta">
        <div>
          <dt>Documents</dt>
          <dd>{workspace.documentCount}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{new Date(workspace.createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>
    </article>
  );
}

export default WorkspaceCard;
