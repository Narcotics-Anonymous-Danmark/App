import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BasicTextService } from 'src/app/providers/basic-text.service';

@Component({
  selector: 'app-basic-text',
  templateUrl: './basic-text.page.html',
  styleUrls: ['./basic-text.page.scss'],
})
export class BasicTextPage implements OnInit {

  bookTitle: any;
  bookEdition: any;
  bookAuthor: any;
  chapters: any;
  activeChapter: any;

  constructor(
    private translate: TranslateService,
    private basicTextProvider: BasicTextService
  ) { }

  ngOnInit() {
    this.getTodayJft();
  }

  getTodayJft() {
    this.basicTextProvider.load().subscribe((data) => {
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
