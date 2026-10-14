"use client";
import dynamic from "next/dynamic";
import PhotoAnalysis from "./PhotoAnalysis";
import { useEffect, useState } from "react";
import {
  Box,
  LayoutDashboard,
  Plus,
  ArrowUpRight,
  Sparkles,
  Save,
  Trash2,
  RotateCw,
  Move,
  Armchair,
  BedDouble,
  Table2,
  Leaf,
  PanelTop,
  Check,
  Menu,
} from "lucide-react";
import {
  catalog,
  emptyScene,
  kinds,
  type Furniture,
  type Project,
  type Scene,
} from "@/lib/scene";
const Viewer = dynamic(() => import("./Viewer"), {
  ssr: false,
  loading: () => (
    <div className="viewer-fallback">Preparando tu espacio 3D…</div>
  ),
});
const icons = {
  bed: BedDouble,
  table: Table2,
  chair: Armchair,
  sofa: Armchair,
  cabinet: PanelTop,
  plant: Leaf,
};
export default function Studio() {
  const [projects, setProjects] = useState<Project[]>([]),
    [active, setActive] = useState<Project | null>(null),
    [scene, setScene] = useState<Scene>(emptyScene),
    [selected, setSelected] = useState<string | null>(null),
    [view, setView] = useState<"home" | "editor">("home"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [name, setName] = useState("Mi nuevo espacio"),
    [configured, setConfigured] = useState(false),
    [password, setPassword] = useState(""),
    [dirty, setDirty] = useState(false),
    [mobile, setMobile] = useState(false);
  const item = scene.objects.find((o) => o.id === selected);
  async function api(url: string, method = "GET", body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-app-password": password,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error de conexión");
    return data;
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const data = await api("/api/projects");
    setProjects(data.projects || []);
  }
  useEffect(() => {
    fetch("/api/analyze")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured);
        if (!d.authRequired) run(refresh);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(next: Scene) {
    setScene(next);
    setDirty(true);
    setMessage("");
  }
  function patch(values: Partial<Furniture>) {
    if (item)
      change({
        ...scene,
        objects: scene.objects.map((o) =>
          o.id === item.id ? { ...o, ...values } : o,
        ),
      });
  }
  function safeLeave() {
    return (
      !dirty ||
      window.confirm("Hay cambios sin guardar. ¿Continuar y descartarlos?")
    );
  }
  async function create() {
    if (!safeLeave()) return;
    await run(async () => {
      const project = await api("/api/projects", "POST", { name });
      setActive(project);
      setScene({ ...emptyScene, objects: [] });
      setSelected(null);
      setDirty(false);
      setView("editor");
      await refresh();
    });
  }
  async function open(p: Project) {
    if (!safeLeave()) return;
    await run(async () => {
      const data = await api("/api/projects/" + p.id);
      setActive(data.project);
      setScene(data.scene);
      setSelected(null);
      setDirty(false);
      setView("editor");
    });
  }
  function add(kind: Furniture["kind"]) {
    const { label, ...defaults } = catalog[kind];
    void label;
    const object: Furniture = {
      ...defaults,
      id: crypto.randomUUID(),
      kind,
      x: 0,
      z: 0,
      rotation: 0,
    };
    change({ ...scene, objects: [...scene.objects, object] });
    setSelected(object.id);
  }
  return (
    <div className="shell">
      <aside inert={busy} className={`sidebar ${mobile ? "visible" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (safeLeave()) setView("home");
          }}
        >
          <span className="brand-icon">
            <Box size={24} />
          </span>
          spaceai<span className="brand-3d">3D</span>
        </a>
        <div className="workspace-label">TU ESTUDIO PERSONAL</div>
        <button
          className={view === "home" ? "nav active" : "nav"}
          onClick={() => {
            if (safeLeave()) setView("home");
            setMobile(false);
          }}
        >
          <LayoutDashboard size={18} />
          Mis proyectos
        </button>
        <button
          className={view === "editor" ? "nav active" : "nav"}
          disabled={!active}
          onClick={() => {
            setView("editor");
            setMobile(false);
          }}
        >
          <Box size={18} />
          Estudio 3D
        </button>
        <div className="sidebar-bottom">
          <div className="status-dot" /> gRPC · Protocol Buffers
          <p>
            Diseñado para imaginar.
            <br />
            Construido para organizar.
          </p>
          <div className="avatar">
            S
            <span>
              SpaceAI Studio<small>Proyecto universitario</small>
            </span>
          </div>
        </div>
      </aside>
      <main inert={busy}>
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Abrir menú"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <span>
            Workspace <span className="slash">/</span>{" "}
            <b>{view === "home" ? "Mis proyectos" : active?.name}</b>
          </span>
          <span className="top-tag">
            ESTUDIO DE INTERIORES <span>β</span>
          </span>
        </header>
        <div className="feedback" aria-live="polite">
          {error && <div className="error">{error}</div>}
          {message && (
            <div className="success">
              <Check size={16} />
              {message}
            </div>
          )}
        </div>
        {view === "home" ? (
          <div className="dashboard">
            <div className="page-heading">
              <div>
                <div className="eyebrow">MENOS LÍMITES. MÁS POSIBILIDADES.</div>
                <h1>
                  Tu próximo espacio
                  <br />
                  empieza con una idea<span>.</span>
                </h1>
                <p>
                  De una fotografía a una nueva perspectiva. Explora, organiza
                  <br className="desktop" /> y dale forma a los espacios que
                  imaginas.
                </p>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="art-room">
                  <div className="art-window" />
                  <div className="art-sofa" />
                  <div className="art-rug" />
                  <div className="art-table" />
                  <div className="art-plant">✦</div>
                </div>
                <span className="art-label">
                  <Box size={14} /> UN ESPACIO, INFINITAS IDEAS
                </span>
              </div>
            </div>
            <section className="create-strip">
              <div className="strip-icon">
                <Sparkles />
              </div>
              <div>
                <h3>Diseña algo que se sienta tuyo</h3>
                <p>Crea una habitación y empieza a organizar en 3D.</p>
              </div>
              <input
                aria-label="Nombre del proyecto"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del proyecto"
              />
              <button
                className="primary"
                disabled={busy || !name.trim()}
                onClick={create}
              >
                <Plus size={17} />
                Nuevo proyecto
              </button>
            </section>
            <div className="section-heading">
              <h2>
                Mis proyectos{" "}
                <span>{projects.length.toString().padStart(2, "0")}</span>
              </h2>
              <button
                className="text-btn"
                disabled={busy}
                onClick={() => run(refresh)}
              >
                Actualizar proyectos <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="access-row">
              <label>
                Acceso al estudio{" "}
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Contraseña (si está configurada)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <span>
                La conexión se comprueba al crear o actualizar proyectos.
              </span>
            </div>
            <div className="project-grid">
              <button className="new-card" disabled={busy} onClick={create}>
                <span>
                  <Plus />
                </span>
                <h3>Un lienzo en blanco</h3>
                <p>Tu siguiente gran idea vive aquí</p>
              </button>
              {projects.map((p, i) => (
                <article className="project-card" key={p.id}>
                  <button
                    className={`project-preview tone-${i % 3}`}
                    onClick={() => open(p)}
                    disabled={busy}
                  >
                    <Box size={60} strokeWidth={0.8} />
                    <span>
                      ABRIR ESTUDIO <ArrowUpRight size={14} />
                    </span>
                  </button>
                  <div className="project-meta">
                    <div>
                      <h3>{p.name}</h3>
                      <p>
                        {new Date(p.updatedAt).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "long",
                        })}{" "}
                        · Distribución 3D
                      </p>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label={`Eliminar ${p.name}`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Eliminar permanentemente «${p.name}»?`,
                          )
                        )
                          run(async () => {
                            await api("/api/projects/" + p.id, "DELETE");
                            if (active?.id === p.id) {
                              setActive(null);
                              setDirty(false);
                            }
                            await refresh();
                          });
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="workflow">
              <div>
                <span>01</span>
                <h3>Captura tu espacio</h3>
                <p>Sube una fotografía del interior.</p>
              </div>
              <div>
                <span>02</span>
                <h3>Explora en 3D</h3>
                <p>IA configurable o creación manual.</p>
              </div>
              <div>
                <span>03</span>
                <h3>Hazlo tuyo</h3>
                <p>Distribuye muebles y guarda tu idea.</p>
              </div>
            </div>
            <footer>
              SPACEAI 3D <span>Una nueva forma de ver tus espacios.</span>
            </footer>
          </div>
        ) : (
          <div className="editor">
            <div className="editor-heading">
              <div>
                <div className="eyebrow">
                  ESTUDIO 3D / {scene.roomType.toUpperCase()}
                </div>
                <h1>
                  {active?.name}{" "}
                  <span className="dirty">
                    {dirty ? "Sin guardar" : "Guardado"}
                  </span>
                </h1>
              </div>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("/api/projects/" + active!.id, "PUT", scene);
                    setDirty(false);
                    setMessage("Distribución guardada mediante gRPC.");
                  })
                }
              >
                <Save size={17} />
                {busy ? "Procesando…" : "Guardar proyecto"}
              </button>
            </div>
            <div className="editor-grid">
              <section className="scene-panel">
                <div className="scene-toolbar">
                  <span>
                    <span className="status-dot" />
                    Vista perspectiva
                  </span>
                  <span>
                    {scene.width} × {scene.depth} m · {scene.objects.length}{" "}
                    objetos
                  </span>
                </div>
                <div className="canvas-wrap">
                  <Viewer
                    scene={scene}
                    selected={selected}
                    onSelect={setSelected}
                  />
                  <div className="canvas-badge">
                    <Box size={15} /> SPACEAI / LIVE 3D
                  </div>
                </div>
                <div className="scene-help">
                  <Move size={14} /> Arrastra para orbitar · Rueda para zoom ·
                  Clic para seleccionar
                </div>
              </section>
              <aside className="tools">
                <section className="tool-section">
                  <h3>
                    Tu habitación <span>METROS</span>
                  </h3>
                  <div className="three-inputs">
                    {(["width", "depth", "height"] as const).map((key, i) => (
                      <label key={key}>
                        {["Ancho", "Fondo", "Alto"][i]}
                        <input
                          type="number"
                          min="0.5"
                          max="30"
                          step="0.1"
                          value={scene[key]}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (v >= 0.5 && v <= 30)
                              change({ ...scene, [key]: v });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </section>
                <section className="tool-section">
                  <h3>
                    Catálogo de muebles <Armchair size={16} />
                  </h3>
                  <div className="catalog">
                    {kinds.map((kind) => {
                      const Icon = icons[kind];
                      return (
                        <button
                          key={kind}
                          disabled={scene.objects.length >= 100}
                          onClick={() => add(kind)}
                        >
                          <Icon size={25} strokeWidth={1.3} />
                          <span>{catalog[kind].label}</span>
                          <Plus size={12} />
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section className="tool-section">
                  <h3>
                    Transformar <Move size={16} />
                  </h3>
                  {item ? (
                    <>
                      <select
                        aria-label="Objeto seleccionado"
                        value={selected || ""}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        {scene.objects.map((o, i) => (
                          <option key={o.id} value={o.id}>
                            {catalog[o.kind].label} {i + 1}
                          </option>
                        ))}
                      </select>
                      <div className="two-inputs">
                        {(
                          [
                            "x",
                            "z",
                            "rotation",
                            "width",
                            "depth",
                            "height",
                          ] as const
                        ).map((key, i) => (
                          <label key={key}>
                            {
                              [
                                "Posición X (m)",
                                "Posición Z (m)",
                                "Rotación (°)",
                                "Ancho (m)",
                                "Fondo (m)",
                                "Alto (m)",
                              ][i]
                            }
                            <input
                              type="number"
                              step={key === "rotation" ? 15 : 0.1}
                              min={
                                ["width", "depth", "height"].includes(key)
                                  ? 0.1
                                  : key === "rotation"
                                    ? -360
                                    : -30
                              }
                              max={key === "rotation" ? 360 : 30}
                              value={item[key]}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                const min = [
                                  "width",
                                  "depth",
                                  "height",
                                ].includes(key)
                                  ? 0.1
                                  : key === "rotation"
                                    ? -360
                                    : -30;
                                if (
                                  Number.isFinite(value) &&
                                  value >= min &&
                                  value <= (key === "rotation" ? 360 : 30)
                                )
                                  patch({ [key]: value });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <div className="object-actions">
                        <label className="color-label">
                          Color
                          <input
                            type="color"
                            value={item.color}
                            onChange={(e) => patch({ color: e.target.value })}
                          />
                        </label>
                        <button
                          className="icon-btn"
                          aria-label="Rotar 45 grados"
                          onClick={() =>
                            patch({ rotation: (item.rotation + 45) % 360 })
                          }
                        >
                          <RotateCw size={17} />
                        </button>
                        <button
                          className="icon-btn danger"
                          aria-label="Eliminar mueble"
                          onClick={() => {
                            change({
                              ...scene,
                              objects: scene.objects.filter(
                                (o) => o.id !== selected,
                              ),
                            });
                            setSelected(null);
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="muted">
                      Selecciona un mueble en la escena para editar su posición,
                      tamaño y rotación.
                    </p>
                  )}
                  {!item && scene.objects.length > 0 && (
                    <select
                      aria-label="Seleccionar mueble"
                      value=""
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      <option value="" disabled>
                        Seleccionar objeto…
                      </option>
                      {scene.objects.map((o, i) => (
                        <option value={o.id} key={o.id}>
                          {catalog[o.kind].label} {i + 1}
                        </option>
                      ))}
                    </select>
                  )}
                </section>
              </aside>
              <PhotoAnalysis
                key={active!.id}
                configured={configured}
                password={password}
                onGenerate={(next) => {
                  change(next);
                  setSelected(null);
                  setMessage(
                    "Espacio 3D generado. Revisa y guarda el proyecto para conservarlo.",
                  );
                }}
              />
            </div>
            <p className="disclaimer">
              Una sola fotografía no permite una reconstrucción geométrica
              exacta. Los muebles son geometrías aproximadas editables. La
              fotografía no se guarda con el proyecto.
            </p>
          </div>
        )}
      </main>
      {busy && (
        <div className="busy-indicator" role="status">
          <span />
          Conectando servicios…
        </div>
      )}
    </div>
  );
}
