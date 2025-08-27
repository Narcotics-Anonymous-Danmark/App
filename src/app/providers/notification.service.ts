import { Injectable } from '@angular/core';
import { CleantimeService } from 'src/app/providers/cleantime.service';

declare var cordova: any;

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(
    private cleantime: CleantimeService
  ) { }

  async ensureCleandayNotifications() {
    if(!cordova.plugins.notification) return;
    cordova.plugins.notification.local.cancelAll();
    let profiles = await this.cleantime.getProfiles();
    let id = 0;
    let notifications = [];
    for (const profile of profiles) {
      let cleanDay = this.cleantime.getProfileCleanDay(profile);
      let nextAnniversaries = this.cleantime.getNextAnniversaries(cleanDay, {years: 2});
      for (const anniversary of nextAnniversaries) {
        let anniversaryText = await this.cleantime.getAnniversaryString(anniversary);
        let date = anniversary.date.setHours(10);
        notifications.push({
          id: ++id,
          title: 'Mærkedag - ' + profile.name,
          text: 'Tillyke med ' + anniversaryText,
          trigger: { at: date }
        });
      };
      cordova.plugins.notification.local.schedule(notifications);
    }
  }

}
