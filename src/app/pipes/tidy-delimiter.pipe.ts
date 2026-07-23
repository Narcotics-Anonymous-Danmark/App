import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'tidyDelimiter'
})
export class TidyDelimiterPipe implements PipeTransform {

  transform(value: string) {
    const regex = /(Bus|Train) Lines#@-@#/gi;
    return value.replace(regex, ' ');
  }

}
