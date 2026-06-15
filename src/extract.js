const FIELD_ALLOWLIST = {
  rail: [
    "customerName",
    "contact",
    "officialUrl",
    "from",
    "to",
    "date",
    "passengers",
    "earliest",
    "latest",
    "seats",
    "flexibility",
    "fromCode",
    "toCode",
    "standbyUntil",
    "mobileUrl",
    "requestNote",
    "travellers"
  ],
  show: [
    "customerName",
    "contact",
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
    "mobileUrl",
    "requestNote",
    "viewerNames"
  ]
};

const DEFAULT_YEAR = new Date().getFullYear();

export function cleanExtractText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function linesOf(text) {
  return cleanExtractText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueList(items) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function firstUrl(text) {
  return String(text || "").match(/https?:\/\/[^\s"'<>]+/i)?.[0] || "";
}

function labelValue(lines, labels) {
  const pattern = new RegExp(`(?:${labels.join("|")})\\s*[:：]?\\s*(.+)$`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(pattern);
    if (match?.[1]) return cleanupValue(match[1]);
    if (labels.some((label) => line.includes(label)) && lines[index + 1]) return cleanupValue(lines[index + 1]);
  }
  return "";
}

function cleanupValue(value) {
  return String(value || "")
    .replace(/^[：:\s]+/, "")
    .replace(/[，,。；;|]+$/g, "")
    .trim();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalDateTime(year, month, day, hour = "00", minute = "00") {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

export function parseDateTimeInput(value, fallbackYear = DEFAULT_YEAR) {
  const text = String(value || "").replace(/\s+/g, " ");
  let match = text.match(/(20\d{2})[年\-/.](\d{1,2})[月\-/.](\d{1,2})日?(?:\D{0,6}(\d{1,2})[:：](\d{2}))?/);
  if (match) return toLocalDateTime(match[1], match[2], match[3], match[4] || "00", match[5] || "00");

  match = text.match(/(\d{1,2})月(\d{1,2})日?(?:\D{0,6}(\d{1,2})[:：](\d{2}))?/);
  if (match) return toLocalDateTime(fallbackYear, match[1], match[2], match[3] || "00", match[4] || "00");

  match = text.match(/(20\d{2})(\d{2})(\d{2})(?:\D{0,6}(\d{1,2})[:：]?(\d{2}))?/);
  if (match) return toLocalDateTime(match[1], match[2], match[3], match[4] || "00", match[5] || "00");

  return "";
}

function firstDateTime(text, preferredLabels = []) {
  const lines = linesOf(text);
  for (const label of preferredLabels) {
    const line = lines.find((item) => item.includes(label));
    const parsed = parseDateTimeInput(line || "");
    if (parsed) return parsed;
  }
  return parseDateTimeInput(text);
}

function timeRange(text) {
  const match = String(text || "").match(/(\d{1,2}[:：]\d{2})\s*(?:-|~|—|至|到)\s*(\d{1,2}[:：]\d{2})/);
  if (!match) return {};
  return {
    earliest: match[1].replace("：", ":"),
    latest: match[2].replace("：", ":")
  };
}

function firstCount(text, fallback = "") {
  return String(text || "").match(/(\d+)\s*(?:人|位|张|名|成人)/)?.[1] || fallback;
}

function extractTerms(text, terms) {
  return terms.filter((term) => String(text || "").includes(term));
}

function parseRoute(text) {
  const line = linesOf(text).find((item) => /(?:→|->|—|-|至|到)/.test(item) && !/(时间|日期|候补|票档|座)/.test(item));
  const match = line?.match(/([\u4e00-\u9fa5A-Za-z]{2,12})\s*(?:→|->|—|-|至|到)\s*([\u4e00-\u9fa5A-Za-z]{2,12})/);
  if (!match) return {};
  return {
    from: cleanupStation(match[1]),
    to: cleanupStation(match[2])
  };
}

function cleanupStation(value) {
  return cleanupValue(value).replace(/^(从|出发|始发)/, "").replace(/(到达|终点|站)$/g, "");
}

function parseItemId(text) {
  return String(text || "").match(/(?:itemId|id)=([A-Za-z0-9_-]+)/i)?.[1] || "";
}

function parseRailText(text) {
  const cleaned = cleanExtractText(text);
  const lines = linesOf(cleaned);
  const route = parseRoute(cleaned);
  const seats = uniqueList(extractTerms(cleaned, [
    "商务座",
    "特等座",
    "一等座",
    "二等座",
    "软卧",
    "硬卧",
    "硬座",
    "无座"
  ]));
  const range = timeRange(cleaned);
  const officialUrl = firstUrl(cleaned);

  const fields = {
    officialUrl,
    from: cleanupStation(labelValue(lines, ["出发地", "出发站", "始发站", "始发"])) || route.from || "",
    to: cleanupStation(labelValue(lines, ["目的地", "到达地", "到达站", "终点站", "终点"])) || route.to || "",
    date: firstDateTime(cleaned, ["出行", "乘车", "发车", "日期"]),
    passengers: firstCount(cleaned),
    earliest: range.earliest || "",
    latest: range.latest || "",
    seats: seats.join(","),
    standbyUntil: firstDateTime(labelValue(lines, ["候补截止", "候补到", "截止"]) || ""),
    travellers: labelValue(lines, ["乘车人", "旅客", "出行人"]),
    requestNote: labelValue(lines, ["备注", "要求", "补充"])
  };

  return compactFields(fields);
}

function parseShowText(text) {
  const cleaned = cleanExtractText(text);
  const lines = linesOf(cleaned);
  const prices = uniqueList(
    [...cleaned.matchAll(/(?:￥|¥)\s*(\d{2,5})|(\d{2,5})\s*元/g)].map((match) => match[1] || match[2])
  );
  const officialUrl = firstUrl(cleaned);
  const itemId = parseItemId(cleaned);
  const tierTerms = uniqueList([
    ...extractTerms(cleaned, ["VIP", "看台", "内场", "前排", "后排", "套票", "亲子票"]),
    ...prices.map((price) => `${price}元`)
  ]);
  const eventLine = lines.find((line) => /(演唱会|音乐节|话剧|脱口秀|Live|LIVE|巡演|赛事|展览)/.test(line) && !/(时间|开售|预售)/.test(line));

  const fields = {
    officialUrl,
    itemId,
    eventName: labelValue(lines, ["项目名称", "演出名称", "项目"]) || cleanupValue(eventLine || ""),
    city: labelValue(lines, ["城市", "站点"]) || cleaned.match(/([\u4e00-\u9fa5]{2,8})(?:站|市)/)?.[1] || "",
    date: firstDateTime(cleaned, ["演出时间", "场次", "日期"]),
    openAt: firstDateTime(labelValue(lines, ["开售时间", "预售时间", "预约时间", "售票时间"]) || ""),
    viewers: firstCount(cleaned),
    budget: prices.length ? String(Math.max(...prices.map(Number))) : "",
    tiers: tierTerms.join(","),
    viewerNames: labelValue(lines, ["观演人", "实名", "观众"]),
    requestNote: labelValue(lines, ["备注", "要求", "补充"])
  };

  return compactFields(fields);
}

function compactFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => String(value || "").trim())
  );
}

function normalizeFieldValue(name, value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (["date", "openAt", "standbyUntil"].includes(name)) return parseDateTimeInput(text) || text.replace(" ", "T");
  return text;
}

export function normalizeExtractedFields(mode, payload) {
  const allowed = FIELD_ALLOWLIST[mode] || [];
  const source = payload?.fields && typeof payload.fields === "object" ? payload.fields : payload || {};
  const fields = {};

  allowed.forEach((name) => {
    const value = normalizeFieldValue(name, source[name]);
    if (value) fields[name] = value;
  });

  if (mode === "show" && fields.officialUrl && !fields.itemId) {
    const itemId = parseItemId(fields.officialUrl);
    if (itemId) fields.itemId = itemId;
  }

  return fields;
}

export function extractTicketFields(mode, text) {
  const parsed = mode === "show" ? parseShowText(text) : parseRailText(text);
  return normalizeExtractedFields(mode, parsed);
}

export function buildExtractionResult(mode, text, source = "local") {
  const fields = extractTicketFields(mode, text);
  const count = Object.keys(fields).length;
  return {
    mode,
    source,
    fields,
    confidence: Math.min(0.92, count / 9),
    rawText: cleanExtractText(text),
    warnings: count ? [] : ["未识别到可填字段"]
  };
}
