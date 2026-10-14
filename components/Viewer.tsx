"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, ContactShadows } from "@react-three/drei";
import { useState } from "react";
import type { Furniture, Scene } from "@/lib/scene";
function Box({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}
function Item({
  o,
  selected,
  onSelect,
}: {
  o: Furniture;
  selected: boolean;
  onSelect: () => void;
}) {
  const w = o.width,
    d = o.depth,
    h = o.height,
    c = o.color;
  return (
    <group
      position={[o.x, 0, o.z]}
      rotation={[0, (o.rotation * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {o.kind === "plant" ? (
        <>
          <mesh position={[0, h * 0.2, 0]} castShadow>
            <cylinderGeometry args={[w * 0.35, w * 0.25, h * 0.4, 20]} />
            <meshStandardMaterial color="#b39277" />
          </mesh>
          <mesh position={[0, h * 0.65, 0]} castShadow>
            <sphereGeometry args={[w * 0.55, 16, 16]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </>
      ) : o.kind === "table" ? (
        <>
          <Box position={[0, h - 0.06, 0]} size={[w, 0.12, d]} color={c} />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Box
                key={`${x}${z}`}
                position={[x * w * 0.4, h / 2, z * d * 0.35]}
                size={[0.08, h, 0.08]}
                color={c}
              />
            )),
          )}
        </>
      ) : o.kind === "chair" ? (
        <>
          <Box position={[0, h * 0.45, 0]} size={[w, h * 0.12, d]} color={c} />
          <Box
            position={[0, h * 0.75, -d * 0.43]}
            size={[w, h * 0.5, d * 0.14]}
            color={c}
          />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <Box
                key={`${x}${z}`}
                position={[x * w * 0.38, h * 0.2, z * d * 0.38]}
                size={[0.06, h * 0.4, 0.06]}
                color={c}
              />
            )),
          )}
        </>
      ) : o.kind === "sofa" ? (
        <>
          <Box position={[0, h * 0.32, 0]} size={[w, h * 0.6, d]} color={c} />
          <Box
            position={[0, h * 0.75, -d * 0.38]}
            size={[w, h * 0.5, d * 0.25]}
            color={c}
          />
          {[-1, 1].map((x) => (
            <Box
              key={x}
              position={[x * (w / 2 - 0.1), h * 0.6, 0]}
              size={[0.2, h * 0.6, d]}
              color={c}
            />
          ))}
        </>
      ) : o.kind === "bed" ? (
        <>
          <Box position={[0, h * 0.35, 0]} size={[w, h * 0.7, d]} color={c} />
          <Box
            position={[0, h * 0.8, -d / 2 + 0.05]}
            size={[w, h * 1.2, 0.1]}
            color="#aa8e70"
          />
          <Box
            position={[0, h * 0.77, -d * 0.28]}
            size={[w * 0.8, h * 0.18, d * 0.22]}
            color="#f5f1e9"
          />
        </>
      ) : (
        <Box position={[0, h / 2, 0]} size={[w, h, d]} color={c} />
      )}
      {selected && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[Math.max(w, d) * 0.62, Math.max(w, d) * 0.62 + 0.035, 64]}
          />
          <meshBasicMaterial color="#d17a49" />
        </mesh>
      )}
    </group>
  );
}
export default function Viewer({
  scene,
  selected,
  onSelect,
}: {
  scene: Scene;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="viewer-fallback">
        WebGL no está disponible. Activa aceleración gráfica o usa otro
        navegador. Puedes seguir editando y guardando con los controles.
      </div>
    );
  return (
    <Canvas
      shadows
      camera={{ position: [8, 7, 9], fov: 43 }}
      onCreated={({ gl }) =>
        gl.domElement.addEventListener("webglcontextlost", () =>
          setFailed(true),
        )
      }
      fallback={<div>Tu navegador no soporta WebGL.</div>}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#e8e8e1"]} />
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[4, 9, 5]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <group>
        <Box
          position={[0, -0.1, 0]}
          size={[scene.width, 0.2, scene.depth]}
          color="#d9c8ae"
        />
        <Box
          position={[0, scene.height / 2, -scene.depth / 2]}
          size={[scene.width, scene.height, 0.12]}
          color="#f0ede5"
        />
        <Box
          position={[-scene.width / 2, scene.height / 2, 0]}
          size={[0.12, scene.height, scene.depth]}
          color="#e6e2d7"
        />
        {scene.objects.map((o) => (
          <Item
            key={o.id}
            o={o}
            selected={selected === o.id}
            onSelect={() => onSelect(o.id)}
          />
        ))}
      </group>
      <Grid
        position={[0, -0.22, 0]}
        args={[30, 30]}
        cellSize={1}
        cellColor="#c4c5ba"
        sectionColor="#b6b8aa"
        fadeDistance={35}
      />
      <ContactShadows
        position={[0, 0.003, 0]}
        opacity={0.3}
        scale={20}
        blur={2}
        far={4}
      />
      <OrbitControls
        makeDefault
        minDistance={2}
        maxDistance={35}
        maxPolarAngle={Math.PI / 2 - 0.03}
        target={[0, 0.6, 0]}
      />
    </Canvas>
  );
}
