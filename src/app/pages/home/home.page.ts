import { Component, OnInit } from '@angular/core';
import { CleantimeService } from 'src/app/providers/cleantime.service';

declare var cordova: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  constructor(
    private cleantime: CleantimeService
  ) { }

  ngOnInit() {

    cordova.plugins.notification.local.schedule({
        title: 'Test',
        text: 'This is a very important test',
        trigger: { at: new Date(2025, 5, 19, 22, 10, 0) }
    });

    this.cleantime.getProfiles().then(profiles => {
      profiles.forEach(profile => {
        let cleanDay = this.cleantime.getProfileCleanDay(profile);
        let [cleanTimeInDays,,,] = this.cleantime.getCleanTimes(cleanDay);
        console.log("Profile " + profile["name"] + " clean days: " + cleanTimeInDays);
      });
    })
  }

}
