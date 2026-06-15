import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildImagePrefillPrompt, normalizePrefillResult } from "../src/prefill.js";

const root = normalize(join(fileURLToPath(import.meta.url), "..", ".."));
const port = Number(process.env.PORT || 5177);
const host = process.env.HOST || "0.0.0.0";
const maxJsonBodyBytes = 12 * 1024 * 1024;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const file = join(root, name);
    if (!existsSync(file)) continue;

    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || line.trimStart().startsWith("#")) continue;

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;

      const value = rawValue
        .trim()
        .replace(/^['"]|['"]$/g, "");
      process.env[key] = value;
    }
  }
}

loadEnvFiles();

function envValue(...names) {
  return names.map((name) => process.env[name]).find(Boolean) || "";
}

function getVisionProviders() {
  return [
    {
      id: "anyrouter",
      label: "AnyRouter GPT-5.5",
      baseUrl: envValue("AI_PREFILL_PRIMARY_BASE_URL", "ANYROUTER_BASE_URL") || "https://a-ocnfniawgw.cn-shanghai.fcapp.run",
      chatUrl: envValue("AI_PREFILL_PRIMARY_CHAT_URL", "ANYROUTER_CHAT_URL"),
      apiKey: envValue("AI_PREFILL_PRIMARY_API_KEY", "ANYROUTER_API_KEY"),
      model: envValue("AI_PREFILL_PRIMARY_MODEL", "ANYROUTER_MODEL") || "gpt-5.5"
    },
    {
      id: "muyuan",
      label: "muyuan.do Image #1",
      baseUrl: envValue("AI_PREFILL_FALLBACK_BASE_URL", "MUYUAN_BASE_URL") || "https://muyuan.do",
      chatUrl: envValue("AI_PREFILL_FALLBACK_CHAT_URL", "MUYUAN_CHAT_URL"),
      apiKey: envValue("AI_PREFILL_FALLBACK_API_KEY", "MUYUAN_API_KEY"),
      model: envValue("AI_PREFILL_FALLBACK_MODEL", "MUYUAN_MODEL") || "Image #1"
    }
  ].filter((provider) => provider.apiKey);
}

function completionUrls(provider) {
  const base = (provider.chatUrl || provider.baseUrl).replace(/\/+$/, "");
  const candidates = [];
  if (/\/chat\/completions$/i.test(base)) {
    candidates.push(base);
  } else if (/\/v\d+$/i.test(base)) {
    candidates.push(`${base}/chat/completions`);
  } else {
    candidates.push(`${base}/v1/chat/completions`, `${base}/chat/completions`, base);
  }
  return [...new Set(candidates)];
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";

    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maxJsonBodyBytes) {
        reject(new Error("REQUEST_TOO_LARGE"));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

function isSupportedImageDataUrl(value) {
  return /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(String(value || ""));
}

function providerPayload(provider, mode, image, includeResponseFormat = true) {
  const prompt = buildImagePrefillPrompt(mode);
  const payload = {
    model: provider.model,
    messages: [
      {
        role: "system",
        content: "你只输出可解析 JSON。不要输出 Markdown，不要补充解释。"
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: image, detail: "high" } }
        ]
      }
    ],
    temperature: 0
  };
  if (includeResponseFormat) payload.response_format = { type: "json_object" };
  return payload;
}

function extractResponseText(body) {
  const message = body?.choices?.[0]?.message?.content;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) {
    return message
      .map((item) => item.text || item?.content || "")
      .filter(Boolean)
      .join("\n");
  }

  if (typeof body?.output_text === "string") return body.output_text;
  const outputText = (body?.output || [])
    .flatMap((item) => item.content || [])
    .map((item) => item.text || item?.content || "")
    .filter(Boolean)
    .join("\n");
  if (outputText) return outputText;

  return body;
}

async function callVisionProvider(provider, mode, image) {
  let lastError = new Error("NO_RESPONSE");

  for (const url of completionUrls(provider)) {
    for (const includeResponseFormat of [true, false]) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "authorization": `Bearer ${provider.apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(providerPayload(provider, mode, image, includeResponseFormat)),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }

      const responseBody = await response.text();
      if (!response.ok) {
        lastError = new Error(`HTTP_${response.status}`);
        if ([404, 405].includes(response.status)) break;
        if (includeResponseFormat && [400, 422].includes(response.status)) continue;
        throw lastError;
      }

      return extractResponseText(JSON.parse(responseBody));
    }
  }

  throw lastError;
}

async function handleImagePrefill(req, res) {
  if (req.method === "GET") {
    sendJson(res, 200, { ok: true, enabled: getVisionProviders().length > 0 });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  const providers = getVisionProviders();
  if (!providers.length) {
    sendJson(res, 503, { ok: false, error: "AI 识别未配置，请设置服务端环境变量。" });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    const status = error.message === "REQUEST_TOO_LARGE" ? 413 : 400;
    sendJson(res, status, { ok: false, error: status === 413 ? "图片过大。" : "请求格式错误。" });
    return;
  }

  if (!isSupportedImageDataUrl(payload.image)) {
    sendJson(res, 400, { ok: false, error: "仅支持 PNG、JPG、WEBP 图片。" });
    return;
  }

  const errors = [];
  for (const provider of providers) {
    try {
      const raw = await callVisionProvider(provider, payload.mode, payload.image);
      const result = normalizePrefillResult(payload.mode, raw);
      if (!Object.keys(result.fields).length) throw new Error("EMPTY_FIELDS");

      sendJson(res, 200, {
        ok: true,
        provider: { id: provider.id, label: provider.label, model: provider.model },
        ...result
      });
      return;
    } catch (error) {
      errors.push({ provider: provider.id, reason: error.name === "AbortError" ? "TIMEOUT" : error.message });
      console.warn(`[image-prefill] ${provider.label} failed: ${error.name === "AbortError" ? "TIMEOUT" : error.message}`);
    }
  }

  sendJson(res, 502, {
    ok: false,
    error: "AI 识别暂不可用，请手动填写。",
    tried: errors.map((item) => item.provider)
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const requestPath = decodeURIComponent(url.pathname);

  if (requestPath === "/api/image-prefill") {
    handleImagePrefill(req, res);
    return;
  }

  const safePath = normalize(join(root, requestPath === "/" ? "index.html" : requestPath));

  if (!safePath.startsWith(root) || !existsSync(safePath) || statSync(safePath).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  res.writeHead(200, {
    "content-type": types[extname(safePath)] || "application/octet-stream"
  });
  createReadStream(safePath).pipe(res);
});

function getLanUrls() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${port}/`);
}

server.listen(port, host, () => {
  console.log(`极速抢已启动：http://127.0.0.1:${port}/`);
  getLanUrls().forEach((url) => console.log(`手机同一 Wi-Fi 可访问：${url}`));
});
