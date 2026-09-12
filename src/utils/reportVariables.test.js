import { describe, it, expect } from 'vitest';
import { detectCustomVariables, BUILTIN_VARS } from './reportVariables';

describe('detectCustomVariables', () => {
  it('finds a Mustache triple-brace variable', () => {
    expect(detectCustomVariables('WHERE uuid = {{{queue_uuid}}}')).toEqual(['queue_uuid']);
  });

  it('finds a double-brace variable', () => {
    expect(detectCustomVariables('WHERE uuid = {{queue_uuid}}')).toEqual(['queue_uuid']);
  });

  // The regression this guards: the regex used to require 2-3 braces, so a
  // Blazer-style variable produced NO input and the query rendered it empty.
  it('finds a Blazer single-brace variable', () => {
    expect(detectCustomVariables('SELECT * FROM users WHERE gender = {gender}')).toEqual(['gender']);
  });

  it('finds variables across both syntaxes in one statement', () => {
    const sql = 'SELECT * FROM calls WHERE env IN ({{{environment_uuids}}}) AND dir = {direction}';
    expect(detectCustomVariables(sql)).toEqual(['direction']); // environment_uuids is built-in
  });

  it('excludes built-ins the backend auto-fills', () => {
    const sql = BUILTIN_VARS.map((v) => `{{{${v}}}}`).join(' ');
    expect(detectCustomVariables(sql)).toEqual([]);
  });

  it('excludes the Blazer time range, which is also auto-filled', () => {
    expect(detectCustomVariables('rated_at >= {start_time} AND rated_at <= {end_time}')).toEqual([]);
  });

  it('deduplicates a variable used more than once', () => {
    expect(detectCustomVariables('a = {x} OR b = {x} OR c = {{{x}}}')).toEqual(['x']);
  });

  it('is stable across repeated calls (no shared regex lastIndex)', () => {
    const sql = 'WHERE gender = {gender}';
    expect(detectCustomVariables(sql)).toEqual(['gender']);
    expect(detectCustomVariables(sql)).toEqual(['gender']);
    expect(detectCustomVariables(sql)).toEqual(['gender']);
  });

  it('returns nothing for an empty or missing statement', () => {
    expect(detectCustomVariables('')).toEqual([]);
    expect(detectCustomVariables(null)).toEqual([]);
    expect(detectCustomVariables(undefined)).toEqual([]);
  });

  it('ignores braces that are not identifiers', () => {
    expect(detectCustomVariables("SELECT '{}'::jsonb")).toEqual([]);
    expect(detectCustomVariables("SELECT '{1,2}'::int[]")).toEqual([]);
  });
});
