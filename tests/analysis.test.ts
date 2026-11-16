import { test } from "node:test";
import assert from "node:assert/strict";
import fixture from "./fixtures/interior.json";
import { analysisSchema, analysisToScene } from "../lib/analysis";
import { kinds, catalog, sceneSchema } from "../lib/scene";

test("TEST FIXTURE, not real AI: normalized floor layout converts to editable scene", () => {
  const { scene, warnings } = analysisToScene(fixture);
  assert.equal(scene.objects.length, 2);
  assert.equal(sceneSchema.safeParse(scene).success, true);
  assert.equal(scene.objects[0].x, -0.95);
  assert.equal(scene.objects[0].z, -0.82);
  assert.ok(
    warnings.some((w) => w.includes("Lámpara") && w.includes("no se generó")),
  );
  const excluded = analysisToScene(fixture, [0]);
  assert.equal(excluded.scene.objects.length, 1);
  assert.equal(excluded.scene.objects[0].kind, "table");
});
test("all six categories, corrected dimensions, rotations and edge positions", () => {
  const input = {
    ...fixture,
    room: { ...fixture.room, width: 8 },
    objects: kinds.map((kind, i) => ({
      ...fixture.objects[0],
      ...catalog[kind],
      kind,
      u: i % 2,
      v: 1,
      rotation: 90,
    })),
  };
  // Catalog labels are accepted, but no unrecognized properties enter the contract.
  const { scene } = analysisToScene(input);
  assert.equal(scene.width, 8);
  assert.equal(scene.objects.length, 6);
  for (const o of scene.objects) {
    assert.ok(Math.abs(o.x) + o.depth / 2 <= 4.001);
    assert.ok(Math.abs(o.z) + o.width / 2 <= 2.501);
  }
  assert.equal(new Set(scene.objects.map((o) => o.id)).size, 6);
});
test("invalid, incomplete and non-interior analyses cannot become scenes", () => {
  assert.equal(
    analysisSchema.safeParse({ ...fixture, room: { width: 6 } }).success,
    false,
  );
  assert.equal(
    analysisSchema.safeParse({
      ...fixture,
      objects: [{ ...fixture.objects[0], u: 1.5 }],
    }).success,
    false,
  );
  assert.equal(
    analysisSchema.safeParse({
      ...fixture,
      objects: [{ ...fixture.objects[0], kind: "television" }],
    }).success,
    false,
  );
  assert.throws(() => analysisToScene({ ...fixture, isInterior: false }));
  assert.throws(() =>
    analysisToScene({ ...fixture, room: { ...fixture.room, width: -2 } }),
  );
});
test("oversized furniture is reported; unknown models never become invented meshes", () => {
  const result = analysisToScene({
    ...fixture,
    room: { ...fixture.room, width: 0.5, depth: 0.5 },
  });
  assert.equal(result.scene.objects[0].x, 0);
  assert.ok(result.warnings.some((w) => w.includes("superan")));
  assert.ok(result.scene.objects.every((o) => kinds.includes(o.kind)));
});

test("thin unsupported observations are reported without producing invalid scene meshes", () => {
  const value = {
    ...fixture,
    objects: [{ ...fixture.objects[2], kind: "unsupported", depth: 0.03 }],
  };
  assert.equal(analysisSchema.safeParse(value).success, true);
  assert.equal(analysisToScene(value).scene.objects.length, 0);
  assert.equal(
    analysisSchema.safeParse({
      ...value,
      objects: [{ ...value.objects[0], kind: "sofa" }],
    }).success,
    false,
  );
});
