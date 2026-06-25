import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaceById,
  getWorkspacesByUser,
  updateWorkspace,
} from "../services/workspaceService.js";

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function formatWorkspace(workspace) {
  return {
    id: workspace.id,
    userId: workspace.user_id,
    name: workspace.name,
    description: workspace.description,
    mode: workspace.mode,
    documentCount: workspace.document_count,
    createdAt: workspace.created_at,
    updatedAt: workspace.updated_at,
  };
}

export async function create(req, res, next) {
  try {
    const workspace = await createWorkspace(req.user.id, req.body);

    return res.status(201).json(formatWorkspace(workspace));
  } catch (error) {
    return next(error);
  }
}

export async function list(req, res, next) {
  try {
    const workspaces = await getWorkspacesByUser(req.user.id);

    return res.status(200).json({
      workspaces: workspaces.map(formatWorkspace),
      count: workspaces.length,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getOne(req, res, next) {
  try {
    const workspace = await getWorkspaceById(req.params.id, req.user.id);

    if (!workspace) {
      throw createError(404, "Workspace not found");
    }

    return res.status(200).json(formatWorkspace(workspace));
  } catch (error) {
    return next(error);
  }
}

export async function update(req, res, next) {
  try {
    const workspace = await updateWorkspace(req.params.id, req.user.id, req.body);

    if (!workspace) {
      throw createError(404, "Workspace not found");
    }

    return res.status(200).json(formatWorkspace(workspace));
  } catch (error) {
    return next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const wasDeleted = await deleteWorkspace(req.params.id, req.user.id);

    if (!wasDeleted) {
      throw createError(404, "Workspace not found");
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
