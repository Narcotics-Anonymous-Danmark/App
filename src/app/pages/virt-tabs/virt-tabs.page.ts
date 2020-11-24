import { Component, OnInit } from '@angular/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-virt-tabs',
  templateUrl: './virt-tabs.page.html',
  styleUrls: ['./virt-tabs.page.scss'],
})
export class VirtTabsPage implements OnInit {

  constructor(public iab: InAppBrowser,
              private translate: TranslateService) { }

  ngOnInit() {
  }

  public visit() {
    const browser = this.iab.create('https://virtual-na.org', '_system');
  }
}
