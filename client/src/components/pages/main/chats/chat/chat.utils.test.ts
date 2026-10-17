import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDateDivider,
  getInitials,
  groupMessagesByDate,
  isOnlyEmoji,
} from "./chat.utils.ts";

test("getInitials uses the first and last name", () => {
  assert.equal(getInitials("Ada Lovelace"), "AL");
  assert.equal(getInitials("ada"), "A");
  assert.equal(getInitials("   "), "?");
  assert.equal(getInitials(null), "?");
});

test("isOnlyEmoji accepts a short emoji message and rejects text", () => {
  assert.equal(isOnlyEmoji("👋"), true);
  assert.equal(isOnlyEmoji("hello"), false);
  assert.equal(isOnlyEmoji(""), false);
});

test("formatDateDivider labels today and yesterday", () => {
  assert.equal(formatDateDivider(new Date().toISOString()), "Today");
  const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
  assert.equal(formatDateDivider(yesterday.toISOString()), "Yesterday");
});

test("groupMessagesByDate keeps messages under their calendar day", () => {
  const groups = groupMessagesByDate([
    { id: "1", createdAt: new Date(2026, 9, 17, 8).toISOString() },
    { id: "2", createdAt: new Date(2026, 9, 17, 9).toISOString() },
    { id: "3", createdAt: new Date(2026, 9, 16, 9).toISOString() },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups[0].messages.map((message) => message.id),
    ["1", "2"],
  );
  assert.deepEqual(
    groups[1].messages.map((message) => message.id),
    ["3"],
  );
});
