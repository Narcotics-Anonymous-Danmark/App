import { Component, OnInit } from '@angular/core';

declare var cordova: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit {

  constructor() { }

  ngOnInit() {
    cordova.plugins.notification.local.schedule({
        title: 'Test',
        text: 'This is a very important test',
        trigger: { at: new Date(2025, 5, 19, 22, 10, 0) }
    });
  }

}
