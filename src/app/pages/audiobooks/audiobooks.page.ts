import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { formatPlaybackTime, parseDurationLabel, ResumePoint } from 'src/app/media-player/media-player.models';
import { MediaPlayerService } from 'src/app/media-player/media-player.service';
import { ResumePointsService } from 'src/app/media-player/resume-points.service';
import { MIN_RESUME_SECONDS, TrackProgress } from 'src/app/media-player/track-progress.service';
import { BasicTextService } from 'src/app/providers/basic-text.service';
import { HowAndWhyService } from 'src/app/providers/how-and-why.service';
import { StepWorkingGuidesService } from 'src/app/providers/step-working-guides.service';

interface AudioBookRow {
    id: string;
    route: string;
    titleKey: string;
    cover: string;
    durationLabel: string;
}

const BOOKS: AudioBookRow[] = [
    {
        id: 'basic-text',
        route: '/basic-text',
        titleKey: 'BASIC_TEXT',
        cover: './assets/img/audiobooks/basic-text.png',
        durationLabel: '13:53:58'
    },
    {
        id: 'how-and-why',
        route: '/how-and-why',
        titleKey: 'HOW_AND_WHY',
        cover: './assets/img/audiobooks/how-and-why.png',
        durationLabel: '06:11:37'
    },
    {
        id: 'step-working-guides',
        route: '/step-working-guides',
        titleKey: 'STEP_WORKING_GUIDES',
        cover: './assets/img/audiobooks/step-working-guides.png',
        durationLabel: '05:03:49'
    }
];

@Component({
    selector: 'app-audiobooks',
    templateUrl: './audiobooks.page.html',
    styleUrls: ['./audiobooks.page.scss'],
})
export class AudioBooksPage implements OnInit, OnDestroy, ViewWillEnter {

    books = BOOKS;

    private chapterDurations: { [bookId: string]: number[] } = {};
    private resumePointsById: { [bookId: string]: ResumePoint } = {};
    private bookProgress: { [bookId: string]: TrackProgress } = {};
    private live: { bookId: string, trackIndex: number, position: number } | null = null;
    private subscriptions: Subscription[] = [];

    constructor(
        private basicTextProvider: BasicTextService,
        private howAndWhyProvider: HowAndWhyService,
        private stepWorkingGuidesProvider: StepWorkingGuidesService,
        private player: MediaPlayerService,
        private resumePoints: ResumePointsService,
        private translate: TranslateService,
        private zone: NgZone
    ) { }

    ngOnInit() {
        this.loadChapters('basic-text', this.basicTextProvider);
        this.loadChapters('how-and-why', this.howAndWhyProvider);
        this.loadChapters('step-working-guides', this.stepWorkingGuidesProvider);
        this.loadResumePoints();

        this.subscriptions.push(this.player.state$.subscribe((state) => {
            const playlist = state.playlist;
            const isBook = !!playlist && playlist.type === 'book' && state.status !== 'idle';
            const wasLive = !!this.live;
            this.live = isBook && playlist
                ? { bookId: playlist.id, trackIndex: state.trackIndex, position: state.position }
                : null;
            if (this.live) {
                this.buildProgress();
            } else if (wasLive) {
                this.loadResumePoints();
            }
        }));

        this.subscriptions.push(this.translate.onLangChange.subscribe(() => this.buildProgress()));
    }

    ionViewWillEnter() {
        this.loadResumePoints();
    }

    ngOnDestroy() {
        this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    }

    progress(book: AudioBookRow): TrackProgress | null {
        return this.bookProgress[book.id] || null;
    }

    isStarted(book: AudioBookRow): boolean {
        return !!this.bookProgress[book.id];
    }

    rowColor(book: AudioBookRow): string | undefined {
        return this.isStarted(book) ? 'light' : undefined;
    }

    trackById(_index: number, book: AudioBookRow): string {
        return book.id;
    }

    private loadChapters(bookId: string, provider: { load: () => any }) {
        provider.load().subscribe(
            (data: any) => {
                const chapters = (data && data.chapters) || [];
                this.chapterDurations[bookId] = chapters.map((chapter: any) => parseDurationLabel(chapter.duration));
                this.buildProgress();
            },
            (error: any) => console.error('AudioBooksPage: could not load ' + bookId, error)
        );
    }

    private async loadResumePoints() {
        const points = await this.resumePoints.getAll('book');
        this.zone.run(() => {
            this.resumePointsById = points;
            this.buildProgress();
        });
    }

    private buildProgress() {
        const progress: { [bookId: string]: TrackProgress } = {};
        this.books.forEach((book) => {
            const bar = this.buildBookProgress(book);
            if (bar) {
                progress[book.id] = bar;
            }
        });
        this.bookProgress = progress;
    }

    private buildBookProgress(book: AudioBookRow): TrackProgress | null {
        const durations = this.chapterDurations[book.id];
        if (!durations || durations.length === 0) {
            return null;
        }

        const live = this.live && this.live.bookId === book.id ? this.live : null;
        const point = this.resumePointsById[book.id];
        if (!live && !point) {
            return null;
        }

        const chapterIndex = live ? live.trackIndex : point.trackIndex;
        const chapterPosition = live ? live.position : point.position;
        if (chapterIndex < 0 || chapterIndex >= durations.length) {
            return null;
        }
        if (chapterIndex === 0 && chapterPosition < MIN_RESUME_SECONDS) {
            return null;
        }

        const total = durations.reduce((sum, value) => sum + value, 0);
        let elapsed = chapterPosition;
        for (let i = 0; i < chapterIndex; i++) {
            elapsed += durations[i];
        }
        if (total > 0) {
            elapsed = Math.min(elapsed, total);
        }

        const parts: string[] = [];
        if (live) {
            parts.push(this.translate.instant('PLAYER_NOW_PLAYING'));
        }
        parts.push(this.translate.instant('BOOK_CHAPTER_OF', {
            index: chapterIndex + 1,
            count: durations.length
        }));
        if (total > 0 && !live) {
            parts.push(this.translate.instant('PLAYER_TIME_LEFT', {
                time: formatPlaybackTime(total - elapsed)
            }));
        }

        return {
            percent: total > 0 ? Math.min(1, elapsed / total) : null,
            label: parts.join(' · ')
        };
    }
}
