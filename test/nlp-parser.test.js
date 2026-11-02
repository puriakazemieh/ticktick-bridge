import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskNaturalLanguage } from "../src/core/nlp-parser.js";

const TODAY = "2026-11-02"; // Monday

test("parseTaskNaturalLanguage parses Persian dates, times, priority, tags and projects", () => {
  const projects = [{ id: "p1", name: "شخصی" }, { id: "p2", name: "کاری" }];

  // 1. "خرید شیر و نان فردا ساعت ۵ عصر !1 #خرید @شخصی"
  const res1 = parseTaskNaturalLanguage("خرید شیر و نان فردا ساعت ۵ عصر !1 #خرید @شخصی", {
    today: TODAY,
    projects
  });

  assert.equal(res1.title, "خرید شیر و نان");
  assert.equal(res1.targetDay, "2026-11-03"); // Tomorrow
  assert.equal(res1.time, "17:00");
  assert.equal(res1.isAllDay, false);
  assert.equal(res1.priority, 5);
  assert.deepEqual(res1.tags, ["خرید"]);
  assert.equal(res1.projectName, "شخصی");
  assert.equal(res1.projectId, "p1");
  assert.ok(res1.dueDate.startsWith("2026-11-03T17:00:00"));

  // 2. "جلسه بررسی کد پس‌فردا ساعت 10:30 !متوسط #توسعه"
  const res2 = parseTaskNaturalLanguage("جلسه بررسی کد پس‌فردا ساعت 10:30 !متوسط #توسعه", { today: TODAY });
  assert.equal(res2.title, "جلسه بررسی کد");
  assert.equal(res2.targetDay, "2026-11-04"); // Day after tomorrow
  assert.equal(res2.time, "10:30");
  assert.equal(res2.priority, 3);
  assert.deepEqual(res2.tags, ["توسعه"]);

  // 3. "پرداخت قبض امروز !کم"
  const res3 = parseTaskNaturalLanguage("پرداخت قبض امروز !کم", { today: TODAY });
  assert.equal(res3.title, "پرداخت قبض");
  assert.equal(res3.targetDay, "2026-11-02");
  assert.equal(res3.priority, 1);
  assert.equal(res3.isAllDay, true);

  // 4. "بررسی ایمیل‌ها شنبه بعد !بالا"
  const res4 = parseTaskNaturalLanguage("بررسی ایمیل‌ها شنبه بعد !بالا", { today: TODAY });
  assert.equal(res4.title, "بررسی ایمیل‌ها");
  assert.equal(res4.priority, 5);
  assert.notEqual(res4.targetDay, null);
});

test("parseTaskNaturalLanguage parses English phrases accurately", () => {
  // 1. "review pull request tomorrow 5pm !high #dev ~work"
  const res1 = parseTaskNaturalLanguage("review pull request tomorrow 5pm !high #dev ~work", {
    today: TODAY,
    projects: [{ id: "w1", name: "work" }]
  });

  assert.equal(res1.title, "review pull request");
  assert.equal(res1.targetDay, "2026-11-03");
  assert.equal(res1.time, "17:00");
  assert.equal(res1.priority, 5);
  assert.deepEqual(res1.tags, ["dev"]);
  assert.equal(res1.projectName, "work");
  assert.equal(res1.projectId, "w1");

  // 2. "dentist appointment today 9am !2"
  const res2 = parseTaskNaturalLanguage("dentist appointment today 9am !2", { today: TODAY });
  assert.equal(res2.title, "dentist appointment");
  assert.equal(res2.targetDay, "2026-11-02");
  assert.equal(res2.time, "09:00");
  assert.equal(res2.priority, 3);

  // 3. "team retro next friday 14:30"
  const res3 = parseTaskNaturalLanguage("team retro next friday 14:30", { today: TODAY });
  assert.equal(res3.title, "team retro");
  assert.equal(res3.time, "14:30");
  assert.notEqual(res3.targetDay, null);
});

test("parseTaskNaturalLanguage does not misparse numbers in normal titles", () => {
  const res1 = parseTaskNaturalLanguage("گزارش سال 1404 برای مدیر", { today: TODAY });
  assert.equal(res1.title, "گزارش سال 1404 برای مدیر");
  assert.equal(res1.time, null);
  assert.equal(res1.targetDay, null);
  assert.equal(res1.priority, 0);

  const res2 = parseTaskNaturalLanguage("حل تمرین صفحه 25 درس فیزیک 1", { today: TODAY });
  assert.equal(res2.title, "حل تمرین صفحه 25 درس فیزیک 1");
  assert.equal(res2.time, null);
  assert.equal(res2.priority, 0);
});

test("parseTaskNaturalLanguage handles empty or whitespace input", () => {
  const res = parseTaskNaturalLanguage("   ", { today: TODAY });
  assert.equal(res.title, "");
  assert.equal(res.chips.length, 0);
  assert.equal(res.dueDate, null);
});

test("parseTaskNaturalLanguage handles extensive variety of Persian and English inputs", () => {
  const cases = [
    { input: "جلسه با تیم فردا ساعت 9am !h", title: "جلسه با تیم", time: "09:00", priority: 5 },
    { input: "خرید کادو تولد پس فردا !low #شخصی", title: "خرید کادو تولد", priority: 1, tag: "شخصی" },
    { input: "ورزش صبحگاهی چهارشنبه !med", title: "ورزش صبحگاهی", priority: 3 },
    { input: "مطالعه کتاب شنبه بعد ساعت 8 شب !0", title: "مطالعه کتاب", time: "20:00", priority: 0 },
    { input: "پروژه شماره 2 فاز 3", title: "پروژه شماره 2 فاز 3", time: null, priority: 0 },
    { input: "call john today 3pm !med", title: "call john", time: "15:00", priority: 3 },
    { input: "pay bills tomorrow 11:30 #finance ~personal", title: "pay bills", time: "11:30", tag: "finance", project: "personal" },
    { input: "saturday review 10am !high", title: "review", time: "10:00", priority: 5 },
    { input: "prepare presentation next monday !1 #work", title: "prepare presentation", priority: 5, tag: "work" },
    { input: "send contract friday 16:00", title: "send contract", time: "16:00" },
    { input: "بررسی تسک‌های هفتگی یکشنبه ساعت 11", title: "بررسی تسک‌های هفتگی", time: "11:00" }
  ];

  for (const c of cases) {
    const res = parseTaskNaturalLanguage(c.input, { today: TODAY });
    assert.equal(res.title, c.title, `Failed on input: ${c.input}`);
    if (c.time !== undefined) assert.equal(res.time, c.time, `Time failed on: ${c.input}`);
    if (c.priority !== undefined) assert.equal(res.priority, c.priority, `Priority failed on: ${c.input}`);
    if (c.tag) assert.ok(res.tags.includes(c.tag), `Tag failed on: ${c.input}`);
    if (c.project) assert.equal(res.projectName, c.project, `Project failed on: ${c.input}`);
  }
});
