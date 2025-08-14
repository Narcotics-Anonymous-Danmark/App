import { Component, OnInit } from '@angular/core';
import { JftService } from 'src/app/providers/jft.service';

@Component({
  selector: 'app-jft',
  templateUrl: './jft.page.html',
  styleUrls: ['./jft.page.scss'],
})
export class JftPage implements OnInit {

  todayJft: any;
  todayDate: Date = new Date;

  constructor(
    private jftProvider: JftService
  ) { }

  ngOnInit() {
    this.getTodayJft();
  }

  getTodayJft() {
    this.jftProvider.getTodayJft().then((todayJft) => {
        todayJft.jft = todayJft.jft.replace("Bare for i dag:", "<b>Bare for i dag:</b>");
        this.todayJft = todayJft;
    });
  }

}
