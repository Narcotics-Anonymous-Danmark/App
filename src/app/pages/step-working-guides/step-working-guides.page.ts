import { Component, OnInit } from '@angular/core';
import { StepWorkingGuidesService } from 'src/app/providers/step-working-guides.service'
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';


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
    private howAndWhyProvider: StepWorkingGuidesService,
    private platform: Platform,
    private router: Router
  ) {
      this.platform.backButton.subscribeWithPriority(1, () => {
        this.router.navigate(['/audiobooks']);
      });
  }

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
