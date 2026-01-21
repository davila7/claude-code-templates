/**
 * JSON Utilities Test Suite
 */

const {
  safeJsonParse,
  safeJsonStringify,
  parseJsonl,
  deepClone,
  isValidJson,
  getNestedValue,
  setNestedValue
} = require('../../src/utils/json-utils');

describe('JSON Utils', () => {
  describe('safeJsonParse', () => {
    it('should parse valid JSON correctly', () => {
      const result = safeJsonParse('{"name": "test", "value": 123}');
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should return default value for invalid JSON', () => {
      const result = safeJsonParse('invalid json', { defaultValue: {}, silent: true });
      expect(result).toEqual({});
    });

    it('should return null by default for invalid JSON', () => {
      const result = safeJsonParse('invalid json', { silent: true });
      expect(result).toBeNull();
    });

    it('should handle null input', () => {
      const result = safeJsonParse(null, { silent: true });
      expect(result).toBeNull();
    });

    it('should handle undefined input', () => {
      const result = safeJsonParse(undefined, { silent: true });
      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      const result = safeJsonParse('', { silent: true });
      expect(result).toBeNull();
    });

    it('should parse arrays correctly', () => {
      const result = safeJsonParse('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should parse nested objects', () => {
      const result = safeJsonParse('{"outer": {"inner": "value"}}');
      expect(result).toEqual({ outer: { inner: 'value' } });
    });
  });

  describe('safeJsonStringify', () => {
    it('should stringify objects correctly', () => {
      const result = safeJsonStringify({ name: 'test' }, { spaces: 0 });
      expect(result).toBe('{"name":"test"}');
    });

    it('should handle circular references gracefully', () => {
      const obj = {};
      obj.self = obj;
      const result = safeJsonStringify(obj, { silent: true });
      expect(result).toBeNull();
    });

    it('should respect spaces option', () => {
      const result = safeJsonStringify({ a: 1 }, { spaces: 2 });
      expect(result).toBe('{\n  "a": 1\n}');
    });

    it('should handle null value', () => {
      const result = safeJsonStringify(null);
      expect(result).toBe('null');
    });
  });

  describe('parseJsonl', () => {
    it('should parse valid JSONL content', () => {
      const content = '{"a": 1}\n{"b": 2}\n{"c": 3}';
      const result = parseJsonl(content, { silent: true });
      expect(result).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    });

    it('should skip invalid lines by default', () => {
      const content = '{"a": 1}\ninvalid\n{"c": 3}';
      const result = parseJsonl(content, { silent: true });
      expect(result).toEqual([{ a: 1 }, { c: 3 }]);
    });

    it('should throw on invalid lines when skipInvalid is false', () => {
      const content = '{"a": 1}\ninvalid\n{"c": 3}';
      expect(() => parseJsonl(content, { skipInvalid: false })).toThrow();
    });

    it('should handle empty content', () => {
      const result = parseJsonl('', { silent: true });
      expect(result).toEqual([]);
    });

    it('should handle content with blank lines', () => {
      const content = '{"a": 1}\n\n{"b": 2}\n  \n{"c": 3}';
      const result = parseJsonl(content, { silent: true });
      expect(result).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
    });
  });

  describe('deepClone', () => {
    it('should clone objects', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });

    it('should clone arrays', () => {
      const original = [1, 2, [3, 4]];
      const cloned = deepClone(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[2]).not.toBe(original[2]);
    });

    it('should handle null', () => {
      expect(deepClone(null)).toBeNull();
    });

    it('should handle undefined', () => {
      expect(deepClone(undefined)).toBeUndefined();
    });
  });

  describe('isValidJson', () => {
    it('should return true for valid JSON object', () => {
      expect(isValidJson('{"a": 1}')).toBe(true);
    });

    it('should return true for valid JSON array', () => {
      expect(isValidJson('[1, 2, 3]')).toBe(true);
    });

    it('should return true for valid JSON string', () => {
      expect(isValidJson('"hello"')).toBe(true);
    });

    it('should return true for valid JSON number', () => {
      expect(isValidJson('123')).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      expect(isValidJson('invalid')).toBe(false);
    });

    it('should return false for null input', () => {
      expect(isValidJson(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(isValidJson(undefined)).toBe(false);
    });
  });

  describe('getNestedValue', () => {
    const testObj = {
      a: {
        b: {
          c: 'value'
        },
        arr: [1, 2, 3]
      },
      simple: 'test'
    };

    it('should get nested values', () => {
      expect(getNestedValue(testObj, 'a.b.c')).toBe('value');
    });

    it('should get simple values', () => {
      expect(getNestedValue(testObj, 'simple')).toBe('test');
    });

    it('should return default for missing paths', () => {
      expect(getNestedValue(testObj, 'a.b.missing', 'default')).toBe('default');
    });

    it('should return undefined by default for missing paths', () => {
      expect(getNestedValue(testObj, 'a.b.missing')).toBeUndefined();
    });

    it('should handle null object', () => {
      expect(getNestedValue(null, 'a.b', 'default')).toBe('default');
    });
  });

  describe('setNestedValue', () => {
    it('should set nested values', () => {
      const obj = {};
      setNestedValue(obj, 'a.b.c', 'value');
      expect(obj).toEqual({ a: { b: { c: 'value' } } });
    });

    it('should overwrite existing values', () => {
      const obj = { a: { b: 'old' } };
      setNestedValue(obj, 'a.b', 'new');
      expect(obj.a.b).toBe('new');
    });

    it('should create intermediate objects', () => {
      const obj = { x: 1 };
      setNestedValue(obj, 'a.b.c', 'value');
      expect(obj).toEqual({ x: 1, a: { b: { c: 'value' } } });
    });

    it('should handle null object', () => {
      const result = setNestedValue(null, 'a.b', 'value');
      expect(result).toBeNull();
    });
  });
});
