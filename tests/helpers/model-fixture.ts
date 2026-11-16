export function fixtureGLB(binaryBytes = 36) {
  // Geometría de prueba explícita: triángulo con extensión en los tres ejes. No generado con IA.
  const data = Buffer.alloc(Math.max(36, binaryBytes));
  [0, 0, 0, 1, 0, 0, 0, 1, 1].forEach((value, i) => data.writeFloatLE(value, i * 4));
  const gltf = { asset: { version: "2.0", generator: "SPACEAI TEST FIXTURE - NOT AI" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: data.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0,0,0], max: [1,1,1] }] };
  const raw = Buffer.from(JSON.stringify(gltf)), json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(json);
  const bytes = Buffer.alloc(12 + 8 + json.length + 8 + data.length);
  bytes.write("glTF"); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8); bytes.writeUInt32LE(json.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); json.copy(bytes, 20);
  bytes.writeUInt32LE(data.length, 20 + json.length); bytes.writeUInt32LE(0x004e4942, 24 + json.length); data.copy(bytes, 28 + json.length); return bytes;
}
