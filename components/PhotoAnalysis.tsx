"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Camera, Check, Sparkles, Upload } from "lucide-react";
import { analysisSchema, analysisToScene, type Analysis } from "@/lib/analysis";
import { imageMime, imageTypes, MAX_IMAGE_BYTES } from "@/lib/image";
import { catalog, type Scene } from "@/lib/scene";
import ImageToModel from "./ImageToModel";

type Props = {
  configured: boolean;
  password: string;
  onGenerate: (scene: Scene) => void;
  projectId: string;
  onAddModel: (id: string) => void;
};
const confidence = { low: "baja", medium: "media", high: "alta" };

export default function PhotoAnalysis({
  configured,
  password,
  onGenerate,
  projectId,
  onAddModel,
}: Props) {
  const [image, setImage] = useState("");
  const [filename, setFilename] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const uploadVersion = useRef(0);
  useEffect(
    () => () => {
      request.current?.abort();
      uploadVersion.current++;
    },
    [],
  );

  async function upload(file?: File) {
    if (!file) return;
    const version = ++uploadVersion.current;
    setError("");
    setNotice("");
    setReading(true);
    try {
      if (
        !imageTypes.includes(file.type) ||
        file.size > MAX_IMAGE_BYTES ||
        file.size < 12
      )
        throw new Error(
          "Selecciona una imagen JPG, JPEG, PNG o WebP de hasta 3 MB.",
        );
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (imageMime(bytes) !== file.type)
        throw new Error(
          "El contenido del archivo no corresponde al formato de imagen indicado.",
        );
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const preview = new Image();
        preview.onload = () => {
          if (
            !preview.naturalWidth ||
            !preview.naturalHeight ||
            preview.naturalWidth * preview.naturalHeight > 40_000_000
          )
            reject(
              new Error("La imagen no es válida o supera 40 megapíxeles."),
            );
          else resolve();
        };
        preview.onerror = () =>
          reject(
            new Error(
              "No se pudo decodificar la imagen. Prueba con otra fotografía.",
            ),
          );
        preview.src = dataUrl;
      });
      if (version !== uploadVersion.current) return;
      request.current?.abort();
      setImage(dataUrl);
      setFilename(file.name);
      setAnalysis(null);
      setExcluded([]);
    } catch (e) {
      if (version === uploadVersion.current) setError((e as Error).message);
    } finally {
      if (version === uploadVersion.current) setReading(false);
    }
  }
  async function analyze() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 55000);
    setProcessing(true);
    setError("");
    setNotice("");
    setAnalysis(null);
    setExcluded([]);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-password": password,
        },
        body: JSON.stringify({ image }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data = await response.json().catch(() => {
        throw new Error(
          response.status === 413
            ? "La imagen supera el tamaño admitido por el servidor."
            : "El servidor devolvió una respuesta no válida.",
        );
      });
      if (!response.ok)
        throw new Error(data.error || "No se pudo analizar la imagen.");
      const parsed = analysisSchema.safeParse(data.analysis);
      if (!parsed.success || !parsed.data.isInterior)
        throw new Error(
          "El análisis no contiene una habitación válida. La escena actual se conserva.",
        );
      setAnalysis(parsed.data);
      setNotice(
        "Análisis recibido. Revisa los objetos y corrige las dimensiones antes de generar.",
      );
    } catch (e) {
      if (!controller.signal.aborted || timedOut)
        setError(
          timedOut
            ? "El análisis tardó demasiado. Puedes reintentarlo; tu escena se conserva."
            : (e as Error).message,
        );
    } finally {
      clearTimeout(timer);
      if (request.current === controller) setProcessing(false);
    }
  }
  function generate() {
    if (!analysis) return;
    try {
      const result = analysisToScene(analysis, excluded);
      if (
        !window.confirm(
          "Generar reemplazará la habitación y los muebles actuales, incluidos cambios sin guardar. No se guardará automáticamente. ¿Continuar?",
        )
      )
        return;
      onGenerate(result.scene);
      setNotice(
        `Espacio 3D generado con ${result.scene.objects.length} muebles. Puedes editarlo y guardarlo mediante gRPC.`,
      );
      setError("");
    } catch {
      setError(
        "Revisa las dimensiones del análisis antes de generar. La escena actual se conserva.",
      );
    }
  }
  const generated = analysis ? analysisToScene(analysis, excluded) : null;
  return (
    <section
      className="photo-workflow"
      aria-label="Generación desde fotografía"
    >
      <div className="photo-panel">
        <div>
          <h3>
            <Upload size={18} /> De fotografía a espacio
          </h3>
          <p>
            Capturar o cargar → Analizar con IA → Revisar → Generar 3D →
            Organizar
          </p>
          <label
            className={`upload-btn ${processing || reading ? "upload-disabled" : ""}`}
          >
            <Camera size={16} /> Tomar fotografía
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              aria-label="Tomar fotografía del espacio"
              disabled={processing || reading}
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <label
            className={`upload-btn ${processing || reading ? "upload-disabled" : ""}`}
          >
            {reading
              ? "Validando imagen…"
              : image
                ? "Cambiar fotografía"
                : "Seleccionar fotografía"}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              disabled={processing || reading}
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <small>
            En celulares compatibles se abre la cámara; en otros equipos puedes
            seleccionar una imagen. JPG, JPEG, PNG o WebP · Máximo 3 MB ·{" "}
            {filename || "Vista previa local"}
          </small>
        </div>
        {image && (
          <img
            className="photo-preview"
            src={image}
            alt="Fotografía de referencia del espacio"
          />
        )}
        <div className="ai-action">
          <span className={configured ? "ai-status enabled" : "ai-status"}>
            {configured ? "IA configurada" : "Modo manual · IA no configurada"}
          </span>
          <p>
            {configured
              ? "Al analizar, la fotografía se envía al proveedor configurado. Se aplican las tarifas de tu cuenta."
              : "Configura las credenciales del proveedor en .env.local (ANTHROPIC_API_KEY para Claude) y reinicia Next.js. El editor manual sigue disponible."}
          </p>
          <button
            className="secondary"
            disabled={!image || !configured || processing || reading}
            onClick={analyze}
          >
            <Sparkles size={16} />
            {processing ? "Analizando fotografía…" : "Analizar con IA"}
          </button>
        </div>
      </div>
      <div className="analysis-feedback" aria-live="polite">
        {processing && (
          <p className="analysis-progress" role="status">
            <span />
            Analizando muebles y distribución. Puede tardar hasta 45 segundos.
            Tu escena se conserva.
          </p>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="success">
            <Check size={16} />
            {notice}
          </div>
        )}
      </div>
      <ImageToModel
        image={image}
        password={password}
        projectId={projectId}
        onAdd={onAddModel}
      />
      {analysis && (
        <div className="analysis-review">
          <div className="analysis-heading">
            <div>
              <div className="eyebrow">
                REVISIÓN DEL ANÁLISIS · MEDIDAS ESTIMADAS
              </div>
              <h3>{analysis.roomType}</h3>
              <p>{analysis.summary}</p>
            </div>
            <span className="ai-status">No son medidas verificadas</span>
          </div>
          <p className="analysis-surfaces">
            Suelo visible:{" "}
            {analysis.room.floorVisible ? "sí" : "no identificado"} · Paredes
            visibles: {analysis.room.visibleWallCount}. El visor utiliza suelo
            rectangular y dos paredes abiertas como referencia editable.
          </p>
          <div className="three-inputs analysis-room">
            {(["width", "depth", "height"] as const).map((key, i) => (
              <label key={key}>
                {
                  [
                    "Ancho estimado (m)",
                    "Fondo estimado (m)",
                    "Alto estimado (m)",
                  ][i]
                }
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.1"
                  value={analysis.room[key]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 0.5 && n <= 30)
                      setAnalysis({
                        ...analysis,
                        room: { ...analysis.room, [key]: n },
                      });
                  }}
                />
              </label>
            ))}
          </div>
          <h4>
            Objetos detectados <span>{analysis.objects.length}</span>
          </h4>
          {analysis.objects.length === 0 && (
            <p className="muted">
              No se identificaron muebles. Puedes generar la habitación y
              añadirlos manualmente.
            </p>
          )}
          <div className="detected-list">
            {analysis.objects.map((object, index) => (
              <div className="detected-object" key={index}>
                <div className="detected-title">
                  <label>
                    <input
                      type="checkbox"
                      checked={
                        object.kind !== "unsupported" &&
                        !excluded.includes(index)
                      }
                      disabled={object.kind === "unsupported"}
                      onChange={(e) =>
                        setExcluded(
                          e.target.checked
                            ? excluded.filter((i) => i !== index)
                            : [...excluded, index],
                        )
                      }
                    />
                    <b>{object.label}</b>
                  </label>
                  <span>
                    {object.kind === "unsupported"
                      ? "Sin modelo · no se generará"
                      : `${catalog[object.kind].label} · confianza ${confidence[object.confidence]}`}
                  </span>
                </div>
                {object.kind !== "unsupported" && (
                  <details>
                    <summary>Revisar medidas y posición estimadas</summary>
                    <div className="detection-fields">
                      {(
                        [
                          "width",
                          "depth",
                          "height",
                          "u",
                          "v",
                          "rotation",
                        ] as const
                      ).map((key, i) => (
                        <label key={key}>
                          {
                            [
                              "Ancho (m)",
                              "Fondo (m)",
                              "Alto (m)",
                              "Izquierda → derecha (0–1)",
                              "Fondo → frente (0–1)",
                              "Rotación (°)",
                            ][i]
                          }
                          <input
                            type="number"
                            value={object[key]}
                            min={
                              key === "rotation"
                                ? -360
                                : key === "u" || key === "v"
                                  ? 0
                                  : 0.1
                            }
                            max={
                              key === "rotation"
                                ? 360
                                : key === "u" || key === "v"
                                  ? 1
                                  : 30
                            }
                            step={key === "rotation" ? 15 : 0.1}
                            onChange={(e) => {
                              const n = Number(e.target.value),
                                min =
                                  key === "rotation"
                                    ? -360
                                    : key === "u" || key === "v"
                                      ? 0
                                      : 0.1,
                                max =
                                  key === "rotation"
                                    ? 360
                                    : key === "u" || key === "v"
                                      ? 1
                                      : 30;
                              if (n >= min && n <= max)
                                setAnalysis({
                                  ...analysis,
                                  objects: analysis.objects.map((o, j) =>
                                    j === index ? { ...o, [key]: n } : o,
                                  ),
                                });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
          {generated && generated.warnings.length > 0 && (
            <div className="analysis-warnings">
              <b>Aspectos para revisar</b>
              <ul>
                {generated.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="analysis-generate">
            <p>
              Se generarán {generated?.scene.objects.length} muebles. Las
              posiciones son aproximaciones sobre el suelo, no profundidad
              medida.
            </p>
            <button className="primary" onClick={generate}>
              <Box size={17} />
              Generar espacio 3D
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
