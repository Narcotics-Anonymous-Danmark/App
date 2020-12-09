import { NoSanitizePipe } from './no-sanitize.pipe';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';

describe('NoSanitizePipe', () => {
    let domSanitizer: DomSanitizer;

    it('create an instance', () => {
        const pipe = new NoSanitizePipe(domSanitizer);
        expect(pipe).toBeTruthy();
    });
});
