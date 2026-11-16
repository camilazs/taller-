import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/analyze/route";
import fixture from "./fixtures/interior.json";

test("native Claude image analysis contract and errors (mocked, not real detections)", async (t) => {
  const keys = [
    "AI_PROVIDER",
    "ANTHROPIC_API_KEY",
    "AI_API_KEY",
    "AI_BASE_URL",
    "AI_MODEL",
    "APP_PASSWORD",
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    AI_PROVIDER: "anthropic",
    ANTHROPIC_API_KEY: "test-only-secret",
    AI_BASE_URL: "https://api.anthropic.com/v1",
    AI_MODEL: "claude-haiku-4-5-20251001",
    APP_PASSWORD: "test-access",
  });
  delete process.env.AI_API_KEY;
  const image =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const request = () =>
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "x-app-password": "test-access" },
      body: JSON.stringify({ image }),
    });
  const reply = (input: unknown = fixture, stop_reason = "tool_use") =>
    Response.json({
      stop_reason,
      content: [{ type: "tool_use", name: "submit_interior_analysis", input }],
    });
  try {
    await t.test(
      "native Messages endpoint, private headers, base64 image and schema",
      async () => {
        assert.equal((await (await GET()).json()).configured, true);
        globalThis.fetch = async (url, options) => {
          assert.equal(url, "https://api.anthropic.com/v1/messages");
          const headers = options?.headers as Record<string, string>;
          assert.equal(headers["x-api-key"], "test-only-secret");
          assert.equal(headers["anthropic-version"], "2023-06-01");
          assert.equal(headers.Authorization, undefined);
          const body = JSON.parse(String(options?.body));
          assert.equal(body.model, "claude-haiku-4-5-20251001");
          assert.equal(body.messages[0].content[0].source.type, "base64");
          assert.equal(
            body.messages[0].content[0].source.media_type,
            "image/png",
          );
          assert.equal(
            body.messages[0].content[0].source.data,
            image.split(",")[1],
          );
          assert.equal(body.tool_choice.name, "submit_interior_analysis");
          assert.ok(body.tools[0].input_schema.properties.room);
          assert.equal(body.tools[0].strict, true);
          assert.equal(
            body.tools[0].input_schema.properties.room.properties.width.minimum,
            undefined,
          );
          assert.match(
            body.tools[0].input_schema.properties.room.properties.width
              .description,
            /minimum=0.5/,
          );
          return reply();
        };
        const response = await POST(request());
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.deepEqual(data.analysis, fixture);
        assert.equal(data.scene, undefined);
        assert.ok(!JSON.stringify(data).includes("test-only-secret"));
      },
    );
    await t.test(
      "invalid schema, truncation, refusal, non-interior and missing tool never become scenes",
      async () => {
        for (const [response, status, code] of [
          [reply({ roomType: "Sala" }), 502, "INVALID_ANALYSIS"],
          [reply(fixture, "max_tokens"), 502, "INCOMPLETE_ANALYSIS"],
          [reply(fixture, "refusal"), 422, "ANALYSIS_REFUSED"],
          [reply({ ...fixture, isInterior: false }), 422, "NOT_INTERIOR"],
          [
            Response.json({ stop_reason: "tool_use", content: [] }),
            502,
            "INVALID_ANALYSIS",
          ],
        ] as const) {
          globalThis.fetch = async () => response;
          const actual = await POST(request());
          assert.equal(actual.status, status);
          assert.equal((await actual.json()).code, code);
        }
      },
    );
    await t.test(
      "provider errors, missing credentials and timeout remain controlled",
      async () => {
        for (const status of [400, 401, 403, 404, 429, 529]) {
          globalThis.fetch = async () =>
            new Response("private detail", { status });
          const response = await POST(request());
          assert.equal(response.status, status === 429 ? 429 : 502);
          assert.ok(
            !JSON.stringify(await response.json()).includes("private detail"),
          );
        }
        globalThis.fetch = async () => {
          throw new DOMException("timeout", "TimeoutError");
        };
        assert.equal((await POST(request())).status, 504);
        delete process.env.ANTHROPIC_API_KEY;
        assert.equal((await (await GET()).json()).configured, false);
        assert.equal((await POST(request())).status, 503);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
