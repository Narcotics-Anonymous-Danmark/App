import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import * as moment from 'moment';

@Injectable({
    providedIn: 'root'
})
export class JftService {
    data: any;

    constructor(private http: HttpClient) { }

    async getTodayJft(): Promise<any> {
        const data = await this.load().toPromise();
        let monthMap = {"01": "januar", "02": "februar", "03": "marts", "04": "april", "05": "maj", "06": "juni", "07": "juli", "08": "august", "09": "september", "10": "oktober", "11": "november", "12": "december"};
        let todayMoment = moment();
        let todayDay = todayMoment.format("D");
        let todayMonth = monthMap[todayMoment.format("MM")];
        let todayJft = data.filter(datum => datum.day === todayDay && datum.month === todayMonth)[0];
        return todayJft;
    }

    load(): any {
        if (this.data) {
            return of(this.data);
        } else {
            return this.http
                .get('assets/data/jft.json')
                .pipe(map(this.processData, this));
        }
    }

    processData(data: any) {
        this.data = data;
        return this.data;
    }
}
