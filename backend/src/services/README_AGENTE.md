# Agente SQL conversacional — Fase 2 y 3

El chatbot dejó de ser "datos pegados a un prompt". Ahora es un agente que
escribe su propio SQL, lo ejecuta contra la base, se corrige si falla, y
responde con texto + tablas + gráficas.

## Flujo

```
Usuario → POST /api/agents/chat-agente
            │
   agenteSQL.correr()  ── loop (máx 8 vueltas) ──┐
            │                                     │
   OpenRouter (Sonnet 4.6) pide una herramienta   │
            │                                     │
   ┌────────┴─────────┬──────────────────┐        │
   ejecutar_sql   muestrear_valores   responder    │
   (dbAgente)     (dbAgente)          (termina) ───┘
            │
   sqlGuard.validar()  →  rol agente_ia (solo lectura)  →  Postgres
```

El modelo NUNCA toca la base. Escribe SQL como texto; dbAgente lo valida,
lo acota y lo corre contra el usuario de solo lectura.

## Archivos

| Archivo | Qué hace |
|---|---|
| `sqlGuard.js` | Valida el SQL: solo SELECT, una sentencia, sin schemas prohibidos. 2ª línea de defensa. |
| `dbAgente.js` | Ejecuta contra `DATABASE_URL_READONLY`. Lee el catálogo de vistas. |
| `agenteSQL.js` | El loop: tools, system prompt, autocorrección, structured output. |
| `routes/agents.js` | `POST /chat-agente` y `GET /chat-agente/salud`. |
| `scripts/probar-agente.js` | Pruebas por consola. |
| `scripts/eval-agente.js` | Set de evaluación (10 casos verificados). |

## Frontend

- `components/agents/AgentChat.jsx` — el chat (markdown + loader + trazabilidad)
- `components/agents/BloqueVisual.jsx` — renderiza tablas y gráficas Recharts

## Seguridad — tres muros independientes

1. **Rol `agente_ia`**: solo SELECT sobre el schema `analitica`, `read_only` fijado.
2. **sqlGuard**: rechaza cualquier cosa que no sea un SELECT simple.
3. **Transacción READ ONLY** con `statement_timeout` de 5s y LIMIT forzado.

Probado: 10/10 intentos de escritura/lectura prohibida bloqueados,
22/22 casos del validador (incluidas inyecciones).

## Costo y latencia

- ~$0.021 por pregunta (con prompt caching). ~$75/mes para 5 usuarios × 20/día.
- 10–20 segundos por respuesta (varias vueltas al modelo). Por eso el frontend
  muestra un loader con mensaje, no un stream de pasos.

## Variables de entorno

```
OPENROUTER_API_KEY=sk-or-v1-...
DATABASE_URL_READONLY=postgresql://agente_ia:...   (usuario de solo lectura)
OPENROUTER_MODEL_AGENTE=anthropic/claude-sonnet-4.6   (opcional)
```

## Cómo probarlo

```bash
cd backend
node scripts/probar-agente.js "cuanto me deben mis clientes"
node scripts/eval-agente.js        # corre los 10 casos
curl localhost:3000/api/agents/chat-agente/salud -H "Authorization: Bearer <token>"
```

## Deuda conocida

- El endpoint viejo `/chat` (contexto fijo) sigue vivo. Migrar el frontend por
  completo y luego borrarlo, junto con `obtenerContextoFinancieroCompleto` y
  `generarRespuestaLocal` de aiService.
- El set de evaluación tiene 10 casos. Subirlo a ~40-50 antes de vender esto
  como producto: es la única red contra regresiones silenciosas.
