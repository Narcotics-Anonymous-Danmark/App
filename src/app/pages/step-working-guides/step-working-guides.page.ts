import { Component, OnDestroy, OnInit } from '@angular/core';
import { StepWorkingGuidesService } from 'src/app/providers/step-working-guides.service';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MediaPlayerService } from 'src/app/media-player/media-player.service';
import { ResumePointsService } from 'src/app/media-player/resume-points.service';
import { formatPlaybackTime, MediaPlaylist, ResumePoint } from 'src/app/media-player/media-player.models';

const BOOK_ID = 'step-working-guides';

@Component({
  selector: 'app-step-working-guides',
  templateUrl: './step-working-guides.page.html',
  styleUrls: ['./step-working-guides.page.scss'],
})
export class StepWorkingGuidesPage implements OnInit, OnDestroy {

  bookTitle: any;
  bookEdition: any;
  bookAuthor: any;
  chapters: any;
  activeChapterIndex = -1;
  resumePoint: ResumePoint | null = null;
  private playlist: MediaPlaylist | null = null;
  private stateSub: Subscription;

  constructor(
    private stepWorkingGuidesProvider: StepWorkingGuidesService,
    private platform: Platform,
    private router: Router,
    private player: MediaPlayerService,
    private resumePoints: ResumePointsService
  ) {
      this.platform.backButton.subscribeWithPriority(1, () => {
        this.router.navigate(['/audiobooks']);
      });
  }

  ngOnInit() {
    this.getTodayJft();
    this.stateSub = this.player.state$.subscribe((state) => {
      this.activeChapterIndex = state.playlist && state.playlist.id === BOOK_ID && state.status !== 'idle'
        ? state.trackIndex
        : -1;
    });
  }

  ngOnDestroy() {
    if (this.stateSub) {
      this.stateSub.unsubscribe();
    }
  }

  ionViewWillEnter() {
    this.loadResumePoint();
  }

  getTodayJft() {
    this.stepWorkingGuidesProvider.load().subscribe((data) => {
        this.bookTitle = data.bookTitle;
        this.bookEdition = data.bookEdition;
        this.bookAuthor = data.bookAuthor;
        this.chapters = data.chapters;
        this.playlist = {
          id: BOOK_ID,
          type: 'book',
          title: data.bookTitle,
          tracks: data.chapters.map((chapter) => ({
            id: chapter.url,
            title: chapter.title,
            url: chapter.url,
            durationLabel: chapter.duration
          }))
        };
        this.loadResumePoint();
    });
  }

  async loadResumePoint() {
    this.resumePoint = await this.resumePoints.get('book', BOOK_ID);
  }

  get resumeChapterTitle(): string {
    if (!this.resumePoint || !this.chapters) {
      return '';
    }
    const chapter = this.chapters[this.resumePoint.trackIndex];
    return chapter ? chapter.title : '';
  }

  formatPosition(seconds: number): string {
    return formatPlaybackTime(seconds);
  }

  /** Continue the book from the saved resume point. */
  continueListening() {
    if (this.playlist) {
      this.player.play(this.playlist);
    }
  }

  playChapter(index: number) {
    if (this.playlist) {
      this.player.play(this.playlist, index);
    }
  }

}
