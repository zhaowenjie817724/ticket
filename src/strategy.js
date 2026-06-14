export const MODES = {
  rail: {
    id: "rail",
    label: "12306",
    title: "12306 车票作战台",
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
    ],
    checklist: [
      "账号已登录，手机号可收验证码。",
      "乘车人身份核验已通过，同行人已提前添加。",
      "支付 App 可用，银行卡或余额足够。",
      "已确认出发站起售时间，电脑和手机时间已同步。",
      "已准备候补组合、相邻站、换乘和席别降级预案。",
      "准备开抢前已关闭无关下载、视频、游戏和后台同步，手机关闭省电模式。"
    ]
  },
  show: {
    id: "show",
    label: "大麦",
    title: "大麦演出票作战台",
    copy: "票档优先级、预约预售、观演人、支付链路和二次放票窗口一起拉满。",
    launchers: [
      {
        title: "大麦官网",
        url: "https://www.damai.cn/",
        note: "用于搜索项目、预约、查看官方票务规则。"
      },
      {
        title: "大麦 App",
        url: "https://www.damai.cn/app/",
        note: "移动端开售前保持登录，由本人确认提交。"
      }
    ],
    checklist: [
      "账号已登录，手机号可用。",
      "实名观演人已提前设置，默认观演人无误。",
      "默认收货地址和支付方式已确认。",
      "已完成预约、想看、会员或品牌预售入口检查。",
      "已确定首选票档、可接受票档和保底票档。",
      "准备开抢前已关闭无关下载、视频、游戏和后台同步，手机关闭省电模式。"
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
    sellAt: "",
    standbyUntil: "",
    flexibility: "相邻站,中转换乘,席别降级,前后一天",
    fromCode: "",
    toCode: "",
    officialUrl: "",
    mobileUrl: "",
    leadMinutes: "5"
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
    backup: "同城加场,相邻城市,二次放票,退票回流",
    officialUrl: "",
    mobileUrl: "",
    leadMinutes: "5"
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

export function parseDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRemaining(target, now = new Date()) {
  const date = parseDateTime(target);
  if (!date) return "未设置";
  const diff = date.getTime() - now.getTime();
  if (diff <= 0) return "已进入窗口";
  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  if (days > 0) return `${days} 天 ${hours} 小时 ${minutes} 分`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分 ${sec} 秒`;
  return `${minutes} 分 ${sec} 秒`;
}

export function scoreRailPlan(target) {
  const seats = normalizeList(target.seats);
  const flexibility = normalizeList(target.flexibility);
  let score = 28;
  if (target.from && target.to) score += 10;
  if (target.date) score += 8;
  if (target.earliest && target.latest) score += 6;
  score += Math.min(seats.length * 6, 18);
  score += Math.min(flexibility.length * 7, 28);
  if (target.sellAt) score += 5;
  if (target.standbyUntil) score += 5;
  if (target.officialUrl || (target.fromCode && target.toCode)) score += 5;
  if (target.leadMinutes) score += 2;
  return Math.min(score, 100);
}

export function scoreShowPlan(target) {
  const tiers = normalizeList(target.tiers);
  const backup = normalizeList(target.backup);
  let score = 25;
  if (target.eventName) score += 8;
  if (target.city) score += 7;
  if (target.date) score += 8;
  if (target.openAt) score += 8;
  score += Math.min(tiers.length * 8, 24);
  score += Math.min(backup.length * 6, 24);
  if (target.budget) score += 4;
  if (target.officialUrl || target.itemId) score += 5;
  if (target.leadMinutes) score += 2;
  return Math.min(score, 100);
}

export function scorePlan(mode, target) {
  return mode === "show" ? scoreShowPlan(target) : scoreRailPlan(target);
}

export function buildRailActions(target) {
  const seats = normalizeList(target.seats);
  const flexibility = normalizeList(target.flexibility);
  const mainRoute = `${target.from || "出发地"} → ${target.to || "目的地"}`;
  const firstSeat = seats[0] || "首选席别";
  const fallbackSeats = seats.slice(1).join("、") || "可接受席别";
  const flexText = flexibility.join("、") || "相邻站、中转换乘、席别降级";

  return [
    `第一梯队：开售前 ${getLeadMinutes(target)} 分钟自动进入官方目标页，目标 ${mainRoute}，优先 ${firstSeat}，本人手动提交订单。`,
    `第二梯队：首轮失败后立即切 ${fallbackSeats}，减少犹豫时间。`,
    `第三梯队：同步启用官方候补，把 ${flexText} 组合填满，候补截止设到你能接受的最晚时间。`,
    "第四梯队：盯支付超时回流、退改签回流和临近发车释放窗口，不把战场只押在开售第一秒。",
    "第五梯队：如果当天必须到达，优先保到达结果，再用中转换乘或相邻站修正体验。"
  ];
}

export function buildShowActions(target) {
  const tiers = normalizeList(target.tiers);
  const backups = normalizeList(target.backup);
  const firstTier = tiers[0] || "首选票档";
  const fallbackTiers = tiers.slice(1).join("、") || "可接受票档";
  const backupText = backups.join("、") || "二次放票、退票回流、相邻场次";

  return [
    `第一梯队：开售前 ${getLeadMinutes(target)} 分钟自动进入官方目标页，目标 ${target.eventName || "演出"}，先点 ${firstTier}，本人确认提交。`,
    `第二梯队：首选票档失败后立即切 ${fallbackTiers}，目标是先进入官方支付页。`,
    "第三梯队：提前完成预约、想看、会员/品牌预售入口检查，能走官方预售就不等公开开售。",
    `第四梯队：首轮失败后进入 ${backupText}，持续盯官方回流。`,
    "第五梯队：不要多账号、多设备乱冲；稳定登录态和干净行为比对抗风控更重要。"
  ];
}

export function buildActions(mode, target) {
  return mode === "show" ? buildShowActions(target) : buildRailActions(target);
}

export function buildWindows(mode, target, now = new Date()) {
  if (mode === "show") {
    return [
      {
        title: "开售时间",
        value: target.openAt || "未设置",
        remaining: formatRemaining(target.openAt, now)
      },
      {
        title: "演出日期",
        value: target.date || "未设置",
        remaining: formatRemaining(target.date, now)
      },
      {
        title: "二次放票/回流",
        value: "开售后、退票期、临近开演",
        remaining: "需人工关注官方入口"
      }
    ];
  }

  return [
    {
      title: "起售时间",
      value: target.sellAt || "未设置",
      remaining: formatRemaining(target.sellAt, now)
    },
    {
      title: "候补截止",
      value: target.standbyUntil || "未设置",
      remaining: formatRemaining(target.standbyUntil, now)
    },
    {
      title: "出行日期",
      value: target.date || "未设置",
      remaining: formatRemaining(target.date, now)
    }
  ];
}

export function readinessCopy(score, mode) {
  if (score >= 90) return "配置已经接近合法范围内的上限，关键是按梯队执行，不现场犹豫。";
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

export function getLeadMinutes(target) {
  const value = Number.parseFloat(target?.leadMinutes);
  if (!Number.isFinite(value)) return 5;
  return Math.max(0, Math.min(30, value));
}

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

  const itemId = String(target?.itemId || "").trim();
  if (itemId) return `https://detail.damai.cn/item.htm?id=${encodeURIComponent(itemId)}`;

  return "https://www.damai.cn/";
}

export function buildMobileUrl(mode, target) {
  const custom = safeUrl(mode, target?.mobileUrl);
  if (custom) return custom;

  if (mode === "show") {
    const itemId = String(target?.itemId || "").trim();
    if (itemId) return `https://m.damai.cn/damai/detail/item.html?itemId=${encodeURIComponent(itemId)}`;
    return "damai://";
  }

  return safeUrl("rail", target?.mobileUrl) || buildRailWebUrl(target);
}

export function buildWebUrl(mode, target) {
  return mode === "show" ? buildShowWebUrl(target) : buildRailWebUrl(target);
}

export function getTargetMoment(mode, target) {
  return parseDateTime(mode === "show" ? target?.openAt : target?.sellAt);
}

export function getSprintMoment(mode, target) {
  const targetMoment = getTargetMoment(mode, target);
  if (!targetMoment) return null;
  return new Date(targetMoment.getTime() - getLeadMinutes(target) * 60 * 1000);
}

export function formatDateTime(date) {
  if (!date) return "未设置";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function buildLaunchPlan(mode, target, now = new Date()) {
  const targetMoment = getTargetMoment(mode, target);
  const sprintMoment = getSprintMoment(mode, target);
  return {
    mode,
    webUrl: buildWebUrl(mode, target),
    mobileUrl: buildMobileUrl(mode, target),
    leadMinutes: getLeadMinutes(target),
    targetMoment,
    sprintMoment,
    sprintAt: formatDateTime(sprintMoment),
    targetAt: formatDateTime(targetMoment),
    sprintRemaining: sprintMoment ? formatRemaining(sprintMoment.toISOString(), now) : "未设置",
    targetRemaining: targetMoment ? formatRemaining(targetMoment.toISOString(), now) : "未设置"
  };
}

export function shouldFireSprint(mode, target, now = new Date()) {
  const sprintMoment = getSprintMoment(mode, target);
  if (!sprintMoment) return false;
  return now.getTime() >= sprintMoment.getTime();
}
