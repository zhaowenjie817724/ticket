import assert from "node:assert/strict";
import {
  buildExtractionResult,
  extractTicketFields,
  normalizeExtractedFields,
  parseDateTimeInput
} from "../src/extract.js";

assert.equal(parseDateTimeInput("2026年8月1日 19:30"), "2026-08-01T19:30");
assert.equal(parseDateTimeInput("2026-08-01 19:30"), "2026-08-01T19:30");

const railText = `
12306 候补订单
北京南 → 上海虹桥
出行日期 2026-06-20 08:30
时间 08:00-12:00
二等座 一等座
2人
乘车人 张三, 李四
候补截止 2026-06-19 22:00
`;

const rail = extractTicketFields("rail", railText);
assert.equal(rail.from, "北京南");
assert.equal(rail.to, "上海虹桥");
assert.equal(rail.date, "2026-06-20T08:30");
assert.equal(rail.earliest, "08:00");
assert.equal(rail.latest, "12:00");
assert.equal(rail.passengers, "2");
assert.ok(rail.seats.includes("二等座"));
assert.ok(rail.travellers.includes("张三"));
assert.equal(rail.standbyUntil, "2026-06-19T22:00");

const showText = `
大麦
周杰伦演唱会 上海站
演出时间 2026年8月1日 19:30
开售时间 2026年7月1日 12:00
观演人 王五
2人
看台 980元 内场 1280元
https://detail.damai.cn/item.htm?id=123456
`;

const show = extractTicketFields("show", showText);
assert.equal(show.eventName, "周杰伦演唱会 上海站");
assert.equal(show.city, "上海");
assert.equal(show.date, "2026-08-01T19:30");
assert.equal(show.openAt, "2026-07-01T12:00");
assert.equal(show.viewers, "2");
assert.equal(show.viewerNames, "王五");
assert.equal(show.budget, "1280");
assert.equal(show.itemId, "123456");
assert.ok(show.tiers.includes("看台"));
assert.ok(show.tiers.includes("1280元"));

const normalized = normalizeExtractedFields("show", {
  fields: {
    eventName: "演唱会",
    officialUrl: "https://detail.damai.cn/item.htm?id=998877",
    unsafeField: "ignored"
  }
});
assert.deepEqual(normalized, {
  officialUrl: "https://detail.damai.cn/item.htm?id=998877",
  eventName: "演唱会",
  itemId: "998877"
});

const result = buildExtractionResult("rail", railText, "test");
assert.equal(result.source, "test");
assert.ok(result.confidence > 0.4);

console.log("extract tests passed");
