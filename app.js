import {
  MODES,
  buildLaunchPlan,
  buildWindows,
  cloneDefaultState,
  parseOfficialTarget,
  readinessCopy,
  scorePlan
} from "./src/strategy.js";
import { normalizePrefillMode, sanitizePrefillFields } from "./src/prefill.js";

const STORAGE_KEY = "jisuqiang.ticket-copilot.v2";
const MAX_PREFILL_IMAGE_BYTES = 8 * 1024 * 1024;

const state = {
  mode: "rail",
  targets: cloneDefaultState(),
  options: {
    autoJump: true,
    fullscreen: true,
    wakeLock: true
  }
};

const runtime = {
  timer: null,
  armed: false,
  fired: false,
  wakeLock: null,
  audioContext: null
};

const fieldConfig = {
  rail: [
    ["officialUrl", "12306 官方目标链接，粘贴后优先使用", "text", "full"],
    ["from", "出发地", "text"],
    ["to", "目的地", "text"],
    ["date", "出行日期", "datetime-local"],
    ["sellAt", "起售时间", "datetime-local"],
    ["leadMinutes", "提前进入分钟数", "number"],
    ["earliest", "最早出发", "time"],
    ["latest", "最晚出发", "time"],
    ["passengers", "人数", "number"],
    ["standbyUntil", "候补截止", "datetime-local"],
    ["fromCode", "出发站电报码，可选", "text"],
    ["toCode", "到达站电报码，可选", "text"],
    ["seats", "可接受席别，逗号分隔", "textarea", "full"],
    ["flexibility", "备选策略，逗号分隔", "textarea", "full"],
    ["mobileUrl", "自定义手机入口，可选", "text", "full"]
  ],
  show: [
    ["officialUrl", "大麦项目链接，粘贴详情页可自动识别项目 ID", "text", "full"],
    ["eventName", "演出名称", "text"],
    ["city", "城市", "text"],
    ["date", "演出时间", "datetime-local"],
    ["openAt", "开售时间", "datetime-local"],
    ["leadMinutes", "提前进入分钟数", "number"],
    ["itemId", "大麦项目 ID，可选", "text"],
    ["viewers", "观演人数", "number"],
    ["budget", "预算上限", "number"],
    ["tiers", "票档优先级，逗号分隔", "textarea", "full"],
    ["backup", "备选策略，逗号分隔", "textarea", "full"],
    ["mobileUrl", "自定义手机入口，可选", "text", "full"]
  ]
};

const nodes = {
  modeButtons: document.querySelectorAll(".mode-btn"),
  modeTitle: document.querySelector("#mode-title"),
  dynamicFields: document.querySelector("#dynamic-fields"),
  form: document.querySelector("#planner-form"),
  save: document.querySelector("#save-btn"),
  scoreNumber: document.querySelector("#score-number"),
  scoreBar: document.querySelector("#score-bar"),
  scoreCopy: document.querySelector("#score-copy"),
  timeline: document.querySelector("#timeline"),
  launcherGrid: document.querySelector("#launcher-grid"),
  refreshTime: document.querySelector("#refresh-time"),
  sprintStatus: document.querySelector("#sprint-status"),
  sprintMeta: document.querySelector("#sprint-meta"),
  networkGrid: document.querySelector("#network-grid"),
  autoJump: document.querySelector("#auto-jump"),
  fullscreen: document.querySelector("#fullscreen-mode"),
  wakeLock: document.querySelector("#wake-lock-mode"),
  armSprint: document.querySelector("#arm-sprint"),
  jumpNow: document.querySelector("#jump-now"),
  jumpMobile: document.querySelector("#jump-mobile"),
  copyLink: document.querySelector("#copy-link"),
  imagePrefillFile: document.querySelector("#image-prefill-file"),
  imagePrefillButton: document.querySelector("#image-prefill-btn"),
  imagePrefillName: document.querySelector("#image-prefill-name"),
  imagePrefillStatus: document.querySelector("#image-prefill-status")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.mode && MODES[saved.mode]) state.mode = saved.mode;
    if (saved.targets) state.targets = { ...state.targets, ...saved.targets };
    if (saved.options) state.options = { ...state.options, ...saved.options };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      mode: state.mode,
      targets: state.targets,
      options: state.options
    })
  );
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(navigator.userAgent);
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

function setMode(mode) {
  state.mode = mode;
  runtime.fired = false;
  nodes.modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  render();
  saveState();
}

function setPrefillStatus(message, tone = "muted") {
  nodes.imagePrefillStatus.textContent = message;
  nodes.imagePrefillStatus.dataset.tone = tone;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function applyPrefillResult(result) {
  const mode = normalizePrefillMode(result.mode, state.mode);
  const fields = sanitizePrefillFields(mode, result.fields || {});
  const count = Object.keys(fields).length;
  if (!count) return 0;

  state.mode = mode;
  runtime.fired = false;
  nodes.modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  state.targets[mode] = normalizeTargetData(mode, {
    ...state.targets[mode],
    ...fields
  });
  render();
  saveState();
  return count;
}

async function runImagePrefill() {
  const file = nodes.imagePrefillFile.files?.[0];
  if (!file) {
    setPrefillStatus("未选择图片", "muted");
    return;
  }

  if (file.size > MAX_PREFILL_IMAGE_BYTES) {
    setPrefillStatus("图片超过 8 MB，请换一张更小的截图。", "error");
    return;
  }

  collectForm();
  nodes.imagePrefillButton.disabled = true;
  setPrefillStatus("正在识别图片...", "loading");

  try {
    const image = await fileToDataUrl(file);
    const response = await fetch("./api/image-prefill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: state.mode,
        image,
        filename: file.name,
        mimeType: file.type
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || "AI 识别不可用，已保留手动填写。");

    const count = applyPrefillResult(payload);
    if (!count) {
      setPrefillStatus("没有识别到可填字段，已保留手动填写。", "muted");
      return;
    }

    const provider = payload.provider?.label || "AI";
    setPrefillStatus(`已填入 ${count} 项 · ${provider}`, "success");
  } catch (error) {
    setPrefillStatus(error.message || "AI 识别不可用，已保留手动填写。", "error");
  } finally {
    nodes.imagePrefillButton.disabled = false;
  }
}

function collectForm() {
  const data = { ...state.targets[state.mode] };
  nodes.dynamicFields.querySelectorAll("[name]").forEach((input) => {
    data[input.name] = input.value;
  });
  state.targets[state.mode] = normalizeTargetData(state.mode, data);
}

function collectOptions() {
  state.options.autoJump = nodes.autoJump?.checked ?? true;
  state.options.fullscreen = nodes.fullscreen?.checked ?? true;
  state.options.wakeLock = nodes.wakeLock?.checked ?? true;
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

function renderComputed() {
  const target = state.targets[state.mode];
  const score = scorePlan(state.mode, target);
  nodes.scoreNumber.textContent = String(score);
  nodes.scoreBar.style.width = `${score}%`;
  nodes.scoreCopy.textContent = readinessCopy(score, state.mode);

  nodes.timeline.innerHTML = "";
  buildWindows(state.mode, target).forEach((item) => {
    const row = document.createElement("div");
    row.className = "time-row";
    row.innerHTML = `<strong>${item.title}</strong><span>${item.value}</span><span>${item.remaining}</span>`;
    nodes.timeline.appendChild(row);
  });

  renderSprint();
  renderLaunchers();
}

function renderMobileCandidates(plan) {
  return plan.mobileCandidates
    .slice(0, 4)
    .map((candidate) => `<span>${candidate.label}</span>`)
    .join("");
}

function renderSprint() {
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  const status = runtime.armed ? "冲刺模式已启动" : "冲刺模式未启动";
  const autoText = state.options.autoJump ? "到点自动跳转已开启" : "到点只提示，不自动跳转";
  nodes.sprintStatus.textContent = `${status} · ${autoText}`;
  nodes.sprintMeta.innerHTML = `
    <div><strong>提前进入：</strong><span>${plan.sprintAt}</span><span>${plan.sprintRemaining}</span></div>
    <div><strong>正式开抢：</strong><span>${plan.targetAt}</span><span>${plan.targetRemaining}</span></div>
    <div><strong>网页入口：</strong><span>${plan.webUrl}</span></div>
    <div><strong>手机优先入口：</strong><span>${plan.mobileCandidates[0]?.label || "未生成"} · ${plan.mobileUrl}</span></div>
    <div><strong>手机尝试顺序：</strong><span class="candidate-list">${renderMobileCandidates(plan)}</span></div>
  `;
}

function renderLaunchers() {
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  const launchers = [
    {
      title: "目标网页入口",
      url: plan.webUrl,
      note: "按你填写的信息生成，电脑端优先使用。"
    },
    {
      title: "手机 App/移动入口",
      url: plan.mobileUrl,
      note: "手机按钮会按 App 深链、移动网页、官方网页依次尝试。"
    },
    ...MODES[state.mode].launchers
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

function renderNetwork(status = {}) {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const rows = [
    ["在线状态", navigator.onLine ? "在线" : "离线"],
    ["浏览器网络", connection ? `${connection.effectiveType || "未知"} · RTT ${connection.rtt || "?"}ms · ${connection.downlink || "?"}Mbps` : "浏览器不支持详细网络信息"],
    ["本机探测", status.localLatency ? `${status.localLatency}ms` : "未探测"],
    ["专注建议", "开抢前关闭下载、视频、同步盘、游戏和省电模式"]
  ];
  nodes.networkGrid.innerHTML = rows
    .map(([label, value]) => `<div class="network-row"><strong>${label}</strong><span>${value}</span></div>`)
    .join("");
}

function render() {
  const mode = MODES[state.mode];
  nodes.modeTitle.textContent = mode.title;
  document.title = `极速抢 - ${mode.label}`;
  nodes.autoJump.checked = state.options.autoJump;
  nodes.fullscreen.checked = state.options.fullscreen;
  nodes.wakeLock.checked = state.options.wakeLock;
  renderFields();
  renderComputed();
  renderNetwork();
}

function addPreconnect(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return;
    ["dns-prefetch", "preconnect"].forEach((rel) => {
      const existing = document.querySelector(`link[rel="${rel}"][href="${parsed.origin}"]`);
      if (existing) return;
      const link = document.createElement("link");
      link.rel = rel;
      link.href = parsed.origin;
      document.head.appendChild(link);
    });
  } catch {
    // Ignore invalid optional app links.
  }
}

function isWebUrl(url) {
  return /^https?:/i.test(String(url || ""));
}

async function requestWakeLock() {
  if (!state.options.wakeLock || !("wakeLock" in navigator)) return;
  try {
    runtime.wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    runtime.wakeLock = null;
  }
}

async function enterFullscreen() {
  if (!state.options.fullscreen || !document.documentElement.requestFullscreen) return;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch {
    // Fullscreen is best-effort.
  }
}

async function requestNotifications() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    // Notification permission is optional.
  }
}

function prepareAudio() {
  if (runtime.audioContext) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  runtime.audioContext = new AudioContext();
  runtime.audioContext.resume?.();
}

function beep() {
  const ctx = runtime.audioContext;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  gain.gain.value = 0.08;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  window.setTimeout(() => {
    osc.stop();
    osc.disconnect();
    gain.disconnect();
  }, 260);
}

function notify(title, body) {
  beep();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

async function runNetworkCheck() {
  const start = performance.now();
  try {
    await fetch(`./manifest.webmanifest?probe=${Date.now()}`, { cache: "no-store" });
    renderNetwork({ localLatency: Math.round(performance.now() - start) });
  } catch {
    renderNetwork({ localLatency: "失败" });
  }
}

function launch(preferMobile = false, scheduled = false) {
  collectForm();
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  const mobile = preferMobile || isMobileDevice();

  if (mobile) {
    launchMobileQueue(plan);
    return;
  }

  if (scheduled) {
    window.location.href = plan.webUrl;
    return;
  }

  window.open(plan.webUrl, "_blank", "noopener,noreferrer");
}

function launchMobileQueue(plan) {
  const candidates = plan.mobileCandidates.length
    ? plan.mobileCandidates
    : [{ label: "官方网页", url: plan.webUrl, kind: "web" }];
  let index = 0;
  let stopped = false;

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") stopped = true;
  };

  const cleanup = () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };

  const attemptNext = () => {
    if (stopped) {
      cleanup();
      return;
    }

    const candidate = candidates[index];
    index += 1;

    if (!candidate) {
      cleanup();
      window.location.href = plan.webUrl;
      return;
    }

    nodes.sprintStatus.textContent = `正在打开：${candidate.label}`;
    window.location.href = candidate.url;

    if (isWebUrl(candidate.url)) {
      cleanup();
      return;
    }

    window.setTimeout(attemptNext, 1200);
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  attemptNext();
}

function fireSprint() {
  if (runtime.fired) return;
  runtime.fired = true;
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  notify("极速抢：进入开抢窗口", `${plan.leadMinutes} 分钟预备窗口已到，正在进入官方入口。`);
  nodes.sprintStatus.textContent = state.options.autoJump
    ? "已进入开抢窗口，正在跳转官方入口"
    : "已进入开抢窗口，请立即点击跳转";
  if (state.options.autoJump) launch(isMobileDevice(), true);
}

function tickSprint() {
  renderComputed();
  if (!runtime.armed || runtime.fired) return;
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  if (!plan.sprintMoment) return;
  if (Date.now() >= plan.sprintMoment.getTime()) fireSprint();
}

async function armSprintMode() {
  collectForm();
  collectOptions();
  saveState();
  runtime.armed = true;
  runtime.fired = false;
  document.body.classList.add("sprint-active");

  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  addPreconnect(plan.webUrl);
  plan.mobileCandidates.forEach((candidate) => addPreconnect(candidate.url));
  prepareAudio();
  await Promise.all([requestWakeLock(), requestNotifications(), enterFullscreen(), runNetworkCheck()]);

  if (runtime.timer) window.clearInterval(runtime.timer);
  runtime.timer = window.setInterval(tickSprint, 1000);
  notify("极速抢：冲刺模式已启动", `将在 ${plan.sprintAt} 进入官方入口。`);
  tickSprint();
}

async function copyLaunchLink() {
  collectForm();
  const plan = buildLaunchPlan(state.mode, state.targets[state.mode]);
  await navigator.clipboard?.writeText(plan.webUrl);
  nodes.sprintStatus.textContent = "目标网页链接已复制";
}

nodes.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

nodes.form.addEventListener("submit", (event) => {
  event.preventDefault();
  collectForm();
  renderComputed();
  saveState();
  document.querySelector("#sprint-title").scrollIntoView({ behavior: "smooth", block: "start" });
});

nodes.save.addEventListener("click", () => {
  collectForm();
  collectOptions();
  saveState();
  renderComputed();
});

[nodes.autoJump, nodes.fullscreen, nodes.wakeLock].forEach((node) => {
  node.addEventListener("change", () => {
    collectOptions();
    saveState();
    renderSprint();
  });
});

nodes.refreshTime.addEventListener("click", () => {
  renderComputed();
  runNetworkCheck();
});
nodes.armSprint.addEventListener("click", armSprintMode);
nodes.jumpNow.addEventListener("click", () => launch(false, false));
nodes.jumpMobile.addEventListener("click", () => launch(true, false));
nodes.copyLink.addEventListener("click", copyLaunchLink);
nodes.imagePrefillFile.addEventListener("change", () => {
  const file = nodes.imagePrefillFile.files?.[0];
  nodes.imagePrefillName.textContent = file ? file.name : "选择图片";
  nodes.imagePrefillButton.disabled = !file;
  setPrefillStatus(file ? `${Math.ceil(file.size / 1024)} KB · 等待识别` : "未选择图片", "muted");
});
nodes.imagePrefillButton.addEventListener("click", runImagePrefill);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && runtime.armed) requestWakeLock();
});
window.addEventListener("online", runNetworkCheck);
window.addEventListener("offline", runNetworkCheck);

loadState();
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
