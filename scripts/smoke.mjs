import assert from "node:assert/strict";

const base = process.env.SMOKE_URL || "http://localhost:3101";
const password = process.env.SMOKE_PASSWORD || "";
const headers = {
  "Content-Type": "application/json",
  "x-app-password": password,
};
async function request(path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.ok, true, JSON.stringify(data));
  return data;
}
let id;
try {
  assert.equal((await fetch(base)).status, 200);
  if (password) assert.equal((await fetch(base + "/api/projects")).ok, false);
  const project = await request("/api/projects", "POST", {
    name: "Prueba temporal de producción",
  });
  id = project.id;
  const scene = {
    roomType: "Sala",
    width: 6,
    depth: 5,
    height: 2.8,
    objects: [
      {
        id: "sofa-smoke",
        kind: "sofa",
        x: 1,
        z: 0,
        rotation: 45,
        width: 2.2,
        depth: 0.9,
        height: 0.85,
        color: "#7c9186",
      },
    ],
  };
  await request(`/api/projects/${id}`, "PUT", scene);
  assert.deepEqual((await request(`/api/projects/${id}`)).scene, scene);
  assert.ok((await request("/api/projects")).projects.some((p) => p.id === id));
  const configuration = await request("/api/analyze");
  assert.equal(typeof configuration.configured, "boolean");
  console.log(
    "PASS: página, autenticación, Next.js → gRPC, creación, guardado, listado y recuperación en producción local.",
  );
} finally {
  if (id) {
    await request(`/api/projects/${id}`, "DELETE");
    console.log("PASS: proyecto temporal eliminado mediante gRPC.");
  }
}
