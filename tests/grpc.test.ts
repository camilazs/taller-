import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { rpc } from "../lib/grpc";
import { emptyScene, sceneSchema, type Project } from "../lib/scene";
import { analysisToScene } from "../lib/analysis";
import fixture from "./fixtures/interior.json";
test("schema rejects invalid dimensions and object types", () => {
  assert.equal(
    sceneSchema.safeParse({ ...emptyScene, width: -2 }).success,
    false,
  );
  assert.equal(
    sceneSchema.safeParse({ ...emptyScene, objects: [{ kind: "invented" }] })
      .success,
    false,
  );
});
test("real gRPC: auth, all six RPCs, validation and disk persistence", async () => {
  const dir = await mkdtemp(path.join(process.cwd(), "test-data-"));
  process.env.GRPC_ADDRESS = "127.0.0.1:50059";
  process.env.GRPC_TOKEN = "integration-secret";
  const launch = () =>
    spawn(process.execPath, ["--import", "tsx", "backend/server.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, GRPC_BIND: "127.0.0.1:50059", DATA_DIR: dir },
      stdio: ["ignore", "pipe", "pipe"],
    });
  let child = launch();
  async function ready() {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("gRPC startup timeout")),
        15000,
      );
      child.stdout!.once("data", () => {
        clearTimeout(timer);
        resolve();
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`gRPC exited ${code}`));
      });
    });
  }
  async function stop() {
    const exited = new Promise<void>((resolve) =>
      child.once("exit", () => resolve()),
    );
    child.kill();
    await exited;
  }
  try {
    await ready();
    const project = await rpc<Project>("CreateProject", {
      name: "Prueba real",
    });
    assert.ok(project.id);
    assert.equal(
      (await rpc<Project>("GetProject", { id: project.id })).name,
      "Prueba real",
    );
    assert.ok(
      (await rpc<{ projects: Project[] }>("GetProjects")).projects.some(
        (p) => p.id === project.id,
      ),
    );
    const scene = {
      ...emptyScene,
      objects: [
        {
          id: "chair-1",
          kind: "chair",
          x: 1,
          z: 1,
          rotation: 45,
          width: 0.5,
          depth: 0.5,
          height: 0.9,
          color: "#889977",
        },
      ],
    };
    await rpc("SaveScene", {
      id: project.id,
      sceneJson: JSON.stringify(scene),
    });
    assert.deepEqual(
      JSON.parse(
        (await rpc<{ sceneJson: string }>("GetScene", { id: project.id }))
          .sceneJson,
      ),
      scene,
    );
    await assert.rejects(
      rpc("SaveScene", { id: project.id, sceneJson: '{"width":-1}' }),
    );
    process.env.GRPC_TOKEN = "wrong";
    await assert.rejects(rpc("GetProjects"), /Token inválido/);
    process.env.GRPC_TOKEN = "integration-secret";
    // Explicit test data, not an actual AI detection: conversion persists through real gRPC.
    const generated = analysisToScene(fixture).scene;
    await rpc("SaveScene", {
      id: project.id,
      sceneJson: JSON.stringify(generated),
    });
    assert.deepEqual(
      JSON.parse(
        (await rpc<{ sceneJson: string }>("GetScene", { id: project.id }))
          .sceneJson,
      ),
      generated,
    );
    await stop();
    child = launch();
    await ready();
    assert.deepEqual(
      JSON.parse(
        (await rpc<{ sceneJson: string }>("GetScene", { id: project.id }))
          .sceneJson,
      ),
      generated,
    );
    await rpc("DeleteProject", { id: project.id });
    await assert.rejects(
      rpc("GetProject", { id: project.id }),
      /no encontrado/,
    );
    await assert.rejects(rpc("GetScene", { id: "../../secret" }));
  } finally {
    if (child.exitCode === null) await stop();
    await rm(dir, { recursive: true, force: true });
  }
});
