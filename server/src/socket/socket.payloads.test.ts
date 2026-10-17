import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCallSignal,
  parseEditMessage,
  parseReaction,
  parseSendMessage,
} from "./socket.payloads.ts";

test("parseSendMessage accepts a text message and fills defaults", () => {
  assert.deepEqual(
    parseSendMessage({ conversationId: "c1", content: "hello" }),
    {
      conversationId: "c1",
      content: "hello",
      type: "TEXT",
      mediaUrls: [],
    },
  );
});

test("parseSendMessage rejects incomplete payloads", () => {
  assert.equal(parseSendMessage(null), null);
  assert.equal(parseSendMessage({ content: "hello" }), null);
  assert.equal(parseSendMessage({ conversationId: "c1" }), null);
});

test("parseEditMessage requires an id, conversation, and content", () => {
  assert.deepEqual(
    parseEditMessage({
      messageId: "m1",
      conversationId: "c1",
      newContent: "updated",
    }),
    { messageId: "m1", conversationId: "c1", newContent: "updated" },
  );
  assert.equal(
    parseEditMessage({ messageId: "m1", conversationId: "c1" }),
    null,
  );
});

test("parseReaction requires a non-empty emoji", () => {
  assert.equal(
    parseReaction({ messageId: "m1", conversationId: "c1", emoji: "  " }),
    null,
  );
  assert.deepEqual(
    parseReaction({ messageId: "m1", conversationId: "c1", emoji: "👍" }),
    { messageId: "m1", conversationId: "c1", emoji: "👍" },
  );
});

test("parseCallSignal requires a conversation and a target user", () => {
  assert.equal(parseCallSignal({ conversationId: "c1", offer: {} }), null);
  assert.equal(parseCallSignal({ conversationId: "c1", to: "u2" })?.to, "u2");
});
