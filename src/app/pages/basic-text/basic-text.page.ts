import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-basic-text',
  templateUrl: './basic-text.page.html',
  styleUrls: ['./basic-text.page.scss'],
})
export class BasicTextPage implements OnInit {

  constructor(
    private translate: TranslateService,
  ) { }

  ngOnInit() {
  }

}
