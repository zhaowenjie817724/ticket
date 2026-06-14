import {
  MODES,
  cloneDefaultState,
  scorePlan,
  buildActions,
  buildWindows,
  readinessCopy
} from "./src/strategy.js";

const STORAGE_KEY = "jisuqiang.ticket-copilot.v1";

const state = {
  mode: "rail",
  targets: cloneDefaultState(),
  checks: {}
};

const fieldConfig = {
  rail: [
    ["from", "出发地", "text"],
    ["to", "目的地", "text"],
    ["date", "出行日期", "datetime-local"],
    ["earliest", "最早出发", "time"],
    ["latest", "最晚出发", "time"],
    ["passengers", "人数", "number"],
    ["sellAt", "起售时间", "datetime-local"],
    ["standbyUntil", "候补截止", "datetime-local"],
    ["seats", "可接受席别，逗号分隔", "textarea", "full"],
    ["flexibility", "备选策略，逗号分隔", "textarea", "full"]
  ],
  show: [
    ["eventName", "演出名称", "text"],
    ["city", "城市", "text"],
    ["date", "演出时间", "datetime-local"],
    ["openAt", "开售时间", "datetime-local"],
    ["viewers", "观演人数", "number"],
    ["budget", "预算上限", "number"],
    ["tiers", "票档优先级，逗号分隔", "textarea", "full"],
    ["backup", "备选策略，逗号分隔", "textarea", "full"]
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
  actionList: document.querySelector("#action-list"),
  checklist: document.querySelector("#checklist"),
  resetChecks: document.querySelector("#reset-checks"),
  launcherGrid: document.querySelector("#launcher-grid"),
  refreshTime: document.querySelector("#refresh-time")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.mode && MODES[saved.mode]) state.mode = saved.mode;
    if (saved.targets) {
      state.targets = { ...state.targets, ...saved.targets };
    }
    if (saved.checks) state.checks = saved.checks;
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
      checks: state.checks
    })
  );
}

function setMode(mode) {
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
  state.targets[state.mode] = data;
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

  nodes.actionList.innerHTML = "";
  buildActions(state.mode, target).forEach((action) => {
    const item = document.createElement("li");
    item.textContent = action;
    nodes.actionList.appendChild(item);
  });
}

function renderChecklist() {
  nodes.checklist.innerHTML = "";
  MODES[state.mode].checklist.forEach((item, index) => {
    const id = `${state.mode}:${index}`;
    const row = document.createElement("label");
    row.className = "check-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(state.checks[id]);
    input.addEventListener("change", () => {
      state.checks[id] = input.checked;
      saveState();
    });

    const text = document.createElement("span");
    text.textContent = item;

    row.append(input, text);
    nodes.checklist.appendChild(row);
  });
}

function renderLaunchers() {
  nodes.launcherGrid.innerHTML = "";
  MODES[state.mode].launchers.forEach((launcher) => {
    const link = document.createElement("a");
    link.className = "launch-card";
    link.href = launcher.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `<strong>${launcher.title}</strong><span>${launcher.note}</span>`;
    nodes.launcherGrid.appendChild(link);
  });
}

function render() {
  const mode = MODES[state.mode];
  nodes.modeTitle.textContent = mode.title;
  document.title = `极速抢 - ${mode.label}`;
  renderFields();
  renderComputed();
  renderChecklist();
  renderLaunchers();
}

function resetCurrentChecks() {
  MODES[state.mode].checklist.forEach((_, index) => {
    state.checks[`${state.mode}:${index}`] = false;
  });
  saveState();
  renderChecklist();
}

nodes.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

nodes.form.addEventListener("submit", (event) => {
  event.preventDefault();
  collectForm();
  renderComputed();
  saveState();
  nodes.actionList.scrollIntoView({ behavior: "smooth", block: "start" });
});

nodes.save.addEventListener("click", () => {
  collectForm();
  saveState();
});

nodes.resetChecks.addEventListener("click", resetCurrentChecks);
nodes.refreshTime.addEventListener("click", renderComputed);

loadState();
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
