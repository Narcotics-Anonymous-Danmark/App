import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({
    name: 'noSanitize'
})
export class NoSanitizePipe implements PipeTransform {
    constructor(private domSanitizer: DomSanitizer) {

    }
    transform(value: any, type: string): SafeHtml | SafeResourceUrl {
        switch (type) {
            case 'html':
                return this.domSanitizer.bypassSecurityTrustHtml(value);
            case 'resourceurl':
                return this.domSanitizer.bypassSecurityTrustResourceUrl(value);
            default: throw new Error(`Invalid safe type specified: ${type}`);
        }
    }
}
