import { Pipe, PipeTransform } from '@angular/core';

//https://github.com/ngx-translate/core/issues/636

@Pipe({
    name: 'translate'
})
export class TranslatePipeMock implements PipeTransform {
    public name = 'translate';

    public transform(query: string, ...args: any[]): any {
        return query;
    }
}