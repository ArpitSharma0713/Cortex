import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import {
  globalLimiter,
  loginLimiter,
  refreshLimiter,
  registerLimiter,
} from "../src/middleware/rateLimiters.js";

let server;
let baseUrl;

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());

  app.post(
    "/login",
    (req, res, next) => {
      req.loginUser = req.body.password === "correct" ? { id: "user-1" } : null;
      next();
    },
    loginLimiter,
    (req, res) => res.sendStatus(req.loginUser ? 200 : 401),
  );
  app.post("/register", registerLimiter, (req, res) => res.sendStatus(201));
  app.post("/refresh", refreshLimiter, (req, res) => res.sendStatus(401));
  app.get("/global", globalLimiter, (req, res) => res.sendStatus(200));

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("rate limiters", () => {
  it("blocks the sixth failed login but still allows valid credentials", async () => {
    const statuses = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);

    const validResponse = await request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correct" }),
    });

    expect(validResponse.status).toBe(200);
  });

  it("blocks registration after ten requests in the window", async () => {
    const statuses = [];

    for (let attempt = 0; attempt < 11; attempt += 1) {
      statuses.push((await request("/register", { method: "POST" })).status);
    }

    expect(statuses).toEqual([
      201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 429,
    ]);
  });

  it("blocks refresh attempts after twenty requests", async () => {
    const statuses = [];

    for (let attempt = 0; attempt < 21; attempt += 1) {
      statuses.push((await request("/refresh", { method: "POST" })).status);
    }

    expect(statuses.slice(0, 20)).toEqual(Array(20).fill(401));
    expect(statuses[20]).toBe(429);
  });

  it("allows normal traffic and blocks only after the global maximum", async () => {
    let response;

    for (let attempt = 0; attempt < 300; attempt += 1) {
      response = await request("/global");
      expect(response.status).toBe(200);
    }

    expect(response.headers.get("ratelimit-limit")).toBe("300");

    const blocked = await request("/global");
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toEqual({
      error: "Too many requests, please slow down",
    });
  });
});
