"use client";
import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { Box3, Vector3, type Object3D, type Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { Furniture } from "@/lib/scene";
function disposeModel(object?: Object3D) {
  object?.traverse(o => { const mesh = o as Mesh; if (mesh.isMesh) { mesh.geometry?.dispose(); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { for (const value of Object.values(material)) if (value && typeof value === "object" && "isTexture" in value) (value as { dispose: () => void }).dispose(); material.dispose(); } } });
}
export default function GeneratedMesh({ item, password }: { item: Furniture; password: string }) {
  const [model, setModel] = useState<{ object: Object3D; size: Vector3; center: Vector3; minY: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const decoder = new DRACOLoader().setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    let loaded: Object3D | undefined;
    setModel(null); setError("");
    (async () => {
      const response = await fetch(`/api/models/${item.meshId}?asset=1`, { headers: { "x-app-password": password }, signal: controller.signal });
      if (!response.ok) throw new Error("No se pudo cargar el modelo. Revisa la contraseña y el backend.");
      const gltf = await new GLTFLoader().setDRACOLoader(decoder).parseAsync(await response.arrayBuffer(), "");
      loaded = gltf.scene;
      const box = new Box3().setFromObject(loaded), size = box.getSize(new Vector3());
      if (box.isEmpty() || [size.x, size.y, size.z].some(n => !Number.isFinite(n) || n < .000001)) throw new Error("El GLB no tiene una geometría visible válida.");
      loaded.traverse(o => { if ((o as Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      if (alive) setModel({ object: loaded, size, center: box.getCenter(new Vector3()), minY: box.min.y });
      else { disposeModel(loaded); loaded = undefined; }
    })().catch(e => { if (alive && e.name !== "AbortError") setError(e.message); });
    return () => {
      alive = false; controller.abort(); decoder.dispose();
      disposeModel(loaded); loaded = undefined;
    };
  }, [item.meshId, password]);
  if (!model) return <Html center><div className="mesh-loading" role={error ? "alert" : "status"}>{error || "Cargando malla 3D…"}</div></Html>;
  return <group scale={[item.width / model.size.x, item.height / model.size.y, item.depth / model.size.z]}><primitive object={model.object} position={[-model.center.x, -model.minY, -model.center.z]} /></group>;
}
