/**
 * Unit Tests for ConversationAnalyzer token accounting
 *
 * Claude Code writes a single assistant message as several JSONL records — one
 * per content block (thinking / text / tool_use) — and every record repeats the
 * same `message.id` and an identical `usage` object. Token totals must count
 * each message once, not once per record.
 */

const ConversationAnalyzer = require('../../src/analytics/core/ConversationAnalyzer');

/** One parsed message as produced by parseAndCorrelateToolMessages(). */
const record = (id, usage, extra = {}) => ({
  id,
  role: 'assistant',
  usage,
  ...extra,
});

const usage = (input, output, cacheCreation = 0, cacheRead = 0) => ({
  input_tokens: input,
  output_tokens: output,
  cache_creation_input_tokens: cacheCreation,
  cache_read_input_tokens: cacheRead,
});

describe('ConversationAnalyzer.calculateRealTokenUsage', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ConversationAnalyzer('/tmp/does-not-need-to-exist');
  });

  it('counts a message split across content blocks only once', () => {
    // One assistant message emitted as three records, as Claude Code does for
    // thinking + text + tool_use. Every record repeats the same usage object.
    const u = usage(10, 100, 1000, 5000);
    const result = analyzer.calculateRealTokenUsage([
      record('msg_01AAA', u),
      record('msg_01AAA', u),
      record('msg_01AAA', u),
    ]);

    expect(result.messagesWithUsage).toBe(1);
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(100);
    expect(result.cacheCreationTokens).toBe(1000);
    expect(result.cacheReadTokens).toBe(5000);
    expect(result.total).toBe(110);
  });

  it('sums distinct messages', () => {
    const result = analyzer.calculateRealTokenUsage([
      record('msg_01AAA', usage(10, 100)),
      record('msg_01AAA', usage(10, 100)),
      record('msg_01BBB', usage(5, 50)),
    ]);

    expect(result.messagesWithUsage).toBe(2);
    expect(result.inputTokens).toBe(15);
    expect(result.outputTokens).toBe(150);
  });

  it('ignores records without usage but still reports totalMessages', () => {
    const result = analyzer.calculateRealTokenUsage([
      record('msg_01AAA', usage(10, 100)),
      { id: 'msg_01BBB', role: 'user', usage: null },
      { id: null, role: 'user', usage: undefined },
    ]);

    expect(result.messagesWithUsage).toBe(1);
    expect(result.totalMessages).toBe(3);
    expect(result.outputTokens).toBe(100);
  });

  it('does not merge distinct records that carry no message id', () => {
    // Falls back to uuid, then to positional identity — never collapses
    // unrelated records into one another.
    const result = analyzer.calculateRealTokenUsage([
      record(null, usage(1, 10), { uuid: 'uuid-1' }),
      record(null, usage(2, 20), { uuid: 'uuid-2' }),
      record(null, usage(3, 30)),
      record(null, usage(4, 40)),
    ]);

    expect(result.messagesWithUsage).toBe(4);
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(100);
  });

  it('does not merge an id with an unrelated record that reuses it as a uuid', () => {
    // `id` and `uuid` are separate namespaces: ConversationAnalyzer.js sets
    // `id: item.message.id || item.uuid`, so the same string can legitimately
    // reach this function through either field on two different records. They
    // must stay distinct, otherwise the conversation is undercounted.
    const result = analyzer.calculateRealTokenUsage([
      record('shared-identifier', usage(1, 10)),
      record(null, usage(2, 20), { uuid: 'shared-identifier' }),
    ]);

    expect(result.messagesWithUsage).toBe(2);
    expect(result.inputTokens).toBe(3);
    expect(result.outputTokens).toBe(30);
  });

  it('does not merge an id that looks like a generated positional key', () => {
    const result = analyzer.calculateRealTokenUsage([
      record('idx:1', usage(1, 10)),
      record(null, usage(2, 20)),
    ]);

    expect(result.messagesWithUsage).toBe(2);
    expect(result.outputTokens).toBe(30);
  });

  it('keeps the last usage seen for a repeated message id', () => {
    const result = analyzer.calculateRealTokenUsage([
      record('msg_01AAA', usage(10, 100)),
      record('msg_01AAA', usage(10, 250)),
    ]);

    expect(result.messagesWithUsage).toBe(1);
    expect(result.outputTokens).toBe(250);
  });

  it('returns zeroes for an empty conversation', () => {
    const result = analyzer.calculateRealTokenUsage([]);

    expect(result.messagesWithUsage).toBe(0);
    expect(result.totalMessages).toBe(0);
    expect(result.total).toBe(0);
  });
});
