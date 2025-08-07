import { Component, OnInit } from '@angular/core';
import { CleantimeService } from 'src/app/providers/cleantime.service';
import { NotificationService } from 'src/app/providers/notification.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  constructor(
    private cleantime: CleantimeService,
    private notification: NotificationService,
  ) { }

  ngOnInit() {
    this.notification.ensureCleandayNotifications();
  }

}
