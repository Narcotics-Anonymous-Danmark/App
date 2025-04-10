import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { HowAndWhyService } from 'src/app/providers/how-and-why.service';

@Component({
  selector: 'app-how-and-why',
  templateUrl: './how-and-why.page.html',
  styleUrls: ['./how-and-why.page.scss'],
})
export class HowAndWhyPage implements OnInit {

  bookTitle: any;
  bookEdition: any;
  bookAuthor: any;
  chapters: any;
  activeChapter: any;

  constructor(
    private translate: TranslateService,
    private howAndWhyProvider: HowAndWhyService
  ) { }

  ngOnInit() {
    this.getTodayJft();
  }

  getTodayJft() {
    this.howAndWhyProvider.load().subscribe((data) => {
        this.bookTitle = data.bookTitle;
        this.bookEdition = data.bookEdition;
        this.bookAuthor = data.bookAuthor;
        this.chapters = data.chapters;
    });
  }

  playChapter(chapter) {
    this.activeChapter = chapter;
  }

}
