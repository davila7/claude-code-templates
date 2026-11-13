import { describe, expect, test } from 'claude-code/testing';
import { readCompactRequest } from '../hooks/compact-request.ts';

describe('the compact tag', () => {
  test('counts when it ends the answer', () => {
    expect(readCompactRequest('The tests pass.\n<smartcompact>Write the docs.</smartcompact>')).toEqual({
      next: 'Write the docs.',
    });
  });

  test('may be followed by whitespace', () => {
    expect(readCompactRequest('Done.\n<smartcompact>Go on.</smartcompact>\n\n  ')).toEqual({ next: 'Go on.' });
  });

  test('has its text trimmed and keeps the lines inside it', () => {
    expect(readCompactRequest('<smartcompact>\n  Line one.\nLine two.\n</smartcompact>')).toEqual({
      next: 'Line one.\nLine two.',
    });
  });

  test('is missing when it is empty', () => {
    expect(readCompactRequest('Done.\n<smartcompact></smartcompact>')).toBeNull();
  });

  test('is missing when it holds only whitespace', () => {
    expect(readCompactRequest('Done.\n<smartcompact>  \n\n </smartcompact>')).toBeNull();
  });

  test('earlier in the text asks nothing', () => {
    expect(readCompactRequest('End with <smartcompact>x</smartcompact> to ask.\nMore text.')).toBeNull();
  });

  test('of two, only the last one counts when it ends the answer', () => {
    expect(readCompactRequest('<smartcompact>first</smartcompact> then <smartcompact>second</smartcompact>')).toEqual({
      next: 'second',
    });
  });

  test('of two, none counts when the last one does not end the answer', () => {
    expect(readCompactRequest('<smartcompact>a</smartcompact>\n<smartcompact>b</smartcompact>\nBye.')).toBeNull();
  });

  test('is missing in a plain answer', () => {
    expect(readCompactRequest('Done. Shall I push?')).toBeNull();
  });

  test('is missing when only the closing tag is there', () => {
    expect(readCompactRequest('Done.</smartcompact>')).toBeNull();
  });
});
