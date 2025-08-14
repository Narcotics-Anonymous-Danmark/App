import { Injectable } from '@angular/core';
import { CleantimeService } from 'src/app/providers/cleantime.service';
import { TranslateService } from '@ngx-translate/core';

declare var cordova: any;

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(
    private cleantime: CleantimeService,
    private translate: TranslateService
  ) { }

  async ensureCleandayNotifications() {
    cordova.plugins.notification.local.cancelAll();
    let profiles = await this.cleantime.getProfiles();
    let id = 0;
    for (const profile of profiles) {
      let cleanDay = this.cleantime.getProfileCleanDay(profile);
      let nextAnniversaries = this.cleantime.getNextAnniversaries(cleanDay, {years: 2});
      for (const anniversary of nextAnniversaries) {
        let anniversaryText = await this.cleantime.getAnniversaryString(anniversary);
        let date = anniversary.date.setHours(10);
        cordova.plugins.notification.local.schedule({
          id: ++id,
          title: 'Mærkedag - ' + profile.name,
          text: 'Tillyke med ' + anniversaryText,
          trigger: { at: date }
        });
      };
    }
  }

}
