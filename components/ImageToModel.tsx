"use client";
import { useEffect, useRef, useState } from "react";
type Task = { id: string; status: string; progress: number; stored?: boolean };
export default function ImageToModel({ image, password, projectId, onAdd }: { image: string; password: string; projectId: string; onAdd: (id: string) => void }) {
  const [configured, setConfigured] = useState(false), [task, setTask] = useState<Task | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const key = `spaceai:model-task:${projectId}`;
  const taskRef = useRef<Task | null>(null);
  const alive = useRef(true);
  const busyRef = useRef(false);
  useEffect(() => {
    alive.current = true;
    fetch("/api/models").then(r => r.json()).then(data => { if (alive.current) setConfigured(data.configured === true); }).catch(() => {});
    try { const saved = localStorage.getItem(key); if (saved && /^[0-9a-f-]{36}$/.test(saved)) { const restored = { id: saved, status: "PAUSED", progress: 0 }; taskRef.current = restored; setTask(restored); } } catch {}
    return () => { alive.current = false; };
  }, [key]);
  async function request(url: string, image?: string) {
    const response = await fetch(url, { method: image ? "POST" : "GET", headers: { "x-app-password": password, ...(image ? { "Content-Type": "application/json" } : {}) }, ...(image ? { body: JSON.stringify({ image }) } : {}), signal: AbortSignal.timeout(65000) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "No se pudo procesar el modelo."); return body as Task;
  }
  function remember(next: Task) {
    taskRef.current = next;
    if (alive.current) setTask(next);
    try { localStorage.setItem(key, next.id); } catch { if (alive.current) setError(`No se pudo guardar el identificador para reanudar. Anota esta tarea: ${next.id}`); }
  }
  async function check() {
    if (!taskRef.current || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { remember(await request(`/api/models/${taskRef.current.id}`)); }
    catch (e) { if (alive.current) setError((e as Error).message); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  useEffect(() => {
    if (!task || !["PENDING", "IN_PROGRESS"].includes(task.status) || error) return;
    const timer = setTimeout(() => { void check(); }, 8000);
    return () => clearTimeout(timer);
    // Cada consulta completada programa una sola nueva consulta; nunca se repite POST.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, busy, error, password]);
  async function generate() {
    if (!image || !configured || busyRef.current) return;
    if (task && ["PENDING", "IN_PROGRESS", "PAUSED"].includes(task.status)) return;
    if (!confirm("Se enviará la imagen a Meshy para generar una malla 3D y se consumirán créditos de tu cuenta. Una imagen no garantiza medidas exactas ni las caras ocultas. ¿Generar?")) return;
    busyRef.current = true; setBusy(true); setError("");
    try { remember(await request("/api/models", image)); }
    catch (e) { if (alive.current) setError((e as Error).message); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  async function download() {
    if (!task?.stored) return;
    try {
      const response = await fetch(`/api/models/${task.id}?asset=1`, { headers: { "x-app-password": password } });
      if (!response.ok) throw new Error("No se pudo descargar el GLB.");
      const url = URL.createObjectURL(await response.blob()); const a = document.createElement("a"); a.href = url; a.download = `spaceai-${task.id}.glb`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError((e as Error).message); }
  }
  const labels: Record<string, string> = { PENDING: "En cola", IN_PROGRESS: "Generando geometría y texturas", SUCCEEDED: "Modelo generado y guardado", FAILED: "La generación falló", CANCELED: "Tarea cancelada", EXPIRED: "Tarea vencida", PAUSED: "Tarea recuperada · consulta para reanudar" };
  return <div className="mesh-workflow">
    <h3>Fotografía → modelo 3D con IA</h3>
    <p>Genera una malla con texturas en formato GLB. Usa preferiblemente una foto clara de un solo mueble u objeto; después podrás moverlo, girarlo y ajustar sus dimensiones dentro de tu espacio.</p>
    <span className={`ai-status ${configured ? "enabled" : ""}`}>{configured ? "Meshy configurado" : "Generación pendiente de configurar MESHY_API_KEY"}</span>
    <button className="primary" disabled={!configured || !image || busy || Boolean(task && ["PENDING", "IN_PROGRESS", "PAUSED"].includes(task.status))} onClick={generate}>Generar modelo 3D desde esta foto</button>
    {task && <div role="status"><p>{labels[task.status] || task.status} · {task.progress}%</p><progress max={100} value={task.progress} aria-label="Progreso de generación del modelo" /><small>Tarea: {task.id}</small><div className="mesh-actions"><button className="secondary" onClick={check} disabled={busy}>{busy ? "Consultando…" : "Consultar / reanudar tarea"}</button>{task.stored && <><button className="primary" onClick={() => onAdd(task.id)}>Añadir modelo al espacio</button><button className="secondary" onClick={download}>Descargar GLB</button></>}</div></div>}
    {error && <p className="error" role="alert">{error}</p>}
    <small>La malla se conserva en el almacenamiento del backend. Guarda el proyecto después de añadirla. El análisis de habitación que aparece debajo sigue siendo una opción separada para estimar la distribución del espacio.</small>
  </div>;
}
