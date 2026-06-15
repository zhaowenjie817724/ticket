import { normalizeExtractedFields } from "../src/extract.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb"
    }
  }
};

const PROVIDERS = [
  {
    name: "anyrouter",
    baseUrl: process.env.ANYROUTER_BASE_URL || "https://a-ocnfniawgw.cn-shanghai.fcapp.run",
    apiKey: process.env.ANYROUTER_API_KEY,
    model: process.env.ANYROUTER_MODEL || ""
  },
  {
    name: "muyuan",
    baseUrl: process.env.MUYUAN_BASE_URL || "https://muyuan.do",
    apiKey: process.env.MUYUAN_API_KEY,
    model: process.env.MUYUAN_MODEL || "Image #1"
  }
];

function chatUrl(baseUrl) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  if (base.endsWith("/v1")) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function promptFor(mode) {
  const fields = mode === "show"
    ? "customerName, contact, officialUrl, eventName, city, date, openAt, itemId, viewers, viewerNames, budget, tiers, backup, mobileUrl, requestNote"
    : "customerName, contact, officialUrl, from, to, date, passengers, travellers, earliest, latest, seats, flexibility, fromCode, toCode, standbyUntil, mobileUrl, requestNote";

  return [
    "You extract ticket request data from a mobile screenshot.",
    "Return strict JSON only. No markdown.",
    `Mode: ${mode}.`,
    `Allowed fields: ${fields}.`,
    "Use datetime-local format for date-like fields: YYYY-MM-DDTHH:mm.",
    "For list-like fields, return a concise comma-separated Chinese string.",
    "If unsure, omit the field instead of guessing.",
    "JSON shape: {\"fields\":{},\"rawText\":\"\",\"confidence\":0.0,\"warnings\":[]}"
  ].join("\n");
}

function parseJsonContent(content) {
  const text = String(content || "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const raw = fenced || text;
  const json = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  return JSON.parse(json);
}

async function callProvider(provider, mode, image) {
  if (!provider.apiKey) throw new Error(`${provider.name}: missing key`);
  if (!provider.model) throw new Error(`${provider.name}: missing model`);

  const payload = {
    model: provider.model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: promptFor(mode) },
          { type: "image_url", image_url: { url: image } }
        ]
      }
    ]
  };

  let response = await fetch(chatUrl(provider.baseUrl), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if ([400, 404, 422].includes(response.status)) {
    const retryPayload = { ...payload };
    delete retryPayload.response_format;
    response = await fetch(chatUrl(provider.baseUrl), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(retryPayload)
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${provider.name}: ${response.status} ${detail.slice(0, 160)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || data.output_text || data.content;
  if (!content) throw new Error(`${provider.name}: empty response`);

  return {
    provider: provider.name,
    result: parseJsonContent(content)
  };
}

function getBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const body = getBody(req);
    const mode = body.mode === "show" ? "show" : "rail";
    const image = String(body.image || "");
    if (!image.startsWith("data:image/")) {
      res.status(400).json({ error: "Invalid image" });
      return;
    }

    const errors = [];
    for (const provider of PROVIDERS) {
      try {
        const { provider: source, result } = await callProvider(provider, mode, image);
        const fields = normalizeExtractedFields(mode, result);
        res.status(200).json({
          mode,
          source,
          fields,
          rawText: result.rawText || "",
          confidence: Number(result.confidence || 0),
          warnings: Array.isArray(result.warnings) ? result.warnings : []
        });
        return;
      } catch (error) {
        errors.push(error.message);
      }
    }

    console.warn("extract-ticket providers failed", errors.slice(-2));
    res.status(503).json({ error: "Extractors unavailable" });
  } catch {
    res.status(500).json({ error: "Extraction failed" });
  }
}
