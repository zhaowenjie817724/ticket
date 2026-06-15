export const MODES = {
  rail: {
    id: "rail",
    label: "12306",
    title: "12306 官方入口配置",
    copy: "官方候补、换乘、相邻站、席别降级和关键回流窗口一起拉满。",
    launchers: [
      {
        title: "12306 官网",
        url: "https://www.12306.cn/index/",
        note: "用于登录、乘车人核验和官方购票入口。"
      },
      {
        title: "余票查询",
        url: "https://kyfw.12306.cn/otn/leftTicket/init",
        note: "开售时进入官方查询页，由本人提交订单。"
      }
    ]
  },
  show: {
    id: "show",
    label: "大麦",
    title: "大麦官方入口配置",
    copy: "票档优先级、预约预售、观演人、支付链路和二次放票窗口一起拉满。",
    launchers: [
      {
        title: "大麦官网",
        url: "https://www.damai.cn/",
        note: "用于搜索项目、预约、查看官方票务规则。"
      },
      {
        title: "大麦 App",
        url: "damai://",
        note: "手机端优先尝试系统拉起 App。"
      }
    ]
  }
};

export const DEFAULT_STATE = {
  rail: {
    from: "北京",
    to: "上海",
    date: "",
    earliest: "07:00",
    latest: "22:00",
    seats: "二等座,一等座,无座",
    passengers: "1",
    travellers: "",
    sellAt: "",
    standbyUntil: "",
    flexibility: "相邻站,中转换乘,席别降级,前后一天",
    fromCode: "",
    toCode: "",
    officialUrl: "",
    mobileUrl: ""
  },
  show: {
    eventName: "演唱会",
    city: "",
    date: "",
    openAt: "",
    itemId: "",
    tiers: "首选票档,可接受票档,保底票档",
    budget: "",
    viewers: "1",
    viewerNames: "",
    backup: "同城加场,相邻城市,二次放票,退票回流",
    officialUrl: "",
    mobileUrl: ""
  }
};

export function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

export function normalizeList(value) {
  if (!value) return [];
  return String(value)
    .split(/[,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function scoreRailPlan(target) {
  const seats = normalizeList(target.seats);
  const flexibility = normalizeList(target.flexibility);
  let score = 28;
  if (target.from && target.to) score += 10;
  if (target.date) score += 8;
  if (target.earliest && target.latest) score += 6;
  if (target.travellers) score += 5;
  score += Math.min(seats.length * 6, 18);
  score += Math.min(flexibility.length * 7, 28);
  if (target.sellAt) score += 5;
  if (target.standbyUntil) score += 5;
  if (target.officialUrl || (target.fromCode && target.toCode)) score += 5;
  return Math.min(score, 100);
}

export function scoreShowPlan(target) {
  const tiers = normalizeList(target.tiers);
  const backup = normalizeList(target.backup);
  let score = 25;
  if (target.eventName) score += 8;
  if (target.city) score += 7;
  if (target.date) score += 8;
  if (target.viewerNames) score += 5;
  if (target.openAt) score += 8;
  score += Math.min(tiers.length * 8, 24);
  score += Math.min(backup.length * 6, 24);
  if (target.budget) score += 4;
  if (target.officialUrl || target.itemId) score += 5;
  return Math.min(score, 100);
}

export function scorePlan(mode, target) {
  return mode === "show" ? scoreShowPlan(target) : scoreRailPlan(target);
}

export function readinessCopy(score, mode) {
  if (score >= 90) return "配置已经接近合法范围内的上限，关键是提前进入官方入口，不现场犹豫。";
  if (score >= 75) return "成功率基础较强，继续补齐备选目标和关键时间窗。";
  if (score >= 55) return "还有明显短板，建议增加备选票档/席别、时间窗口和官方候补/预售路径。";
  return mode === "show"
    ? "目标过窄会显著降低成功率，先补齐票档、场次、预售和回流策略。"
    : "目标过窄会显著降低成功率，先补齐候补、换乘、相邻站和席别降级策略。";
}

const ALLOWED_HOSTS = {
  rail: ["12306.cn"],
  show: ["damai.cn"]
};

const ALLOWED_APP_SCHEMES = {
  rail: ["railway12306:", "cn.12306:"],
  show: ["damai:"]
};

export function dateOnly(value) {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

export function isAllowedOfficialUrl(mode, value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const schemeAllowed = (ALLOWED_APP_SCHEMES[mode] || []).includes(url.protocol);
    if (schemeAllowed) return true;
    if (url.protocol !== "https:") return false;
    return (ALLOWED_HOSTS[mode] || []).some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function safeUrl(mode, value) {
  return isAllowedOfficialUrl(mode, value) ? String(value).trim() : "";
}

export function parseOfficialTarget(mode, value) {
  const raw = String(value || "").trim();
  if (!raw || !isAllowedOfficialUrl(mode, raw)) return {};

  if (mode === "show") {
    try {
      const url = new URL(raw);
      const itemId =
        url.searchParams.get("itemId") ||
        url.searchParams.get("itemid") ||
        url.searchParams.get("id") ||
        "";
      return itemId ? { itemId } : {};
    } catch {
      return {};
    }
  }

  return { officialUrl: raw };
}

export function buildRailWebUrl(target) {
  const custom = safeUrl("rail", target?.officialUrl);
  if (custom && custom.startsWith("https:")) return custom;

  const from = String(target?.from || "").trim();
  const to = String(target?.to || "").trim();
  const fromCode = String(target?.fromCode || "").trim().toUpperCase();
  const toCode = String(target?.toCode || "").trim().toUpperCase();
  const date = dateOnly(target?.date);

  if (from && to && fromCode && toCode && date) {
    const params = new URLSearchParams({
      linktypeid: "dc",
      fs: `${from},${fromCode}`,
      ts: `${to},${toCode}`,
      date,
      flag: "N,N,Y"
    });
    return `https://kyfw.12306.cn/otn/leftTicket/init?${params.toString()}`;
  }

  return "https://kyfw.12306.cn/otn/leftTicket/init";
}

export function buildShowWebUrl(target) {
  const custom = safeUrl("show", target?.officialUrl);
  if (custom && custom.startsWith("https:")) return custom;

  const parsed = parseOfficialTarget("show", target?.officialUrl);
  const itemId = String(target?.itemId || parsed.itemId || "").trim();
  if (itemId) return `https://detail.damai.cn/item.htm?id=${encodeURIComponent(itemId)}`;

  return "https://www.damai.cn/";
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate.url || seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

function encodeFallback(url) {
  return encodeURIComponent(url);
}

export function buildMobileCandidates(mode, target) {
  const custom = safeUrl(mode, target?.mobileUrl);
  const webUrl = buildWebUrl(mode, target);

  if (mode === "show") {
    const parsed = parseOfficialTarget("show", target?.officialUrl);
    const itemId = String(target?.itemId || parsed.itemId || "").trim();
    const mobileWeb = itemId
      ? `https://m.damai.cn/damai/detail/item.html?itemId=${encodeURIComponent(itemId)}`
      : "https://m.damai.cn/";
    const secondaryMobileWeb = itemId
      ? `https://m.damai.cn/shows/item.html?itemId=${encodeURIComponent(itemId)}`
      : "";
    const itemQuery = itemId ? `?itemId=${encodeURIComponent(itemId)}` : "";
    const encodedItemId = encodeURIComponent(itemId);
    const fallback = encodeFallback(mobileWeb || webUrl);
    const candidates = [
      custom && { label: "自定义手机入口", url: custom, kind: custom.startsWith("https:") ? "web" : "app" },
      itemId && {
        label: "大麦 App 官方详情",
        url: `intent://m.damai.cn/damai/detail/item.html?itemId=${encodedItemId}#Intent;scheme=https;package=cn.damai;S.browser_fallback_url=${fallback};end`,
        kind: "app"
      },
      itemId && {
        label: "大麦 App Scheme 详情",
        url: `intent://detail${itemQuery}#Intent;scheme=damai;package=cn.damai;S.browser_fallback_url=${fallback};end`,
        kind: "app"
      },
      itemId && {
        label: "大麦 App 域名详情",
        url: `damai://damai.cn/detail?itemId=${encodedItemId}`,
        kind: "app"
      },
      itemId && {
        label: "大麦 App 详情页",
        url: `damai://V1/ShowDetail?itemId=${encodedItemId}`,
        kind: "app"
      },
      itemId && {
        label: "大麦 App 项目页",
        url: `damai://detail${itemQuery}`,
        kind: "app"
      },
      {
        label: "大麦 App",
        url: `intent://V1/ShowDetail${itemQuery}#Intent;scheme=damai;package=cn.damai;S.browser_fallback_url=${fallback};end`,
        kind: "app"
      },
      { label: "大麦 App 首页", url: "damai://", kind: "app" },
      { label: "大麦移动网页", url: mobileWeb, kind: "web" },
      secondaryMobileWeb && { label: "大麦移动网页备用", url: secondaryMobileWeb, kind: "web" },
      { label: "大麦网页入口", url: webUrl, kind: "web" }
    ];
    return uniqueCandidates(candidates.filter(Boolean));
  }

  const candidates = [
    custom && { label: "自定义手机入口", url: custom, kind: custom.startsWith("https:") ? "web" : "app" },
    {
      label: "铁路 12306 App",
      url: `intent://#Intent;scheme=railway12306;package=com.MobileTicket;S.browser_fallback_url=${encodeFallback(webUrl)};end`,
      kind: "app"
    },
    {
      label: "铁路 12306 App 直达",
      url: `intent://#Intent;package=com.MobileTicket;S.browser_fallback_url=${encodeFallback(webUrl)};end`,
      kind: "app"
    },
    { label: "12306 App", url: "railway12306://", kind: "app" },
    { label: "12306 App 备用入口", url: "cn.12306://", kind: "app" },
    { label: "12306 官方网页", url: webUrl, kind: "web" }
  ];
  return uniqueCandidates(candidates.filter(Boolean));
}

export function buildMobileUrl(mode, target) {
  return buildMobileCandidates(mode, target)[0]?.url || buildWebUrl(mode, target);
}

export function buildWebUrl(mode, target) {
  return mode === "show" ? buildShowWebUrl(target) : buildRailWebUrl(target);
}

export function buildLaunchPlan(mode, target) {
  return {
    mode,
    webUrl: buildWebUrl(mode, target),
    mobileUrl: buildMobileUrl(mode, target),
    mobileCandidates: buildMobileCandidates(mode, target)
  };
}
