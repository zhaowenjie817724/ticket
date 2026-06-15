export const PREFILL_FIELDS = {
  rail: [
    "officialUrl",
    "from",
    "to",
    "date",
    "sellAt",
    "earliest",
    "latest",
    "passengers",
    "standbyUntil",
    "fromCode",
    "toCode",
    "seats",
    "flexibility",
    "mobileUrl"
  ],
  show: [
    "officialUrl",
    "eventName",
    "city",
    "date",
    "openAt",
    "itemId",
    "viewers",
    "budget",
    "tiers",
    "backup",
    "mobileUrl"
  ]
};

const DATETIME_FIELDS = new Set(["date", "sellAt", "standbyUntil", "openAt"]);
const TIME_FIELDS = new Set(["earliest", "latest"]);
const NUMBER_FIELDS = new Set(["passengers", "viewers", "budget", "leadMinutes"]);
const EMPTY_VALUES = new Set(["", "null", "undefined", "n/a", "na", "none", "未知", "无"]);

export function isPrefillMode(value) {
  return value === "rail" || value === "show";
}

export function normalizePrefillMode(value, fallback = "rail") {
  return isPrefillMode(value) ? value : fallback;
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  return EMPTY_VALUES.has(text.toLowerCase()) ? "" : text;
}

function normalizeDateTime(value) {
  const text = cleanText(value)
    .replace(/[./]/g, "-")
    .replace("年", "-")
    .replace("月", "-")
    .replace("日", " ")
    .replace("号", " ")
    .replace("时", ":")
    .replace("点", ":")
    .replace("分", "");
  const match = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) return "";

  const [, year, month, day, hour = "00", minute = "00"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function normalizeTime(value) {
  const text = cleanText(value)
    .replace("时", ":")
    .replace("点", ":")
    .replace("分", "");
  const match = text.match(/(^|\D)(\d{1,2})(?::(\d{1,2}))?/);
  if (!match) return "";

  const hour = Number(match[2]);
  const minute = Number(match[3] || 0);
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeNumber(value) {
  const text = cleanText(value).replace(/[^\d.]/g, "");
  if (!text) return "";
  return text;
}

function normalizeFieldValue(field, value) {
  if (DATETIME_FIELDS.has(field)) return normalizeDateTime(value);
  if (TIME_FIELDS.has(field)) return normalizeTime(value);
  if (NUMBER_FIELDS.has(field)) return normalizeNumber(value);
  return cleanText(value);
}

export function sanitizePrefillFields(mode, fields = {}) {
  const allowed = PREFILL_FIELDS[normalizePrefillMode(mode)] || [];
  const clean = {};

  for (const field of allowed) {
    const value = normalizeFieldValue(field, fields[field]);
    if (value) clean[field] = value;
  }

  return clean;
}

function findJsonObject(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) return text.slice(start, index + 1);
    }
  }

  return "";
}

export function parsePrefillJson(content) {
  if (content && typeof content === "object") return content;
  const text = cleanText(content);
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const json = findJsonObject(text);
    return json ? JSON.parse(json) : {};
  }
}

export function normalizePrefillResult(requestMode, rawResult) {
  const parsed = parsePrefillJson(rawResult);
  const mode = normalizePrefillMode(parsed.mode, normalizePrefillMode(requestMode));
  const sourceFields = parsed.fields || parsed[mode] || parsed;
  const fields = sanitizePrefillFields(mode, sourceFields);
  const confidence = Number(parsed.confidence);
  const notes = Array.isArray(parsed.notes)
    ? parsed.notes.map(cleanText).filter(Boolean).slice(0, 5)
    : [];

  return {
    mode,
    fields,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    notes
  };
}

export function buildImagePrefillPrompt(mode) {
  const targetMode = normalizePrefillMode(mode);
  return [
    "你是购票目标截图信息抽取器。只根据图片中可见信息提取，不要猜测。",
    "返回严格 JSON，不要 Markdown，不要解释。",
    "如果图片属于 12306，mode 返回 rail；如果属于大麦、演唱会、票务详情页，mode 返回 show。",
    `当前用户正在编辑的模式是 ${targetMode}。`,
    "datetime-local 字段统一使用 YYYY-MM-DDTHH:mm；仅有日期时用 00:00。time 字段使用 HH:mm。",
    "逗号分隔字段可以返回中文逗号分隔字符串。",
    "字段白名单：",
    `rail: ${PREFILL_FIELDS.rail.join(", ")}`,
    `show: ${PREFILL_FIELDS.show.join(", ")}`,
    "JSON 结构：{\"mode\":\"rail|show\",\"confidence\":0.0,\"fields\":{},\"notes\":[]}"
  ].join("\n");
}
