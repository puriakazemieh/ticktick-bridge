/**
 * @file editor-suggest-matcher.test.js
 * Unit tests for EditorSuggest trigger detection, fuzzy matching, and link formatting.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSuggestQuery,
  searchTasksForSuggest,
  formatTaskMarkdownLink
} from '../src/core/editor-suggest-matcher.js';

test('extractSuggestQuery detects triggers [[tt:, @task:, #tt:', () => {
  // Simple trigger at start of line
  const res1 = extractSuggestQuery('[[tt:طراحی وب', 13);
  assert.notEqual(res1, null);
  assert.equal(res1?.query, 'طراحی وب');
  assert.equal(res1?.trigger, '[[tt:');
  assert.equal(res1?.startCh, 0);
  assert.equal(res1?.endCh, 13);

  // Trigger mid-sentence
  const line2 = 'در جلسه امروز در مورد @task:report صحبت شد.';
  const res2 = extractSuggestQuery(line2, line2.indexOf('report') + 'report'.length);
  assert.notEqual(res2, null);
  assert.equal(res2?.query, 'report');
  assert.equal(res2?.trigger, '@task:');
  assert.equal(res2?.startCh, line2.indexOf('@task:'));

  // Trigger with #tt:
  const line3 = 'بررسی وضعیت #tt:باگ';
  const res3 = extractSuggestQuery(line3, line3.length);
  assert.notEqual(res3, null);
  assert.equal(res3?.query, 'باگ');
  assert.equal(res3?.trigger, '#tt:');

  // Already closed trigger should NOT match
  const line4 = 'تسک [[tt:انجام شد]] و تمام.';
  const res4 = extractSuggestQuery(line4, line4.length);
  assert.equal(res4, null);
});

test('searchTasksForSuggest ranks prefix matches and normalizes Persian text', () => {
  const tasks = [
    { id: '1', title: 'طراحی رابط کاربری', priority: 3, status: 0 },
    { id: '2', title: 'جلسه بازبینی طراحی سیستم', priority: 5, status: 0 },
    { id: '3', title: 'ارسال گزارش', priority: 1, status: 0, tags: ['طراحی'] },
    { id: '4', title: 'طراحی دیتابیس', priority: 5, status: 0 },
    { id: '5', title: 'تسک انجام شده طراحی', priority: 5, status: 2 }
  ];

  // Arabic Yeh/Kaf in query should match Persian text
  const results = searchTasksForSuggest(tasks, 'طراحي'); // Arabic Yeh 'ي'
  
  // Task 5 is completed, must be excluded
  assert.equal(results.some(t => t.id === '5'), false);

  // Tasks 1 and 4 start with 'طراحی' (prefix match), but task 4 has priority 5 > task 1 priority 3
  assert.equal(results[0].id, '4');
  assert.equal(results[1].id, '1');
  // Task 2 includes 'طراحی' inside title
  assert.equal(results[2].id, '2');
  // Task 3 matches via tag
  assert.equal(results[3].id, '3');
});

test('formatTaskMarkdownLink generates clean markdown links', () => {
  const task = { id: 't-12345', title: 'جلسه برنامه‌ریزی [مهم]' };

  const obsLink = formatTaskMarkdownLink(task);
  assert.equal(obsLink, '[🎯 جلسه برنامه‌ریزی مهم](obsidian://ticktick-bridge?taskId=t-12345)');

  const ttLink = formatTaskMarkdownLink(task, { protocol: 'ticktick' });
  assert.equal(ttLink, '[🎯 جلسه برنامه‌ریزی مهم](ticktick://task/t-12345)');
});
