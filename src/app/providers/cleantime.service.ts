import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import * as moment from 'moment';
import 'moment-timezone';

@Injectable({
  providedIn: 'root'
})
export class CleantimeService {

  constructor(private storage: Storage) { }

  async getProfiles() {
    let profiles = [];
    await this.storage.ready().then(async () => {
      await this.storage.get('cleanDateProfiles').then(value => {
        profiles = value;
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
}
