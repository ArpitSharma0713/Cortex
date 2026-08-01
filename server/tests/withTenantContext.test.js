import { beforeEach, describe, expect, it, vi } from "vitest";

const { clientQueryMock, connectMock, releaseMock } = vi.hoisted(() => ({
  clientQueryMock: vi.fn(),
  connectMock: vi.fn(),
  releaseMock: vi.fn(),
}));

vi.mock("../src/config/db.js", () => ({
  default: { connect: connectMock },
}));

const { withTenantContext } = await import(
  "../src/middleware/withTenantContext.js"
);

describe("withTenantContext", () => {
  beforeEach(() => {
    clientQueryMock.mockReset().mockResolvedValue({ rows: [] });
    connectMock.mockReset().mockResolvedValue({
      query: clientQueryMock,
      release: releaseMock,
    });
    releaseMock.mockReset();
  });

  it("sets a parameterized tenant context and resets it before release", async () => {
    const callback = vi.fn().mockResolvedValue("result");

    await expect(withTenantContext("user-a", callback)).resolves.toBe("result");

    expect(clientQueryMock).toHaveBeenNthCalledWith(
      1,
      "SELECT set_config('app.current_user_id', $1, false)",
      ["user-a"],
    );
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ query: clientQueryMock }),
    );
    expect(clientQueryMock).toHaveBeenNthCalledWith(
      2,
      "RESET app.current_user_id",
    );
    expect(releaseMock).toHaveBeenCalledWith(undefined);
  });

  it("resets the context when the tenant operation fails", async () => {
    const operationError = new Error("query failed");

    await expect(
      withTenantContext("user-a", async () => {
        throw operationError;
      }),
    ).rejects.toBe(operationError);

    expect(clientQueryMock).toHaveBeenLastCalledWith("RESET app.current_user_id");
    expect(releaseMock).toHaveBeenCalledWith(undefined);
  });

  it("discards a connection when its tenant context cannot be reset", async () => {
    const resetError = new Error("reset failed");
    clientQueryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(resetError);

    await expect(
      withTenantContext("user-a", async () => "result"),
    ).rejects.toBe(resetError);

    expect(releaseMock).toHaveBeenCalledWith(resetError);
  });

  it("does not leak one user's context into the next pooled request", async () => {
    let currentUserId;
    clientQueryMock.mockImplementation(async (sql, params) => {
      if (sql.includes("set_config")) {
        currentUserId = params[0];
      } else if (sql === "RESET app.current_user_id") {
        currentUserId = undefined;
      }

      return { rows: [] };
    });

    await withTenantContext("user-a", async () => {
      expect(currentUserId).toBe("user-a");
    });
    expect(currentUserId).toBeUndefined();

    await withTenantContext("user-b", async () => {
      expect(currentUserId).toBe("user-b");
    });
    expect(currentUserId).toBeUndefined();
  });
});
