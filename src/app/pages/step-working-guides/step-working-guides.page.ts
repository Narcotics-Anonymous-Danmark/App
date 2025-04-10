import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { StepWorkingGuidesService } from 'src/app/providers/step-working-guides.service'

@Component({
  selector: 'app-step-working-guides',
  templateUrl: './step-working-guides.page.html',
  styleUrls: ['./step-working-guides.page.scss'],
})
export class StepWorkingGuidesPage implements OnInit {

  bookTitle: any;
  bookEdition: any;
  bookAuthor: any;
  chapters: any;
  activeChapter: any;

  constructor(
    private translate: TranslateService,
    private howAndWhyProvider: StepWorkingGuidesService
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
