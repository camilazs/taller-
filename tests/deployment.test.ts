import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/projects/route";
import { projectError } from "../lib/project-error";
test("production distinguishes missing config, browser password and unavailable gRPC", async () => {
  const keys = ["NODE_ENV", "APP_PASSWORD", "VERCEL", "GRPC_ADDRESS"];
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, { NODE_ENV: "production", VERCEL: "1" });
    delete process.env.APP_PASSWORD;
    delete process.env.GRPC_ADDRESS;
    const request = () => new Request("http://localhost/api/projects");
    const missing = await GET(request());
    assert.equal(missing.status, 503);
    assert.match((await missing.json()).error, /APP_PASSWORD/);
    assert.equal((await POST(request())).status, 503);
    process.env.APP_PASSWORD = "test-only-password";
    assert.equal((await GET(request())).status, 401);
    const authenticated = new Request("http://localhost/api/projects", {
      headers: { "x-app-password": "test-only-password" },
    });
    const backend = await GET(authenticated);
    assert.equal(backend.status, 503);
    assert.match((await backend.json()).error, /GRPC_ADDRESS/);
    assert.equal(projectError({ code: 14 }).status, 503);
    assert.equal(projectError({ code: 4 }).status, 504);
    assert.equal(projectError({ code: 16 }).status, 502);
    assert.equal(projectError({ code: 5 }).status, 404);
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
