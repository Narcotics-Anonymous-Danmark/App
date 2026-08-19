import { TidyDelimiterPipe } from 'src/app/pipes/tidy-delimiter.pipe';

describe('TidyDelimiterPipe', () => {
  let pipe: TidyDelimiterPipe;

  beforeEach(() => {
    pipe = new TidyDelimiterPipe();
  });

  it('replaces the BMLT "Bus Lines" delimiter with a single space', () => {
    expect(pipe.transform('Bus Lines#@-@#Route 5')).toBe(' Route 5');
  });

  it('replaces the BMLT "Train Lines" delimiter with a single space', () => {
    expect(pipe.transform('Train Lines#@-@#S-tog')).toBe(' S-tog');
  });

  it('matches the delimiter regardless of case', () => {
    expect(pipe.transform('bus lines#@-@#x')).toBe(' x');
    expect(pipe.transform('TRAIN LINES#@-@#y')).toBe(' y');
  });

  it('replaces every occurrence, not just the first', () => {
    expect(pipe.transform('Bus Lines#@-@#aTrain Lines#@-@#b')).toBe(' a b');
  });

  it('leaves text without the delimiter untouched', () => {
    expect(pipe.transform('Nørrebro, København')).toBe('Nørrebro, København');
  });

  it('leaves a bare "Bus Lines" without the marker untouched', () => {
    expect(pipe.transform('Bus Lines 5 and 8')).toBe('Bus Lines 5 and 8');
  });

  it('returns an empty string unchanged', () => {
    expect(pipe.transform('')).toBe('');
  });
});
