import { NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { CastSessionService, CastSessionState, IDLE_CAST_STATE } from 'src/app/media-player/cast.service';
import { MediaPlaylist } from 'src/app/media-player/media-player.models';
import { MediaPlayerService } from 'src/app/media-player/media-player.service';
import { ResumePointsService } from 'src/app/media-player/resume-points.service';

class FakeMedia {
  static MEDIA_NONE = 0;
  static MEDIA_STARTING = 1;
  static MEDIA_RUNNING = 2;
  static MEDIA_PAUSED = 3;
  static MEDIA_STOPPED = 4;
  static instances: FakeMedia[] = [];
  position = 0;
  released = false;
  play = jest.fn();
  pause = jest.fn();
  stop = jest.fn();
  release = jest.fn(() => { this.released = true; });
  seekTo = jest.fn();
  getDuration = jest.fn(() => 600);
  getCurrentPosition = jest.fn((cb: (p: number) => void) => cb(this.position));
  constructor(public src: string, public onSuccess: () => void, public onError: (e: any) => void,
              public onStatus: (s: number) => void) {
    FakeMedia.instances.push(this);
  }
  running() { this.onStatus(FakeMedia.MEDIA_RUNNING); }
}

const BOOK: MediaPlaylist = {
  id: 'basic-text',
  type: 'book',
  title: 'Basic Text',
  tracks: [
    { id: 'https://x/ch1.mp3', title: 'Chapter 1', url: 'https://x/ch1.mp3', durationLabel: '10:00' },
    { id: 'https://x/ch2.mp3', title: 'Chapter 2', url: 'https://x/ch2.mp3', durationLabel: '8:10' },
  ],
};

const flush = () => new Promise((r) => setImmediate(r));

describe('MediaPlayerService with Cast', () => {
  let castState: BehaviorSubject<CastSessionState>;
  let mediaListener: ((s: NaCastMediaStatus) => void) | null;
  let cast: any;
  let resumePoints: { get: jest.Mock; save: jest.Mock; clear: jest.Mock };
  let musicControls: { create: jest.Mock; destroy: jest.Mock; subscribe: jest.Mock; listen: jest.Mock;
    updateIsPlaying: jest.Mock; updateElapsed: jest.Mock };
  let service: MediaPlayerService;
  const zone = { run: (fn: () => any) => fn() } as unknown as NgZone;

  function connect(deviceName = 'Living Room') {
    castState.next({ available: true, connected: true, connecting: false, deviceName });
  }
  function disconnect() {
    castState.next({ available: true, connected: false, connecting: false, deviceName: null });
  }
  function castStatus(playerState: NaCastPlayerState, idleReason: NaCastIdleReason | null = null) {
    mediaListener!({ playerState, idleReason, position: 0, duration: 0 });
  }

  beforeEach(() => {
    FakeMedia.instances = [];
    (window as any).Media = FakeMedia;
    musicControls = {
      create: jest.fn(), destroy: jest.fn(), subscribe: jest.fn(), listen: jest.fn(),
      updateIsPlaying: jest.fn(), updateElapsed: jest.fn(),
    };
    (window as any).MusicControls = musicControls;

    castState = new BehaviorSubject<CastSessionState>(IDLE_CAST_STATE);
    mediaListener = null;
    cast = {
      state$: castState.asObservable(),
      get connected() { return castState.value.connected; },
      initialize: jest.fn().mockResolvedValue(undefined),
      onMediaStatus: jest.fn((cb: any) => { mediaListener = cb; return jest.fn(); }),
      loadMedia: jest.fn().mockResolvedValue(undefined),
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      seek: jest.fn().mockResolvedValue(undefined),
      getPosition: jest.fn().mockResolvedValue(200),
    };
    resumePoints = {
      get: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    service = new MediaPlayerService(
      resumePoints as unknown as ResumePointsService,
      cast as unknown as CastSessionService,
      zone
    );
  });

  afterEach(async () => {
    await service.stop(false);
    delete (window as any).Media;
    delete (window as any).MusicControls;
  });

  it('initializes the cast service on construction', () => {
    expect(cast.initialize).toHaveBeenCalled();
  });

  it('plays locally and shows music controls while not casting', async () => {
    await service.play(BOOK, 0);
    expect(FakeMedia.instances.length).toBe(1);
    expect(cast.loadMedia).not.toHaveBeenCalled();
    expect(musicControls.create).toHaveBeenCalled();
    expect(service.isCasting).toBe(false);
  });

  it('uses the cast backend and suppresses music controls while a session is connected', async () => {
    connect();
    await service.play(BOOK, 1);
    expect(FakeMedia.instances.length).toBe(0);
    expect(cast.loadMedia).toHaveBeenCalledWith(expect.objectContaining({
      url: BOOK.tracks[1].url, title: 'Chapter 2', artist: 'Basic Text', duration: 490, position: 0,
    }));
    expect(musicControls.create).not.toHaveBeenCalled();
    expect(service.isCasting).toBe(true);
    expect(service.state.status).toBe('playing');
  });

  it('hands local playback over to the receiver at the current position', async () => {
    await service.play(BOOK, 0);
    const local = FakeMedia.instances[0];
    local.position = 123;
    local.running();

    connect();
    await flush();

    expect(local.release).toHaveBeenCalled();
    expect(cast.loadMedia).toHaveBeenCalledWith(expect.objectContaining({ url: BOOK.tracks[0].url, position: 123 }));
    expect(service.state.trackIndex).toBe(0);
    expect(service.state.position).toBe(123);
    expect(service.isCasting).toBe(true);
    // music-controls2 is torn down so the Cast SDK notification is the only one
    expect(musicControls.destroy).toHaveBeenCalled();
  });

  it('falls back to local playback at the receiver position when the session drops', async () => {
    connect();
    await service.play(BOOK, 1);
    await flush(); // receiver accepted the load
    musicControls.create.mockClear();

    disconnect();
    await flush();

    expect(cast.getPosition).toHaveBeenCalled();
    expect(FakeMedia.instances.length).toBe(1);
    expect(FakeMedia.instances[0].src).toBe(BOOK.tracks[1].url);
    expect(service.isCasting).toBe(false);
    expect(service.state.position).toBe(200);
    FakeMedia.instances[0].running();
    expect(FakeMedia.instances[0].seekTo).toHaveBeenCalledWith(200 * 1000);
    expect(musicControls.create).toHaveBeenCalled();
  });

  it('keeps a paused track paused across the handoff', async () => {
    await service.play(BOOK, 0);
    service.pause();
    connect();
    await flush();
    expect(service.state.status).toBe('paused');
    expect(service.isCasting).toBe(true);
  });

  it('does nothing on connection changes while idle', async () => {
    connect();
    await flush();
    expect(cast.loadMedia).not.toHaveBeenCalled();
    expect(service.state.status).toBe('idle');
  });

  it('auto-advances to the next chapter when the receiver reports FINISHED', async () => {
    connect();
    await service.play(BOOK, 0);
    await flush();
    castStatus('PLAYING');
    castStatus('IDLE', 'FINISHED');
    expect(service.state.trackIndex).toBe(1);
    expect(cast.loadMedia).toHaveBeenLastCalledWith(expect.objectContaining({ url: BOOK.tracks[1].url }));
  });

  it('stops the receiver and clears the resume point after the last chapter', async () => {
    connect();
    await service.play(BOOK, 1);
    await flush();
    castStatus('PLAYING');
    castStatus('IDLE', 'FINISHED');
    await flush();
    expect(service.state.status).toBe('idle');
    expect(resumePoints.clear).toHaveBeenCalledWith('book', 'basic-text');
    expect(cast.pause).toHaveBeenCalled();
  });

  it('forwards transport controls to the receiver', async () => {
    connect();
    await service.play(BOOK, 0);
    await flush();
    service.pause();
    service.resume();
    service.seekTo(50);
    expect(cast.pause).toHaveBeenCalled();
    expect(cast.play).toHaveBeenCalled();
    expect(cast.seek).toHaveBeenCalledWith(50);
  });
});
