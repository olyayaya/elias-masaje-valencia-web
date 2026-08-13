import { useMemo, useState } from "react";
import { Check, Copy, Download, ExternalLink, Lock, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useHead } from "@/hooks/use-head";
import { buildFullSpec, buildMcpJson, buildToolSchema, downloadJson } from "@/lib/mcp-spec";


type ToolDoc = {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  input: { name: string; type: string; required: boolean; description: string }[];
  output: string;
  example: Record<string, unknown>;
};

const TOOLS: ToolDoc[] = [
  {
    name: "list_booking_leads",
    title: "List booking leads",
    description:
      "List WhatsApp booking leads captured on the website, newest first. Optionally filter by status.",
    readOnly: true,
    input: [
      { name: "status", type: "string", required: false, description: "new | contacted | booked | closed" },
      { name: "limit", type: "integer", required: false, description: "Max leads to return (default 20, max 100)" },
    ],
    output: `{
  "leads": [
    {
      "id": "uuid",
      "name": "Ana",
      "phone": "+34...",
      "service": "Masaje descontracturante",
      "duration": 60,
      "price": 55,
      "status": "new",
      "created_at": "2026-08-13T09:12:00Z"
    }
  ],
  "count": 1
}`,
    example: { status: "new", limit: 10 },
  },
  {
    name: "update_booking_lead_status",
    title: "Update booking lead status",
    description: "Update the pipeline status of one booking lead (mark it contacted, booked, closed…).",
    readOnly: false,
    input: [
      { name: "id", type: "string (uuid)", required: true, description: "The booking lead id" },
      { name: "status", type: "string", required: true, description: "new | contacted | booked | closed" },
    ],
    output: `{ "lead": { "id": "uuid", "status": "contacted", "...": "..." } }`,
    example: { id: "00000000-0000-0000-0000-000000000000", status: "contacted" },
  },
  {
    name: "create_whatsapp_booking_request",
    title: "Create WhatsApp booking request",
    description:
      "Genera el mensaje de WhatsApp listo para enviar a partir de un lead (ES/EN/RU), devuelve el enlace wa.me y el estado del lead para el seguimiento. Marca el lead como contactado por defecto.",
    readOnly: false,
    input: [
      { name: "leadId", type: "string (uuid)", required: true, description: "Lead de reserva de origen" },
      { name: "locale", type: "string", required: false, description: "es | en | ru (por defecto, el del lead)" },
      { name: "note", type: "string", required: false, description: "Línea extra, p. ej. proponer otra hora" },
      {
        name: "markContacted",
        type: "boolean",
        required: false,
        description: "Marcar el lead como contactado (por defecto true)",
      },
    ],
    output: `{
  "leadId": "uuid",
  "locale": "es",
  "clientName": "Ana",
  "clientPhone": "+34...",
  "message": "Hola Ana, soy Elias…",
  "whatsappLink": "https://wa.me/34...?text=…",
  "businessWhatsappLink": "https://wa.me/34698968007?text=…",
  "status": "contacted",
  "statusUpdated": true,
  "followUp": "Lead marked as contacted — follow up…"
}`,
    example: {
      leadId: "00000000-0000-0000-0000-000000000000",
      locale: "es",
      note: "Tengo hueco el jueves a las 17:00.",
    },
  },
  {
    name: "list_services",
    title: "List massage services",
    description: "List the massage services published on the site, with duration, price and ES/EN/RU translations.",
    readOnly: true,
    input: [
      {
        name: "includeHidden",
        type: "boolean",
        required: false,
        description: "Include services hidden from the public site (default false)",
      },
    ],
    output: `{
  "services": [
    { "id": "uuid", "title": "...", "duration": 60, "price": 55, "visible": true }
  ]
}`,
    example: { includeHidden: false },
  },
  {
    name: "list_blog_posts",
    title: "List blog posts",
    description: "List blog posts with status, slug and SEO metadata, newest first.",
    readOnly: true,
    input: [
      { name: "status", type: "string", required: false, description: "draft | published" },
      { name: "limit", type: "integer", required: false, description: "Max posts to return (default 20, max 100)" },
    ],
    output: `{
  "posts": [
    { "id": "uuid", "title": "...", "slug": "...", "status": "published", "meta_description": "..." }
  ]
}`,
    example: { status: "draft", limit: 5 },
  },
  {
    name: "create_blog_draft",
    title: "Create blog draft",
    description: "Create a new blog post in draft status. It stays hidden until published from the dashboard.",
    readOnly: false,
    input: [
      { name: "title", type: "string", required: true, description: "Post title in Spanish" },
      { name: "content", type: "string", required: true, description: "Post body in Spanish (HTML or plain text)" },
      { name: "metaDescription", type: "string", required: false, description: "SEO description, under ~160 chars" },
      { name: "keywords", type: "string[]", required: false, description: "SEO keywords" },
      { name: "slug", type: "string", required: false, description: "URL slug; generated from the title if omitted" },
    ],
    output: `{ "post": { "id": "uuid", "title": "...", "slug": "...", "status": "draft" } }`,
    example: {
      title: "Beneficios del masaje deportivo",
      content: "<p>El masaje deportivo ayuda a…</p>",
      metaDescription: "Descubre los beneficios del masaje deportivo en Valencia.",
      keywords: ["masaje deportivo", "valencia"],
    },
  },
  {
    name: "conversion_stats",
    title: "Conversion stats",
    description:
      "Summarise conversion events (WhatsApp clicks, booking submissions, form leads) for the last N days, grouped by event name and page.",
    readOnly: true,
    input: [{ name: "days", type: "integer", required: false, description: "Days back to include (default 30, max 365)" }],
    output: `{
  "days": 30,
  "total": 128,
  "byEvent": { "whatsapp_click": 91, "generate_lead": 37 },
  "byPage": { "/": 64, "/servicios": 40 }
}`,
    example: { days: 30 },
  },
];

const CodeBlock = ({ code, label }: { code: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  };
  return (
    <div className="relative group">
      {label && <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>}
      <pre className="overflow-x-auto rounded-lg border border-border bg-secondary/50 p-3 text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label="Copiar"
        className="absolute top-1 right-1 p-1.5 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
};

const McpDocs = () => {
  useHead({
    title: "MCP — Documentación de herramientas | Elias Masaje",
    description: "Referencia de las herramientas MCP del sitio: esquemas de entrada/salida y ejemplos de peticiones.",
    robots: "noindex, nofollow",
    noSocial: true,
  });

  const endpoint = useMemo(() => {
    const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
    return `${base}/functions/v1/mcp`;
  }, []);

  const [query, setQuery] = useState("");
  const tools = TOOLS.filter(
    (t) =>
      !query.trim() ||
      (t.name + t.title + t.description).toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <main className="min-h-screen px-4 py-12 md:py-16">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        <header className="space-y-3">
          <h1 className="font-display text-3xl md:text-4xl text-foreground">MCP — Documentación</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Este sitio expone un servidor MCP protegido con OAuth. Un agente (Claude, ChatGPT, Cursor, Lovable…)
            se conecta, inicia sesión con tu cuenta de administrador y actúa en tu nombre respetando los permisos
            de la base de datos.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
          <h2 className="font-display text-xl text-foreground">Conexión</h2>
          <CodeBlock label="Endpoint (Streamable HTTP)" code={endpoint} />
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="font-medium text-foreground flex items-center gap-2">
                <Lock size={14} /> Autenticación
              </p>
              <p className="text-muted-foreground mt-1">
                OAuth 2.1 con registro dinámico. El agente te redirige a la pantalla de consentimiento en{" "}
                <code className="text-xs">/.lovable/oauth/consent</code>; tras aprobar, las herramientas se ejecutan
                como tu usuario.
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-medium text-foreground flex items-center gap-2">
                <Wrench size={14} /> Servidor
              </p>
              <p className="text-muted-foreground mt-1">
                <code className="text-xs">elias-masaje-website</code> v0.1.0 · {TOOLS.length} herramientas
              </p>
            </div>
          </div>
          <CodeBlock
            label="Configuración de cliente (mcp.json)"
            code={JSON.stringify(buildMcpJson(endpoint), null, 2)}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                downloadJson("mcp.json", buildMcpJson(endpoint));
                toast.success("mcp.json descargado");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <Download size={14} /> Descargar mcp.json
            </button>
            <button
              type="button"
              onClick={() => {
                downloadJson("elias-masaje-mcp-spec.json", buildFullSpec(endpoint, TOOLS));
                toast.success("Especificación completa descargada");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20 transition-colors"
            >
              <Download size={14} /> Descargar especificación completa
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            La especificación completa incluye el endpoint, la configuración OAuth y el esquema JSON de entrada de
            cada herramienta con un ejemplo de petición y respuesta — lista para compartir con otros sistemas.
          </p>
        </section>


        <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
          <h2 className="font-display text-xl text-foreground">Prueba rápida</h2>
          <p className="text-sm text-muted-foreground">
            Todas las peticiones son JSON-RPC 2.0 por POST. La cabecera <code className="text-xs">Accept</code> debe
            aceptar JSON y SSE, y el token es el access token OAuth emitido tras el consentimiento.
          </p>
          <CodeBlock
            label="Listar herramientas"
            code={`curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
          />
          <CodeBlock
            label="Invocar una herramienta"
            code={`curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"list_booking_leads","arguments":{"status":"new","limit":10}}}'`}
          />
          <p className="text-xs text-muted-foreground">
            Sin token válido el servidor responde 401 con la cabecera{" "}
            <code>WWW-Authenticate</code> apuntando a los metadatos OAuth del recurso.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-foreground">Herramientas ({tools.length})</h2>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar herramienta…"
              aria-label="Buscar herramienta"
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {tools.map((tool) => (
            <article key={tool.name} className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-sm md:text-base text-foreground">{tool.name}</h3>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    tool.readOnly
                      ? "border-border text-muted-foreground"
                      : "border-primary/40 text-primary"
                  }`}
                >
                  {tool.readOnly ? "solo lectura" : "escritura"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{tool.description}</p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <caption className="sr-only">Parámetros de entrada de {tool.name}</caption>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-1.5 pr-4 font-medium">Parámetro</th>
                      <th scope="col" className="py-1.5 pr-4 font-medium">Tipo</th>
                      <th scope="col" className="py-1.5 pr-4 font-medium">Req.</th>
                      <th scope="col" className="py-1.5 font-medium">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tool.input.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-muted-foreground">Sin parámetros</td>
                      </tr>
                    )}
                    {tool.input.map((p) => (
                      <tr key={p.name} className="border-t border-border align-top">
                        <td className="py-2 pr-4 font-mono text-xs text-foreground">{p.name}</td>
                        <td className="py-2 pr-4 text-muted-foreground text-xs">{p.type}</td>
                        <td className="py-2 pr-4 text-muted-foreground text-xs">{p.required ? "sí" : "no"}</td>
                        <td className="py-2 text-muted-foreground text-xs">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <CodeBlock
                  label="Ejemplo de petición"
                  code={JSON.stringify(
                    {
                      jsonrpc: "2.0",
                      id: 1,
                      method: "tools/call",
                      params: { name: tool.name, arguments: tool.example },
                    },
                    null,
                    2,
                  )}
                />
                <CodeBlock label="structuredContent devuelto" code={tool.output} />
              </div>
            </article>
          ))}
        </section>

        <footer className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ExternalLink size={12} />
          <span>
            Especificación MCP: modelcontextprotocol.io — transporte Streamable HTTP, versión de protocolo 2025-06-18.
          </span>
        </footer>
      </div>
    </main>
  );
};

export default McpDocs;
