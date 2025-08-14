import { Component, OnInit } from '@angular/core';
import { CleantimeService } from 'src/app/providers/cleantime.service';
import { JftService } from 'src/app/providers/jft.service';
import { EventService } from '../../providers/event.service';
import { NotificationService } from 'src/app/providers/notification.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  cleantimes = [];
  jft = {};
  events = [];

  constructor(
    private cleantime: CleantimeService,
    private jftProvider: JftService,
    private eventProvider: EventService,
    private notification: NotificationService,
  ) {
    this.loadCleantimes();
    this.loadJft();
    this.loadEvents();
  }

  ngOnInit() {
    this.notification.ensureCleandayNotifications();
  }

  loadCleantimes() {
    this.cleantime.getProfiles().then(profiles => {
      for (const profile of profiles) {
        const [cleanTimeInYears, cleanTimeInMonths, cleanTimeInDays] = this.cleantime.getCleanYearsMonthsDays(this.cleantime.getProfileCleanDay(profile));
        this.cleantimes.push({
          name: profile.name,
          years: cleanTimeInYears,
          yearsLabel: cleanTimeInYears === 1 ? "YEAR" : "YEARS",
          months: cleanTimeInMonths,
          monthsLabel: cleanTimeInMonths === 1 ? "MONTH" : "MONTHS",
          days: cleanTimeInDays,
          daysLabel: cleanTimeInDays === 1 ? "DAY" : "DAYS",
          date: profile.cleandate
        });
      }
    });
  }

  loadJft() {
    this.jftProvider.getTodayJft().then((todayJft) => {
        this.jft = {
          date: new Date,
          todayJft: todayJft
        };
    });
  }

  loadEvents() {
    this.eventProvider.load().subscribe((data) => {
        this.events = Array.of(data)[0].slice().splice(0, 3);
    });
  }

}
