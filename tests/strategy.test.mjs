import assert from "node:assert/strict";
import {
  buildActions,
  buildWindows,
  cloneDefaultState,
  formatRemaining,
  normalizeList,
  readinessCopy,
  scorePlan
} from "../src/strategy.js";

const state = cloneDefaultState();

assert.deepEqual(normalizeList("二等座, 一等座；无座\n硬座"), ["二等座", "一等座", "无座", "硬座"]);
assert.equal(normalizeList("").length, 0);

const railScore = scorePlan("rail", {
  ...state.rail,
  from: "北京",
  to: "上海",
  date: "2026-07-01T09:00",
  sellAt: "2026-06-20T10:00",
  standbyUntil: "2026-07-01T08:00"
});
assert.ok(railScore >= 80, `rail score should be strong, got ${railScore}`);

const showScore = scorePlan("show", {
  ...state.show,
  eventName: "演唱会",
  city: "上海",
  date: "2026-08-01T19:30",
  openAt: "2026-07-01T12:00",
  tiers: "1280,980,680,480",
  backup: "加场,二次放票,退票回流,相邻城市"
});
assert.ok(showScore >= 88, `show score should be strong, got ${showScore}`);

assert.equal(buildActions("rail", state.rail).length, 5);
assert.equal(buildActions("show", state.show).length, 5);
assert.equal(buildWindows("rail", state.rail).length, 3);
assert.equal(buildWindows("show", state.show).length, 3);

assert.equal(formatRemaining(""), "未设置");
assert.equal(formatRemaining("2000-01-01T00:00:00"), "已进入窗口");
assert.ok(readinessCopy(95, "rail").includes("上限"));

console.log("strategy tests passed");
