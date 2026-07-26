import { Component, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonContent, ViewWillEnter } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { PlaybackStatus, ResumePoint } from '../../media-player/media-player.models';
import { MediaPlayerService } from '../../media-player/media-player.service';
import { ResumePointsService } from '../../media-player/resume-points.service';
import { TrackProgress, TrackProgressService } from '../../media-player/track-progress.service';
import { AudioService } from '../../providers/audio.service';
import {
    buildSpeakCatalog,
    EMPTY_SPEAK_CATALOG,
    foldText,
    groupSpeaks,
    matchesQuery,
    Speak,
    SpeakCatalog,
    SpeakGroup
} from './speaks.catalog';

const PAGE_SIZE = 40;
const CONTINUE_LIMIT = 10;

type SortMode = 'newest' | 'oldest' | 'name';

@Component({
    selector: 'app-speaks',
    templateUrl: './speaks.page.html',
    styleUrls: ['./speaks.page.scss'],
})
export class SpeaksPage implements OnInit, OnDestroy, ViewWillEnter {

    @ViewChild(IonContent) content?: IonContent;

    loading = true;
    loadFailed = false;

    catalog: SpeakCatalog = EMPTY_SPEAK_CATALOG;
    groups: SpeakGroup[] = [];
    matchCount = 0;
    hasMore = false;
    yearOptions: number[] = [];
    continueItems: Speak[] = [];
    startedCount = 0;

    query = '';
    onlyStarted = false;
    sort: SortMode = 'newest';
    filtersOpen = false;
    private languages: string[] = [];
    private conventions: string[] = [];
    private years: number[] = [];

    // Player
    activeId: string | null = null;
    playerStatus: PlaybackStatus = 'idle';
    private liveProgress: TrackProgress | null = null;
    private resumeProgress: { [id: string]: TrackProgress } = {};

    private rawEvents: any[] = [];
    private resumePointsById: { [id: string]: ResumePoint } = {};
    private filtered: Speak[] = [];
    private limit = PAGE_SIZE;
    private conventionOrder: { [key: string]: number } = {};
    private subscriptions: Subscription[] = [];

    constructor(
        private audioProvider: AudioService,
        private player: MediaPlayerService,
        private resumePoints: ResumePointsService,
        private translate: TranslateService,
        private trackProgress: TrackProgressService,
        private zone: NgZone
    ) { }

    ngOnInit() {
        this.loadSpeaks();
        this.subscriptions.push(this.player.state$.subscribe((state) => {
            const playlist = state.playlist;
            const isSpeak = !!playlist && playlist.type === 'speak' && state.status !== 'idle';
            const previousStatus = this.playerStatus;
            this.activeId = isSpeak && playlist ? playlist.id : null;
            this.playerStatus = state.status;
            this.liveProgress = isSpeak ? this.trackProgress.live(state.position, state.duration) : null;
            if (previousStatus !== state.status && (state.status === 'paused' || state.status === 'idle')) {
                this.loadResumePoints();
            }
        }));
        this.subscriptions.push(this.translate.onLangChange.subscribe(() => {
            if (!this.loading && !this.loadFailed) {
                this.buildCatalog(this.rawEvents);
                this.buildProgress();
                this.applyFilters(false);
            }
        }));
    }

    ionViewWillEnter() {
        this.loadResumePoints();
    }

    ngOnDestroy() {
        this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    }

    // ------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------

    private loadSpeaks(forceReload: boolean = false, done?: () => void) {
        this.loading = this.catalog.speaks.length === 0;
        this.loadFailed = false;
        this.audioProvider.load(forceReload).subscribe(
            (events: any[]) => {
                this.rawEvents = events || [];
                this.buildCatalog(this.rawEvents);
                this.loading = false;
                this.loadResumePoints();
                this.applyFilters(false);
                if (done) {
                    done();
                }
            },
            (error: any) => {
                console.error('SpeaksPage: could not load speaks', error);
                this.loading = false;
                this.loadFailed = this.catalog.speaks.length === 0;
                if (done) {
                    done();
                }
            }
        );
    }

    private buildCatalog(events: any[]) {
        this.catalog = buildSpeakCatalog(events, {
            opening: this.translate.instant('OPENING_SPEAKER'),
            main: this.translate.instant('MAIN_SPEAKER'),
            closing: this.translate.instant('CLOSING_SPEAKER'),
            english: this.translate.instant('ENGLISH')
        });
        this.conventionOrder = {};
        this.catalog.conventions.forEach((convention, index) => this.conventionOrder[convention.key] = index);
        this.conventions = this.conventions.filter((key) => this.conventionOrder.hasOwnProperty(key));
    }

    private async loadResumePoints() {
        const points = await this.resumePoints.getAll('speak');
        this.zone.run(() => {
            this.resumePointsById = points;
            this.buildProgress();
            if (this.onlyStarted) {
                this.applyFilters(false);
            }
        });
    }

    reload(event: any) {
        this.loadSpeaks(true, () => {
            if (event && event.target) {
                event.target.complete();
            }
        });
    }

    retry() {
        this.loading = true;
        this.loadSpeaks(true);
    }

    // ------------------------------------------------------------------
    // Resume points
    // ------------------------------------------------------------------

    private buildProgress() {
        const progress: { [id: string]: TrackProgress } = {};
        const byId: { [id: string]: Speak } = {};
        this.catalog.speaks.forEach((speak) => byId[speak.id] = speak);
        const started: Speak[] = [];

        Object.keys(this.resumePointsById).forEach((id) => {
            const bar = this.trackProgress.fromResumePoint(this.resumePointsById[id]);
            if (!bar) {
                return;
            }
            progress[id] = bar;
            if (byId[id]) {
                started.push(byId[id]);
            }
        });

        started.sort((a, b) => {
            const left = this.resumePointsById[a.id].updatedAt || '';
            const right = this.resumePointsById[b.id].updatedAt || '';
            return left < right ? 1 : (left > right ? -1 : 0);
        });

        this.resumeProgress = progress;
        this.startedCount = started.length;
        this.continueItems = started.slice(0, CONTINUE_LIMIT);
    }

    isStarted(speak: Speak): boolean {
        return !!this.resumeProgress[speak.id];
    }


    isActive(speak: Speak): boolean {
        return this.activeId === speak.id;
    }

    rowColor(speak: Speak): string | undefined {
        return this.isActive(speak) || this.isStarted(speak) ? 'light' : undefined;
    }

    rowIcon(speak: Speak): string {
        return this.isActive(speak) && this.playerStatus === 'playing'
            ? 'pause-circle-outline'
            : 'play-circle-outline';
    }

    rowIconColor(speak: Speak): string {
        return this.isActive(speak) || this.isStarted(speak) ? 'primary' : 'medium';
    }

    progress(speak: Speak): TrackProgress | null {
        if (this.isActive(speak)) {
            return this.liveProgress;
        }
        return this.resumeProgress[speak.id] || null;
    }

    async forget(speak: Speak) {
        await this.resumePoints.clear('speak', speak.id);
        this.zone.run(() => {
            delete this.resumePointsById[speak.id];
            this.buildProgress();
            if (this.onlyStarted) {
                this.applyFilters(false);
            }
        });
    }

    // ------------------------------------------------------------------
    // Filtering
    // ------------------------------------------------------------------

    get languageCount(): number {
        return this.languages.length;
    }

    get conventionCount(): number {
        return this.conventions.length;
    }

    get yearCount(): number {
        return this.years.length;
    }

    get activeFilterCount(): number {
        return this.languages.length + this.conventions.length + this.years.length + (this.onlyStarted ? 1 : 0);
    }

    get hasActiveFilters(): boolean {
        return this.activeFilterCount > 0 || this.query.trim().length > 0;
    }

    toggleFilters() {
        this.filtersOpen = !this.filtersOpen;
        if (this.filtersOpen && this.content) {
            this.content.scrollToTop(200);
        }
    }

    onFilterChanged() {
        this.applyFilters();
    }

    hasLanguage(language: string): boolean {
        return this.languages.indexOf(language) >= 0;
    }

    toggleLanguage(language: string) {
        this.languages = this.toggle(this.languages, language);
        this.applyFilters();
    }

    clearLanguages() {
        this.languages = [];
        this.applyFilters();
    }

    hasConvention(key: string): boolean {
        return this.conventions.indexOf(key) >= 0;
    }

    toggleConvention(key: string) {
        this.conventions = this.toggle(this.conventions, key);
        this.applyFilters();
    }

    clearConventions() {
        this.conventions = [];
        this.applyFilters();
    }

    hasYear(year: number): boolean {
        return this.years.indexOf(year) >= 0;
    }

    toggleYear(year: number) {
        this.years = this.toggle(this.years, year);
        this.applyFilters();
    }

    clearYears() {
        this.years = [];
        this.applyFilters();
    }

    setSort(sort: SortMode) {
        this.sort = sort;
        this.applyFilters();
    }

    toggleOnlyStarted() {
        this.onlyStarted = !this.onlyStarted;
        this.applyFilters();
    }

    resetFilters() {
        this.query = '';
        this.languages = [];
        this.conventions = [];
        this.years = [];
        this.onlyStarted = false;
        this.sort = 'newest';
        this.applyFilters();
    }

    private toggle<T>(values: T[], value: T): T[] {
        const index = values.indexOf(value);
        if (index < 0) {
            return values.concat([value]);
        }
        return values.slice(0, index).concat(values.slice(index + 1));
    }

    private applyFilters(scrollToTop: boolean = true) {
        const terms = foldText(this.query).split(' ').filter((term) => term.length > 0);

        const matches = this.catalog.speaks.filter((speak) => {
            if (!this.passesSelections(speak)) {
                return false;
            }
            if (this.years.length > 0 && (!speak.year || this.years.indexOf(speak.year) < 0)) {
                return false;
            }
            return terms.length === 0 || matchesQuery(speak, terms);
        });

        matches.sort((a, b) => this.compare(a, b));

        this.filtered = matches;
        this.matchCount = matches.length;
        this.limit = PAGE_SIZE;
        this.updateVisible();
        this.updateYearOptions(terms);

        if (scrollToTop && this.content) {
            this.content.scrollToTop(200);
        }
    }

    private compare(a: Speak, b: Speak): number {
        const sections = (this.conventionOrder[a.conventionKey] || 0) - (this.conventionOrder[b.conventionKey] || 0);
        if (sections !== 0) {
            return sections;
        }
        if (this.sort === 'name') {
            return a.title.localeCompare(b.title, 'da');
        }
        if (a.sortValue === 0 || b.sortValue === 0) {
            if (a.sortValue === b.sortValue) {
                return a.title.localeCompare(b.title, 'da');
            }
            return a.sortValue === 0 ? 1 : -1;
        }
        if (a.sortValue === b.sortValue) {
            return a.title.localeCompare(b.title, 'da');
        }
        return this.sort === 'oldest' ? a.sortValue - b.sortValue : b.sortValue - a.sortValue;
    }

    private passesSelections(speak: Speak): boolean {
        if (this.languages.length > 0 && this.languages.indexOf(speak.language) < 0) {
            return false;
        }
        if (this.conventions.length > 0 && this.conventions.indexOf(speak.conventionKey) < 0) {
            return false;
        }
        if (this.onlyStarted && !this.resumeProgress[speak.id]) {
            return false;
        }
        return true;
    }

    private updateYearOptions(terms: string[]) {
        const years: { [year: number]: true } = {};
        this.catalog.speaks.forEach((speak) => {
            if (!speak.year || !this.passesSelections(speak)) {
                return;
            }
            if (terms.length > 0 && !matchesQuery(speak, terms)) {
                return;
            }
            years[speak.year] = true;
        });
        this.years.forEach((year) => years[year] = true);
        this.yearOptions = Object.keys(years)
            .map((year) => parseInt(year, 10))
            .sort((a, b) => b - a);
    }

    private updateVisible() {
        this.groups = groupSpeaks(this.filtered.slice(0, this.limit));
        this.hasMore = this.filtered.length > this.limit;
    }

    loadMore(event: any) {
        this.limit += PAGE_SIZE;
        this.updateVisible();
        if (event && event.target) {
            event.target.complete();
        }
    }

    // ------------------------------------------------------------------
    // Playback
    // ------------------------------------------------------------------

    play(speak: Speak) {
        this.player.play({
            id: speak.id,
            type: 'speak',
            title: speak.eventTitle,
            coverUrl: 'assets/img/na-logo-placeholder.png',
            tracks: [{
                id: speak.id,
                title: this.trackTitle(speak),
                url: speak.audioUrl
            }]
        });
    }

    private trackTitle(speak: Speak): string {
        const parts = [speak.title];
        if (speak.kindLabel && speak.speaker) {
            parts.push(speak.kindLabel);
        }
        if (speak.meta) {
            parts.push(speak.meta);
        }
        return parts.join(' · ');
    }

    trackById(_index: number, speak: Speak): string {
        return speak.id;
    }

    trackByGroup(_index: number, group: SpeakGroup): string {
        return group.key;
    }

}
