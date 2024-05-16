import { Component, OnInit } from '@angular/core';
import { JftService } from 'src/app/providers/jft.service';
import * as moment from 'moment';

@Component({
  selector: 'app-jft',
  templateUrl: './jft.page.html',
  styleUrls: ['./jft.page.scss'],
})
export class JftPage implements OnInit {

  todayJft: any;
  todayYear: any;

  constructor(
    private jftProvider: JftService
  ) { }

  ngOnInit() {
    this.getTodayJft();
  }

  getTodayJft() {
    this.jftProvider.load().subscribe((data) => {
        let monthMap = {"01": "januar", "02": "februar", "03": "marts", "04": "april", "05": "maj", "06": "juni", "07": "juli", "08": "august", "09": "september", "10": "oktober", "11": "november", "12": "december"};
        let todayMoment = moment();
        let todayDay = todayMoment.format("DD");
        let todayMonth = monthMap[todayMoment.format("MM")];
        this.todayYear = todayMoment.format("YYYY");
        this.todayJft = data.filter(datum => datum.day === todayDay && datum.month === todayMonth)[0];
        this.todayJft.jft = this.todayJft.jft.replace("Bare for i dag:", "<b>Bare for i dag:</b>");
    });
  }

}
