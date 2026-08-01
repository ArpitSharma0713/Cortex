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
});
