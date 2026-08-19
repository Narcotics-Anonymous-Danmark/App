import { DomSanitizer } from '@angular/platform-browser';
import { NoSanitizePipe } from 'src/app/pipes/no-sanitize.pipe';

describe('NoSanitizePipe', () => {
  let sanitizer: { bypassSecurityTrustHtml: jest.Mock; bypassSecurityTrustResourceUrl: jest.Mock };
  let pipe: NoSanitizePipe;

  beforeEach(() => {
    sanitizer = {
      bypassSecurityTrustHtml: jest.fn().mockReturnValue('trusted-html'),
      bypassSecurityTrustResourceUrl: jest.fn().mockReturnValue('trusted-url'),
    };
    pipe = new NoSanitizePipe(sanitizer as unknown as DomSanitizer);
  });

  it('bypasses sanitisation for html', () => {
    expect(pipe.transform('<b>hi</b>', 'html')).toBe('trusted-html');
    expect(sanitizer.bypassSecurityTrustHtml).toHaveBeenCalledWith('<b>hi</b>');
    expect(sanitizer.bypassSecurityTrustResourceUrl).not.toHaveBeenCalled();
  });

  it('bypasses sanitisation for a resource url', () => {
    expect(pipe.transform('https://nadanmark.dk/x.pdf', 'resourceurl')).toBe('trusted-url');
    expect(sanitizer.bypassSecurityTrustResourceUrl).toHaveBeenCalledWith('https://nadanmark.dk/x.pdf');
    expect(sanitizer.bypassSecurityTrustHtml).not.toHaveBeenCalled();
  });

  it('throws on an unsupported type', () => {
    expect(() => pipe.transform('x', 'javascript')).toThrowError('Invalid safe type specified: javascript');
  });

  it('does not trust anything when the type is unsupported', () => {
    expect(() => pipe.transform('x', '')).toThrow();
    expect(sanitizer.bypassSecurityTrustHtml).not.toHaveBeenCalled();
    expect(sanitizer.bypassSecurityTrustResourceUrl).not.toHaveBeenCalled();
  });
});
