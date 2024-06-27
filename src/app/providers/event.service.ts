import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class EventService {
    data: any;

    constructor(private http: HttpClient) { }

    load(): any {
        if (this.data) {
            return of(this.data);
        } else {
            return this.http
                .get('https://www.nadanmark.dk/wp-json/wp/v2/calendar?category-slug=bedringsarrangement', {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Basic " + btoa("username:password")
                    }
                })
                .pipe(map(this.processData, this));
        }
    }

    processData(data: any) {
        this.data = data;
        return this.data;
    }
}
