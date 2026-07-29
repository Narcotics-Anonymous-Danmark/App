import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { formatPlaybackTime, parseDurationLabel, ResumePoint } from './media-player.models';

export interface TrackProgress {
    percent: number | null;
    label: string;
}

export const MIN_RESUME_SECONDS = 5;

@Injectable({
    providedIn: 'root'
})
export class TrackProgressService {

    constructor(private translate: TranslateService) { }

    fromResumePoint(point: ResumePoint | null, durationLabel?: string): TrackProgress | null {
        if (!point || point.position < MIN_RESUME_SECONDS) {
            return null;
        }
        const duration = point.duration || parseDurationLabel(durationLabel);
        const percent = duration > 0 ? Math.min(1, point.position / duration) : null;
        if (percent !== null && percent > 0.995) {
            return null;
        }
        let label = this.translate.instant('PLAYER_CONTINUE_FROM', {
            time: formatPlaybackTime(point.position)
        });
        if (duration > 0) {
            label += ' · ' + this.translate.instant('PLAYER_TIME_LEFT', {
                time: formatPlaybackTime(duration - point.position)
            });
        }
        return { percent, label };
    }

    live(position: number, duration: number): TrackProgress {
        return {
            percent: duration > 0 ? Math.min(1, position / duration) : 0,
            label: this.translate.instant('PLAYER_NOW_PLAYING') + ' · ' + formatPlaybackTime(position)
                + (duration > 0 ? ' / ' + formatPlaybackTime(duration) : '')
        };
    }
}
