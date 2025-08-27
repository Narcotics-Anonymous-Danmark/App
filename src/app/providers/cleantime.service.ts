import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import 'moment-timezone';

@Injectable({
  providedIn: 'root'
})
export class CleantimeService {

  constructor(
    private storage: Storage,
    private translate: TranslateService
  ) { }

  async getProfiles() {
    let profiles = [];
    await this.storage.ready().then(async () => {
      await this.storage.get('cleanDateProfiles').then(value => {
        if(value)
        {
          profiles = value;
        }
      });
    });
    return profiles;
  }

  async getCleanDay(profileId){
    let profiles = await this.getProfiles();
    return this.getProfileCleanDay(profiles[parseInt(profileId)]);
  }

  getProfileCleanDay(profile){
    return profile.cleandate;
  }

  getCleanTimes(cleanDay){
    let todayMoment = moment(moment().format("YYYY-MM-DD"), "YYYY-MM-DD").tz(moment.tz.guess());
    let cleanDayMoment = moment(cleanDay);
    let cleanTimeInDays = Math.floor(todayMoment.diff(cleanDayMoment, 'days', true));
    let cleanTimeInMonthsPrecise = todayMoment.diff(cleanDayMoment, 'months', true);
    let cleanTimeInYearsPrecise = todayMoment.diff(cleanDayMoment, 'years', true);
    let cleanTimeInYears = Math.floor(cleanTimeInYearsPrecise);
    return [cleanTimeInDays, cleanTimeInMonthsPrecise, cleanTimeInYearsPrecise, cleanTimeInYears];
  }

  getCleanYearsMonthsDays(cleanDay, fromDate = new Date){
    let fromDateMoment = moment(moment(fromDate).format("YYYY-MM-DD"), "YYYY-MM-DD").tz(moment.tz.guess());
    let viewDate = moment(cleanDay);
    const cleanTimeInYears = Math.floor(fromDateMoment.diff(viewDate, 'years', true));
    viewDate.add(cleanTimeInYears, "years");
    const cleanTimeInMonths = Math.floor(fromDateMoment.diff(viewDate, 'months', true));
    viewDate.add(cleanTimeInMonths, "months");
    const cleanTimeInDays = Math.floor(fromDateMoment.diff(viewDate, 'days', true));
    return [cleanTimeInYears, cleanTimeInMonths, cleanTimeInDays];
  }

  getCleanMonthsDays(cleanDay, fromDate = new Date){
    let fromDateMoment = moment(moment(fromDate).format("YYYY-MM-DD"), "YYYY-MM-DD").tz(moment.tz.guess());
    let viewDate = moment(cleanDay);
    const cleanTimeInMonths = Math.floor(fromDateMoment.diff(viewDate, 'months', true));
    viewDate.add(cleanTimeInMonths, "months");
    const cleanTimeInDays = Math.floor(fromDateMoment.diff(viewDate, 'days', true));
    return [cleanTimeInMonths, cleanTimeInDays];
  }

  getAnniversaryDefinitions(){
    return {
        "1-day": {
            "cleanTimeInDays": 1,
            "nextDateArg": [1, 0, 0],
            "tagTime": 1,
            "tag": "DAYCLEAN",
        },
        "30-days": {
            "cleanTimeInDays": 30,
            "nextDateArg": [30, 0, 0],
            "tagTime": 30,
            "tag": "DAYSCLEAN"
        },
        "60-days": {
            "cleanTimeInDays": 60,
            "nextDateArg": [60, 0, 0],
            "tagTime": 60,
            "tag": "DAYSCLEAN"
        },
        "90-days": {
            "cleanTimeInDays": 90,
            "nextDateArg": [90, 0, 0],
            "tagTime": 90,
            "tag": "DAYSCLEAN"
        },
        "6-months": {
            "cleanTimeInMonthsPrecise": 6,
            "nextDateArg": [0, 6, 0],
            "tagTime": 6,
            "tag": "MONTHSCLEAN"
        },
        "9-months": {
            "cleanTimeInMonthsPrecise": 9,
            "nextDateArg": [0, 9, 0],
            "tagTime": 9,
            "tag": "MONTHSCLEAN"
        },
        "1-year": {
            "cleanTimeInYearsPrecise": 1,
            "nextDateArg": [0, 0, 1],
            "tagTime": 1,
            "tag": "YEARCLEAN"
        },
        "18-months": {
            "cleanTimeInMonthsPrecise": 18,
            "nextDateArg": [0, 18, 0],
            "tagTime": 18,
            "tag": "MONTHSCLEAN"
        },
        "x-years": {
            "cleanTimeInYearsPrecise": (value, cleanTimes) => {
                let [,,,cleanTimeInYears] = cleanTimes;
                return value === cleanTimeInYears;
            },
            "cleanTimeInYears": value => value > 1,
            "nextDateArg": years => [0, 0, years],
            "tagTime": cleanTimes => {
              let [,,,cleanTimeInYears] = cleanTimes;
              return cleanTimeInYears;
            },
            "tag": "YEARSCLEAN"
        },
    };
  }

  getAnniversaries(){
    let anniversariesDef = this.getAnniversaryDefinitions();
    return [
        anniversariesDef["1-day"],
        anniversariesDef["30-days"],
        anniversariesDef["60-days"],
        anniversariesDef["90-days"],
        anniversariesDef["6-months"],
        anniversariesDef["9-months"],
        anniversariesDef["1-year"],
        anniversariesDef["18-months"],
        anniversariesDef["x-years"]
    ];
  }

  getNextAnniversaries(cleanDay, duration){
    let nextAnniversaries = [];
    let todayMoment = moment(moment().format("YYYY-MM-DD"), "YYYY-MM-DD").tz(moment.tz.guess());
    let maxDateMoment = moment(todayMoment); // clone
    maxDateMoment.add(duration);
    let anniversariesDef = this.getAnniversaryDefinitions();
    Object.keys(anniversariesDef).forEach(key => {
      let anniversaryDef = anniversariesDef[key];
      let anniversaryDate = moment(cleanDay);
      let nextDateArg = anniversaryDef["nextDateArg"];
      if(Array.isArray(nextDateArg))
      {
        let [days, months, years] = nextDateArg;
        anniversaryDate.add(days, "days");
        anniversaryDate.add(months, "months");
        anniversaryDate.add(years, "years");
        if(anniversaryDate >= todayMoment && anniversaryDate <= maxDateMoment){
          nextAnniversaries.push({
            name: key,
            date: anniversaryDate.toDate(),
            tagTime: anniversaryDef.tagTime
          });
        }
      } else if(typeof nextDateArg === "function"){
        const func: Function = nextDateArg;
        let iterations = 0;
        do {
          anniversaryDate = moment(cleanDay);
          ++iterations;
          let [days, months, years] = nextDateArg(iterations);
          anniversaryDate.add(days, "days");
          anniversaryDate.add(months, "months");
          anniversaryDate.add(years, "years");
          if(anniversaryDate >= todayMoment && anniversaryDate <= maxDateMoment){
            if(nextAnniversaries.filter(anniversary => anniversary.date.getTime() === anniversaryDate.toDate().getTime()).length === 0)
            {
              nextAnniversaries.push({
                name: key,
                date: anniversaryDate.toDate(),
                tagTime: years
              });
            }
          }
        } while(anniversaryDate <= maxDateMoment);
      }
    });
    return nextAnniversaries;
  }

  async getAnniversaryString(anniversary){
    let anniversariesDefs = this.getAnniversaryDefinitions();
    let anniversariesDef = anniversariesDefs[anniversary.name];
    let anniversaryTagText = await this.translate.get(anniversariesDef["tag"]).toPromise();
    return anniversary.tagTime + " " + anniversaryTagText;
  }
}
