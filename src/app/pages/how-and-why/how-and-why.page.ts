import { Component, OnInit } from '@angular/core';
import { HowAndWhyService } from 'src/app/providers/how-and-why.service';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';

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
    private howAndWhyProvider: HowAndWhyService,
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
