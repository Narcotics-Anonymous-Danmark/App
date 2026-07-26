import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { BasicTextService } from 'src/app/providers/basic-text.service';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MediaPlayerService } from 'src/app/media-player/media-player.service';
import { ResumePointsService } from 'src/app/media-player/resume-points.service';
import { TrackProgress, TrackProgressService } from 'src/app/media-player/track-progress.service';
import { MediaPlaylist, PlaybackStatus, ResumePoint } from 'src/app/media-player/media-player.models';

const BOOK_ID = 'basic-text';

@Component({
  selector: 'app-basic-text',
  templateUrl: './basic-text.page.html',
  styleUrls: ['./basic-text.page.scss'],
})
export class BasicTextPage implements OnInit, OnDestroy {

  bookTitle: any;
  bookEdition: any;
  bookAuthor: any;
  chapters: any;
  activeChapterIndex = -1;
  playerStatus: PlaybackStatus = 'idle';
  resumePoint: ResumePoint | null = null;
  private playlist: MediaPlaylist | null = null;
  private chapterProgress: { [index: number]: TrackProgress } = {};
  private liveProgress: TrackProgress | null = null;
  private stateSub?: Subscription;

  constructor(
    private basicTextProvider: BasicTextService,
    private platform: Platform,
    private router: Router,
    private player: MediaPlayerService,
    private resumePoints: ResumePointsService,
    private trackProgress: TrackProgressService,
    private zone: NgZone
  ) {
      this.platform.backButton.subscribeWithPriority(1, () => {
        this.router.navigate(['/audiobooks']);
      });
  }

  ngOnInit() {
    this.getTodayJft();
    this.stateSub = this.player.state$.subscribe((state) => {
      const isThisBook = !!state.playlist && state.playlist.id === BOOK_ID && state.status !== 'idle';
      this.activeChapterIndex = isThisBook ? state.trackIndex : -1;
      this.playerStatus = state.status;
      this.liveProgress = isThisBook ? this.trackProgress.live(state.position, state.duration) : null;
      if (state.status === 'idle') {
        this.loadResumePoint();
      }
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
    this.basicTextProvider.load().subscribe((data: any) => {
        this.bookTitle = data.bookTitle;
        this.bookEdition = data.bookEdition;
        this.bookAuthor = data.bookAuthor;
        this.chapters = data.chapters;
        this.playlist = {
          id: BOOK_ID,
          type: 'book',
          title: data.bookTitle,
          tracks: data.chapters.map((chapter: any) => ({
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
    const point = await this.resumePoints.get('book', BOOK_ID);
    this.zone.run(() => {
      this.resumePoint = point;
      this.buildChapterProgress();
    });
  }

  private buildChapterProgress() {
    const progress: { [index: number]: TrackProgress } = {};
    if (this.resumePoint && this.chapters) {
      const chapter = this.chapters[this.resumePoint.trackIndex];
      const bar = this.trackProgress.fromResumePoint(this.resumePoint, chapter && chapter.duration);
      if (bar) {
        progress[this.resumePoint.trackIndex] = bar;
      }
    }
    this.chapterProgress = progress;
  }

  get continueIndex(): number {
    if (this.activeChapterIndex >= 0) {
      return this.activeChapterIndex;
    }
    return this.resumePoint && this.chapters && this.chapters[this.resumePoint.trackIndex]
      ? this.resumePoint.trackIndex
      : -1;
  }

  chapterIcon(index: number): string {
    return this.activeChapterIndex === index && this.playerStatus === 'playing'
      ? 'pause-circle-outline'
      : 'play-circle-outline';
  }

  chapterColor(index: number): string | undefined {
    return this.progress(index) ? 'light' : undefined;
  }

  chapterIconColor(index: number): string {
    return this.progress(index) ? 'primary' : 'medium';
  }

  progress(index: number): TrackProgress | null {
    if (this.activeChapterIndex === index) {
      return this.liveProgress;
    }
    return this.chapterProgress[index] || null;
  }

  playChapter(index: number) {
    if (this.playlist) {
      this.player.play(this.playlist, index);
    }
  }

}
