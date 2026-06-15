import assert from "node:assert/strict";
import {
  buildImagePrefillPrompt,
  normalizePrefillResult,
  parsePrefillJson,
  sanitizePrefillFields
} from "../src/prefill.js";

const rawJson = "```json\n{\"mode\":\"show\",\"fields\":{\"eventName\":\"演唱会\",\"openAt\":\"2026年7月1日 12点00分\"}}\n```";
assert.equal(parsePrefillJson(rawJson).mode, "show");

const showResult = normalizePrefillResult("rail", {
  mode: "show",
  confidence: 1.5,
  fields: {
    eventName: "  周杰伦演唱会  ",
    city: "上海",
    date: "2026/08/01 19:30",
    openAt: "2026年7月1日 12点",
    viewers: "2人",
    itemId: " 123456 ",
    cookie: "should-not-pass"
  },
  notes: ["详情页截图"]
});

assert.equal(showResult.mode, "show");
assert.equal(showResult.confidence, 1);
assert.deepEqual(showResult.fields, {
  eventName: "周杰伦演唱会",
  city: "上海",
  date: "2026-08-01T19:30",
  openAt: "2026-07-01T12:00",
  itemId: "123456",
  viewers: "2"
});
assert.deepEqual(showResult.notes, ["详情页截图"]);

assert.deepEqual(
  sanitizePrefillFields("rail", {
    from: "北京",
    to: "上海",
    date: "2026.07.01 09:00",
    earliest: "7点",
    latest: "22:30",
    passengers: "1位",
    eventName: "不应写入"
  }),
  {
    from: "北京",
    to: "上海",
    date: "2026-07-01T09:00",
    earliest: "07:00",
    latest: "22:30",
    passengers: "1"
  }
);

const prompt = buildImagePrefillPrompt("show");
assert.ok(prompt.includes("rail:"));
assert.ok(prompt.includes("show:"));
assert.ok(prompt.includes("YYYY-MM-DDTHH:mm"));

console.log("prefill tests passed");
