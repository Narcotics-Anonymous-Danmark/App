import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class HowAndWhyService {
    data: any;

    constructor(private http: HttpClient) { }

    load(): any {
        if (this.data) {
            return of(this.data);
        } else {
            return this.http
                .get('assets/data/how-and-why.json')
                .pipe(map(this.processData, this));
        }
    }

    processData(data: any) {
        this.data = data;
        return this.data;
    }
}
