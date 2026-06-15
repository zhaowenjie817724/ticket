import {
  MODES,
  buildLaunchPlan,
  cloneDefaultState,
  parseOfficialTarget,
  readinessCopy,
  scorePlan
} from "./src/strategy.js";

const STORAGE_KEY = "jisuqiang.ticket-request.v1";

const state = {
  mode: "rail",
  targets: cloneDefaultState()
};

const fieldConfig = {
  rail: [
    ["customerName", "客户姓名/备注名", "text"],
    ["contact", "联系方式，可选", "text"],
    ["officialUrl", "12306 官方目标链接，可选", "text", "full"],
    ["from", "出发地", "text"],
    ["to", "目的地", "text"],
    ["date", "出行日期", "datetime-local"],
    ["passengers", "人数", "number"],
    ["earliest", "最早出发", "time"],
    ["latest", "最晚出发", "time"],
    ["seats", "可接受席别", "textarea", "full"],
    ["flexibility", "可接受方案", "textarea", "full"],
    ["fromCode", "出发站电报码，可选", "text"],
    ["toCode", "到达站电报码，可选", "text"],
    ["standbyUntil", "候补截止，可选", "datetime-local"],
    ["mobileUrl", "自定义手机入口，可选", "text", "full"],
    ["requestNote", "补充要求", "textarea", "full"]
  ],
  show: [
    ["customerName", "客户姓名/备注名", "text"],
    ["contact", "联系方式，可选", "text"],
    ["officialUrl", "大麦项目链接，可选", "text", "full"],
    ["eventName", "演出/项目名称", "text"],
    ["city", "城市", "text"],
    ["date", "演出时间", "datetime-local"],
    ["openAt", "开售时间，可选", "datetime-local"],
    ["itemId", "大麦项目 ID，可选", "text"],
    ["viewers", "观演人数", "number"],
    ["budget", "预算上限", "number"],
    ["tiers", "票档优先级", "textarea", "full"],
    ["backup", "可接受方案", "textarea", "full"],
    ["mobileUrl", "自定义手机入口，可选", "text", "full"],
    ["requestNote", "补充要求", "textarea", "full"]
  ]
};

const nodes = {
  modeButtons: document.querySelectorAll(".mode-btn"),
  modeTitle: document.querySelector("#mode-title"),
  modeCopy: document.querySelector("#mode-copy"),
  dynamicFields: document.querySelector("#dynamic-fields"),
  form: document.querySelector("#planner-form"),
  save: document.querySelector("#save-btn"),
  reset: document.querySelector("#reset-btn"),
  scoreNumber: document.querySelector("#score-number"),
  scoreBar: document.querySelector("#score-bar"),
  scoreCopy: document.querySelector("#score-copy"),
  requestSummary: document.querySelector("#request-summary"),
  requestText: document.querySelector("#request-text"),
  mobileOpen: document.querySelector("#mobile-open"),
  webLink: document.querySelector("#web-link"),
  copyRequest: document.querySelector("#copy-request"),
  shareRequest: document.querySelector("#share-request"),
  actionStatus: document.querySelector("#action-status"),
  launcherGrid: document.querySelector("#launcher-grid"),
  candidateList: document.querySelector("#candidate-list")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.mode && MODES[saved.mode]) state.mode = saved.mode;
    if (saved.targets) state.targets = { ...state.targets, ...saved.targets };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      mode: state.mode,
      targets: state.targets
    })
  );
}

function normalizeTargetData(mode, data) {
  const normalized = { ...data };
  const parsedOfficial = parseOfficialTarget(mode, normalized.officialUrl);
  const parsedMobile = parseOfficialTarget(mode, normalized.mobileUrl);

  if (mode === "show" && !normalized.itemId) {
    normalized.itemId = parsedOfficial.itemId || parsedMobile.itemId || "";
  }

  return normalized;
}

function setStatus(message, tone = "muted") {
  nodes.actionStatus.textContent = message;
  nodes.actionStatus.dataset.tone = tone;
}

function isWebUrl(url) {
  return /^https?:/i.test(String(url || ""));
}

function isEmbeddedBrowser() {
  return /MicroMessenger|QQ\/|MQQBrowser|AlipayClient|DingTalk/i.test(navigator.userAgent);
}

function setMode(mode) {
  collectForm();
  state.mode = mode;
  nodes.modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  render();
  saveState();
}

function collectForm() {
  const data = { ...state.targets[state.mode] };
  nodes.dynamicFields.querySelectorAll("[name]").forEach((input) => {
    data[input.name] = input.value;
  });
  state.targets[state.mode] = normalizeTargetData(state.mode, data);
}

function renderFields() {
  nodes.dynamicFields.innerHTML = "";
  const target = state.targets[state.mode];

  fieldConfig[state.mode].forEach(([name, label, type, className]) => {
    const wrapper = document.createElement("label");
    wrapper.className = `field ${className || ""}`.trim();

    const text = document.createElement("span");
    text.textContent = label;
    wrapper.appendChild(text);

    const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    if (type !== "textarea") input.type = type;
    input.name = name;
    input.value = target[name] || "";
    input.addEventListener("input", () => {
      collectForm();
      renderComputed();
      saveState();
    });
    wrapper.appendChild(input);
    nodes.dynamicFields.appendChild(wrapper);
  });
}

function displayValue(value, fallback = "未填写") {
  const text = String(value || "").trim();
  return text || fallback;
}

function displayDateTime(value) {
  return displayValue(String(value || "").replace("T", " "));
}

function copyLines(lines) {
  return lines
    .filter((line) => !line.endsWith("：") && !line.endsWith(": "))
    .join("\n");
}

function buildRequestText(mode, target, plan) {
  if (mode === "show") {
    return copyLines([
      "【大麦索票单】",
      `客户：${displayValue(target.customerName)}`,
      `联系：${displayValue(target.contact)}`,
      `项目：${displayValue(target.eventName)}`,
      `城市：${displayValue(target.city)}`,
      `演出：${displayDateTime(target.date)}`,
      `开售：${displayDateTime(target.openAt)}`,
      `人数：${displayValue(target.viewers)}`,
      `预算：${displayValue(target.budget)}`,
      `票档：${displayValue(target.tiers)}`,
      `方案：${displayValue(target.backup)}`,
      `备注：${displayValue(target.requestNote)}`,
      `网页入口：${plan.webUrl}`,
      `手机入口：${plan.mobileUrl}`
    ]);
  }

  return copyLines([
    "【12306 索票单】",
    `客户：${displayValue(target.customerName)}`,
    `联系：${displayValue(target.contact)}`,
    `行程：${displayValue(target.from)} → ${displayValue(target.to)}`,
    `日期：${displayDateTime(target.date)}`,
    `时间：${displayValue(target.earliest)} - ${displayValue(target.latest)}`,
    `人数：${displayValue(target.passengers)}`,
    `席别：${displayValue(target.seats)}`,
    `方案：${displayValue(target.flexibility)}`,
    `候补截止：${displayDateTime(target.standbyUntil)}`,
    `备注：${displayValue(target.requestNote)}`,
    `网页入口：${plan.webUrl}`,
    `手机入口：${plan.mobileUrl}`
  ]);
}

function summaryRows(mode, target, plan) {
  if (mode === "show") {
    return [
      ["客户", displayValue(target.customerName)],
      ["项目", displayValue(target.eventName)],
      ["城市", displayValue(target.city)],
      ["演出时间", displayDateTime(target.date)],
      ["人数/预算", `${displayValue(target.viewers)} 人 · ${displayValue(target.budget, "预算未填")}`],
      ["票档", displayValue(target.tiers)],
      ["入口", plan.webUrl]
    ];
  }

  return [
    ["客户", displayValue(target.customerName)],
    ["行程", `${displayValue(target.from)} → ${displayValue(target.to)}`],
    ["出行时间", displayDateTime(target.date)],
    ["时间窗口", `${displayValue(target.earliest)} - ${displayValue(target.latest)}`],
    ["人数/席别", `${displayValue(target.passengers)} 人 · ${displayValue(target.seats)}`],
    ["可接受方案", displayValue(target.flexibility)],
    ["入口", plan.webUrl]
  ];
}

function renderSummary(mode, target, plan) {
  nodes.requestSummary.innerHTML = "";
  summaryRows(mode, target, plan).forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "summary-row";
    row.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    nodes.requestSummary.appendChild(row);
  });

  nodes.requestText.textContent = buildRequestText(mode, target, plan);
  nodes.webLink.href = plan.webUrl;
  nodes.mobileOpen.textContent = mode === "show" ? "强开大麦 App" : "强开 12306 App";
}

function renderCandidates(plan) {
  nodes.candidateList.innerHTML = "";
  plan.mobileCandidates.slice(0, 5).forEach((candidate) => {
    const item = document.createElement("span");
    item.textContent = candidate.label;
    nodes.candidateList.appendChild(item);
  });
}

function renderLaunchers() {
  const mode = MODES[state.mode];
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  const launchers = [
    {
      title: "官方网页入口",
      url: plan.webUrl,
      note: "电脑端或浏览器使用。"
    },
    {
      title: "官方 App / 移动入口",
      url: plan.mobileUrl,
      note: "手机端优先使用，失败则走网页。"
    },
    ...mode.launchers
  ];

  nodes.launcherGrid.innerHTML = "";
  launchers.forEach((launcher) => {
    const link = document.createElement("a");
    link.className = "launch-card";
    link.href = launcher.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `<strong>${launcher.title}</strong><span>${launcher.note}</span>`;
    nodes.launcherGrid.appendChild(link);
  });
}

function renderComputed() {
  const target = state.targets[state.mode];
  const plan = buildLaunchPlan(state.mode, target);
  const score = scorePlan(state.mode, target);

  nodes.scoreNumber.textContent = String(score);
  nodes.scoreBar.style.width = `${score}%`;
  nodes.scoreCopy.textContent = readinessCopy(score, state.mode);
  renderSummary(state.mode, target, plan);
  renderCandidates(plan);
  renderLaunchers();
}

function render() {
  const mode = MODES[state.mode];
  nodes.modeTitle.textContent = state.mode === "show" ? "大麦索票信息" : "12306 索票信息";
  nodes.modeCopy.textContent = state.mode === "show"
    ? "收集项目、城市、票档和预算，生成可直接转给客户确认的索票单。"
    : "收集行程、席别、时间窗口和备选方案，生成可直接转给客户确认的索票单。";
  document.title = `极速抢索票 - ${mode.label}`;
  renderFields();
  renderComputed();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function copyRequestText() {
  collectForm();
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  const text = buildRequestText(state.mode, state.targets[state.mode], plan);
  await copyText(text);
  setStatus("索票单已复制，可直接发给客户确认。", "success");
}

async function shareRequestText() {
  collectForm();
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  const text = buildRequestText(state.mode, state.targets[state.mode], plan);
  if (navigator.share) {
    await navigator.share({ title: "极速抢索票单", text });
    setStatus("已打开系统分享。", "success");
    return;
  }
  await copyText(text);
  setStatus("当前浏览器不支持分享，已改为复制索票单。", "success");
}

function openMobileQueue() {
  collectForm();
  saveState();
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  const candidates = plan.mobileCandidates.length
    ? plan.mobileCandidates
    : [{ label: "官方网页", url: plan.webUrl, kind: "web" }];
  let index = 0;
  let stopped = false;

  const markStopped = () => {
    stopped = true;
  };

  const cleanup = () => {
    window.removeEventListener("pagehide", markStopped);
    window.removeEventListener("blur", markStopped);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") markStopped();
  };

  const tryNext = () => {
    if (stopped) {
      cleanup();
      return;
    }

    const candidate = candidates[index];
    index += 1;

    if (!candidate) {
      cleanup();
      setStatus("App 未接管，已切到官方网页。", "success");
      window.location.href = plan.webUrl;
      return;
    }

    setStatus(`正在尝试 ${index}/${candidates.length}：${candidate.label}`, "loading");
    window.location.href = candidate.url;

    if (isWebUrl(candidate.url)) {
      cleanup();
      return;
    }

    window.setTimeout(tryNext, 1050);
  };

  if (isEmbeddedBrowser()) {
    setStatus("当前内置浏览器可能拦截 App，将按强开队列尝试。", "loading");
  }

  window.addEventListener("pagehide", markStopped);
  window.addEventListener("blur", markStopped);
  document.addEventListener("visibilitychange", onVisibilityChange);
  tryNext();
}

function resetCurrentMode() {
  state.targets[state.mode] = cloneDefaultState()[state.mode];
  render();
  saveState();
  setStatus("当前模式已清空。", "muted");
}

nodes.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

nodes.form.addEventListener("submit", (event) => {
  event.preventDefault();
  collectForm();
  renderComputed();
  saveState();
  document.querySelector("#request-title").scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("索票单已生成。", "success");
});

nodes.save.addEventListener("click", () => {
  collectForm();
  saveState();
  renderComputed();
  setStatus("索票信息已保存到本机。", "success");
});

nodes.reset.addEventListener("click", resetCurrentMode);
nodes.mobileOpen.addEventListener("click", openMobileQueue);
nodes.copyRequest.addEventListener("click", copyRequestText);
nodes.shareRequest.addEventListener("click", shareRequestText);

loadState();
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
