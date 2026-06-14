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
      "已准备候补组合、相邻站、换乘和席别降级预案。"
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
      "已确定首选票档、可接受票档和保底票档。"
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
    flexibility: "相邻站,中转换乘,席别降级,前后一天"
  },
  show: {
    eventName: "演唱会",
    city: "",
    date: "",
    openAt: "",
    tiers: "首选票档,可接受票档,保底票档",
    budget: "",
    viewers: "1",
    backup: "同城加场,相邻城市,二次放票,退票回流"
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
    `第一梯队：开售前 5 分钟进入官方余票页，目标 ${mainRoute}，优先 ${firstSeat}，本人手动提交订单。`,
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
    `第一梯队：开售前保持大麦官方入口在线，目标 ${target.eventName || "演出"}，先点 ${firstTier}，本人确认提交。`,
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
