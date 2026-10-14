import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/analyze/route";
import fixture from "./fixtures/interior.json";
import { MAX_REQUEST_BYTES } from "../lib/image";
import { readBoundedJson } from "../lib/vision";

test("without credentials, analysis is explicitly unavailable and makes no external request", async () => {
  const previousKey = process.env.AI_API_KEY;
  const previousPassword = process.env.APP_PASSWORD;
  const originalFetch = globalThis.fetch;
  delete process.env.AI_API_KEY;
  process.env.APP_PASSWORD = "test-access";
  globalThis.fetch = async () => {
    throw new Error("An external request must not occur");
  };
  try {
    const config = await (await GET()).json();
    assert.equal(config.configured, false);
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "x-app-password": "test-access" },
        body: "{}",
      }),
    );
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /no configurado/);
    const unauthorized = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: "{}",
      }),
    );
    assert.equal(unauthorized.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previousKey;
    if (previousPassword === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = previousPassword;
  }
});

test("provider contract and failures (mocked HTTP responses, NOT real AI)", async (t) => {
  const originals = {
    key: process.env.AI_API_KEY,
    password: process.env.APP_PASSWORD,
    base: process.env.AI_BASE_URL,
    format: process.env.AI_RESPONSE_FORMAT,
    fetch: globalThis.fetch,
  };
  process.env.AI_API_KEY = "test-only-not-a-real-key";
  process.env.APP_PASSWORD = "test-access";
  process.env.AI_BASE_URL = "https://example.test/v1";
  delete process.env.AI_RESPONSE_FORMAT;
  // Real tiny PNG file bytes; no external upload occurs in these tests.
  const image =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const request = (value: unknown = { image }) =>
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "x-app-password": "test-access" },
      body: JSON.stringify(value),
    });
  const envelope = (content: unknown = fixture, finish_reason = "stop") =>
    Response.json({
      choices: [
        {
          finish_reason,
          message: {
            content:
              typeof content === "string" ? content : JSON.stringify(content),
          },
        },
      ],
    });
  try {
    await t.test(
      "valid structured response sends actual image with strict schema and returns review only",
      async () => {
        globalThis.fetch = async (url, options) => {
          assert.equal(url, "https://example.test/v1/chat/completions");
          const body = JSON.parse(String(options?.body));
          assert.equal(body.response_format.type, "json_schema");
          assert.equal(body.response_format.json_schema.strict, true);
          assert.equal(body.messages[1].content[1].image_url.url, image);
          return envelope();
        };
        const response = await POST(request());
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.deepEqual(data.analysis, fixture);
        assert.equal(data.scene, undefined);
        assert.equal(response.headers.get("cache-control"), "no-store");
      },
    );
    await t.test(
      "compatible JSON mode keeps schema in prompt and validates locally",
      async () => {
        process.env.AI_RESPONSE_FORMAT = "json_object";
        globalThis.fetch = async (_, options) => {
          const body = JSON.parse(String(options?.body));
          assert.equal(body.response_format.type, "json_object");
          assert.match(body.messages[0].content, /Esquema JSON/);
          return envelope();
        };
        assert.equal((await POST(request())).status, 200);
        delete process.env.AI_RESPONSE_FORMAT;
      },
    );
    await t.test(
      "file type, MIME spoofing, base64, size and malformed JSON fail before any provider call",
      async () => {
        globalThis.fetch = async () => {
          throw new Error("Provider must not be called");
        };
        for (const invalid of [
          "data:image/svg+xml;base64,PHN2Zz4=",
          image.replace("image/png", "image/jpeg"),
          "data:image/png;base64,abcd",
          undefined,
        ])
          assert.equal((await POST(request({ image: invalid }))).status, 400);
        const huge =
          "data:image/png;base64," +
          Buffer.alloc(3 * 1024 * 1024 + 1).toString("base64");
        assert.equal((await POST(request({ image: huge }))).status, 413);
        const badJson = new Request("http://localhost/api/analyze", {
          method: "POST",
          headers: { "x-app-password": "test-access" },
          body: "{",
        });
        assert.equal((await POST(badJson)).status, 400);
      },
    );
    await t.test(
      "invalid/incomplete provider output and non-interior images are rejected",
      async () => {
        for (const [reply, status, code] of [
          [envelope("not-json"), 502, "INVALID_ANALYSIS"],
          [envelope({ roomType: "Sala" }), 502, "INVALID_ANALYSIS"],
          [
            envelope({
              ...fixture,
              objects: [{ ...fixture.objects[0], u: 3 }],
            }),
            502,
            "INVALID_ANALYSIS",
          ],
          [envelope(fixture, "length"), 502, "INCOMPLETE_ANALYSIS"],
          [Response.json({ choices: [] }), 502, "INVALID_ANALYSIS"],
          [envelope({ ...fixture, isInterior: false }), 422, "NOT_INTERIOR"],
          [
            Response.json({
              choices: [
                {
                  finish_reason: "stop",
                  message: { content: null, refusal: "cannot" },
                },
              ],
            }),
            422,
            "ANALYSIS_REFUSED",
          ],
        ] as const) {
          globalThis.fetch = async () => reply;
          const response = await POST(request());
          assert.equal(response.status, status);
          assert.equal((await response.json()).code, code);
        }
      },
    );
    await t.test(
      "provider auth, quota, outage, timeout and invalid response bodies have controlled errors",
      async () => {
        for (const status of [400, 401, 403, 429, 500]) {
          globalThis.fetch = async () =>
            new Response("provider private detail", { status });
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
        globalThis.fetch = async () => {
          throw new Error("Network failed with private detail");
        };
        assert.equal((await POST(request())).status, 502);
        globalThis.fetch = async () => new Response("invalid JSON");
        assert.equal((await POST(request())).status, 502);
      },
    );
    await t.test(
      "streaming body limits apply even without content-length",
      async () => {
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(MAX_REQUEST_BYTES + 1));
            controller.close();
          },
        });
        await assert.rejects(
          readBoundedJson(new Response(body), MAX_REQUEST_BYTES),
          /tamaño/,
        );
      },
    );
  } finally {
    globalThis.fetch = originals.fetch;
    for (const [env, value] of [
      ["AI_API_KEY", originals.key],
      ["APP_PASSWORD", originals.password],
      ["AI_BASE_URL", originals.base],
      ["AI_RESPONSE_FORMAT", originals.format],
    ]) {
      if (value === undefined) delete process.env[env!];
      else process.env[env!] = value;
    }
  }
});
