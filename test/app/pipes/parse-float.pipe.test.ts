import { ParseFloatPipe } from 'src/app/pipes/parse-float.pipe';

describe('ParseFloatPipe', () => {
  let pipe: ParseFloatPipe;

  beforeEach(() => {
    pipe = new ParseFloatPipe();
  });

  it('parses a decimal string', () => {
    expect(pipe.transform('55.6761')).toBe(55.6761);
  });

  it('parses a negative decimal string', () => {
    expect(pipe.transform('-12.5')).toBe(-12.5);
  });

  it('parses an integer string', () => {
    expect(pipe.transform('12')).toBe(12);
  });

  it('stops at the first non-numeric character', () => {
    expect(pipe.transform('12.5abc')).toBe(12.5);
  });

  it('returns NaN for a non-numeric string', () => {
    expect(pipe.transform('abc')).toBeNaN();
  });

  it('returns NaN for an empty string', () => {
    expect(pipe.transform('')).toBeNaN();
  });
});
