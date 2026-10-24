import test from "node:test";
import assert from "node:assert/strict";
import { TickTickClient } from "../src/core/ticktick-client.js";

test("recurring completion uses TickTick's dedicated complete endpoint", async () => {
  const calls = [];
  const client = new TickTickClient({ token: "test", transport: async (url, init) => { calls.push({ url, init }); return { status: 204, text: "" }; } });
  await client.completeTask("project-1", "task-1");
  assert.equal(calls[0].url, "https://api.ticktick.com/open/v1/project/project-1/task/task-1/complete");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test");
});

test("single task reads use the official project task endpoint", async () => {
  const calls = [];
  const client = new TickTickClient({ token: "test", transport: async (url, init) => { calls.push({ url, init }); return { status: 200, text: "{}" }; } });
  await client.getTask("project 1", "task 1");
  assert.equal(calls[0].url, "https://api.ticktick.com/open/v1/project/project%201/task/task%201");
});

test("project management uses the documented project endpoints", async () => {
  const calls = [];
  const client = new TickTickClient({ token: "test", transport: async (url, init) => { calls.push({ url, init }); return { status: 200, text: "{}" }; } });
  await client.createProject({ name: "کار" });
  await client.updateProject({ id: "project 1", name: "کار تازه" });
  await client.deleteProject("project 1");
  assert.equal(calls[0].url, "https://api.ticktick.com/open/v1/project");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[1].url, "https://api.ticktick.com/open/v1/project/project%201");
  assert.equal(JSON.parse(calls[1].init.body).id, undefined);
  assert.equal(calls[2].init.method, "DELETE");
});

test("habit check-in uses the official habit endpoint and date stamp", async () => {
  const calls = [];
  const client = new TickTickClient({ token: "test", transport: async (url, init) => { calls.push({ url, init }); return { status: 201, text: "" }; } });
  await client.checkInHabit("habit-1", "2026-10-03", { value: 1, goal: 1, status: 2 });
  assert.equal(calls[0].url, "https://api.ticktick.com/open/v1/habit/habit-1/checkin");
  assert.deepEqual(JSON.parse(calls[0].init.body), { stamp: 20261003, value: 1, goal: 1, status: 2 });
});

test("partial habit check-ins omit a skipped status", async () => {
  const calls = [];
  const client = new TickTickClient({ token: "test", transport: async (url, init) => { calls.push({ url, init }); return { status: 201, text: "" }; } });
  await client.checkInHabit("habit-1", "2026-10-03", { value: 1, goal: 2 });
  assert.deepEqual(JSON.parse(calls[0].init.body), { stamp: 20261003, value: 1, goal: 2 });
});

test("habit check-ins returned with a string stamp are recognized", async () => {
  const client = new TickTickClient({
    token: "test",
    transport: async (url) => {
      if (url.endsWith("/habit")) return { status: 200, text: JSON.stringify([{ id: "habit-1", name: "Read", status: 0 }]) };
      if (url.endsWith("/habit/sections")) return { status: 200, text: "[]" };
      if (url.includes("/habit/checkins?")) return { status: 200, text: JSON.stringify([{ habitId: "habit-1", checkins: [{ stamp: "20261004", value: 1, status: 2 }] }]) };
      throw new Error(`Unexpected URL: ${url}`);
    },
  });
  const habits = await client.habitsForDay("2026-10-04");
  assert.equal(habits[0].checkin.status, 2);
});
