// Test-only HTTP fixture. This is NOT an AI service and is never used by default.
import http from "node:http";
import { readFileSync } from "node:fs";
if (process.env.SPACEAI_FIXTURE_TEST !== "1")
  throw new Error("Solo pruebas: requiere SPACEAI_FIXTURE_TEST=1");
const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/interior.json", import.meta.url), "utf8"),
);
const server = http.createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404);
    response.end("TEST FIXTURE ONLY - NOT AI");
    return;
  }
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4_250_000) {
      response.writeHead(413);
      response.end();
      return;
    }
  }
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(
    JSON.stringify({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(fixture) },
        },
      ],
    }),
  );
});
server.listen(50100, "127.0.0.1", () =>
  console.log(
    "SOLO PRUEBAS: fixture HTTP local en 50100. NO es IA real. Los resultados están marcados como PRUEBA.",
  ),
);
process.on("SIGTERM", () => server.close(() => process.exit(0)));
