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

    this.cleantime.getProfiles().then(profiles => {
      profiles.forEach(profile => {
        let cleanDay = this.cleantime.getProfileCleanDay(profile);
        let nextAnniversaries = this.cleantime.getNextAnniversaries(cleanDay, {years: 2});
        // TODO: add notification
        // cordova.plugins.notification.local.schedule({
        //   title: 'Test',
        //   text: 'This is a very important test',
        //   trigger: { at: new Date(2025, 5, 19, 22, 10, 0) }
        // });
      });
    });
  }

}
