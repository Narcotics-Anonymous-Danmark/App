import { CastBackend } from 'src/app/media-player/cast-backend';
import { CastSessionService } from 'src/app/media-player/cast.service';

type StatusListener = (status: NaCastMediaStatus) => void;

function status(playerState: NaCastPlayerState, idleReason: NaCastIdleReason | null = null, duration = 0): NaCastMediaStatus {
  return { playerState, idleReason, position: 0, duration };
}

describe('CastBackend', () => {
  let listener: StatusListener | null;
  let unsubscribe: jest.Mock;
  let cast: {
    onMediaStatus: jest.Mock; loadMedia: jest.Mock; play: jest.Mock; pause: jest.Mock;
    seek: jest.Mock; getPosition: jest.Mock;
  };
  let events: { onEnded: jest.Mock; onError: jest.Mock; onRunning: jest.Mock };
  let resolveLoad: () => void;
  let rejectLoad: (e: any) => void;

  const flush = () => new Promise((r) => setImmediate(r));

  beforeEach(() => {
    listener = null;
    unsubscribe = jest.fn();
    cast = {
      onMediaStatus: jest.fn((cb: StatusListener) => { listener = cb; return unsubscribe; }),
      loadMedia: jest.fn(() => new Promise<void>((res, rej) => { resolveLoad = res; rejectLoad = rej; })),
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      seek: jest.fn().mockResolvedValue(undefined),
      getPosition: jest.fn().mockResolvedValue(42),
    };
    events = { onEnded: jest.fn(), onError: jest.fn(), onRunning: jest.fn() };
  });

  function make(startPosition = 0, duration = 600) {
    return new CastBackend(cast as unknown as CastSessionService, {
      title: 'Chapter 1', artist: 'Basic Text', duration, startPosition,
    });
  }

  it('maps file extension to a content type', () => {
    expect(CastBackend.contentTypeFor('https://x/a.mp3')).toBe('audio/mpeg');
    expect(CastBackend.contentTypeFor('https://x/a.WAV?x=1')).toBe('audio/wav');
    expect(CastBackend.contentTypeFor('https://x/a.m4a')).toBe('audio/mp4');
  });

  it('loads the receiver with metadata, start position and autoplay', () => {
    make(120).load('https://x/ch1.mp3', events);
    expect(cast.loadMedia).toHaveBeenCalledWith({
      url: 'https://x/ch1.mp3', contentType: 'audio/mpeg', title: 'Chapter 1', artist: 'Basic Text',
      duration: 600, position: 120, autoplay: true,
    });
  });

  it('emits onRunning once when the receiver starts playing', async () => {
    make().load('u', events);
    resolveLoad();
    await flush();
    listener!(status('BUFFERING'));
    listener!(status('PLAYING', null, 700));
    listener!(status('PLAYING'));
    expect(events.onRunning).toHaveBeenCalledTimes(1);
  });

  it('picks up the duration from media status', async () => {
    const backend = make(0, 0);
    backend.load('u', events);
    expect(backend.getDuration()).toBe(0);
    resolveLoad();
    await flush();
    listener!(status('PLAYING', null, 700));
    expect(backend.getDuration()).toBe(700);
  });

  it('emits onEnded only for a FINISHED that follows playback of this item', async () => {
    make().load('u', events);
    resolveLoad();
    await flush();
    listener!(status('IDLE', 'FINISHED')); // stale status of the previous track
    expect(events.onEnded).not.toHaveBeenCalled();
    listener!(status('PLAYING'));
    listener!(status('IDLE', 'FINISHED'));
    expect(events.onEnded).toHaveBeenCalledTimes(1);
  });

  it('ignores statuses that arrive before the load is accepted', async () => {
    make().load('u', events);
    listener!(status('PLAYING'));
    listener!(status('IDLE', 'FINISHED'));
    expect(events.onRunning).not.toHaveBeenCalled();
    expect(events.onEnded).not.toHaveBeenCalled();
  });

  it('ignores CANCELLED / INTERRUPTED idles', async () => {
    make().load('u', events);
    resolveLoad();
    await flush();
    listener!(status('PLAYING'));
    listener!(status('IDLE', 'INTERRUPTED'));
    listener!(status('IDLE', 'CANCELLED'));
    expect(events.onEnded).not.toHaveBeenCalled();
    expect(events.onError).not.toHaveBeenCalled();
  });

  it('emits onError for a receiver error and for a failed load', async () => {
    make().load('u', events);
    resolveLoad();
    await flush();
    listener!(status('IDLE', 'ERROR'));
    expect(events.onError).toHaveBeenCalledTimes(1);

    const second = { onEnded: jest.fn(), onError: jest.fn(), onRunning: jest.fn() };
    make().load('u', second);
    rejectLoad('Load failed');
    await flush();
    expect(second.onError).toHaveBeenCalledWith('Load failed');
  });

  it('queues pause and seek until the load is accepted', async () => {
    const backend = make();
    backend.load('u', events);
    backend.play();
    backend.pause();
    backend.seekTo(30);
    expect(cast.pause).not.toHaveBeenCalled();
    expect(cast.seek).not.toHaveBeenCalled();
    resolveLoad();
    await flush();
    expect(cast.seek).toHaveBeenCalledWith(30);
    expect(cast.pause).toHaveBeenCalledTimes(1);
    expect(cast.play).not.toHaveBeenCalled(); // autoplay covers the initial play()
  });

  it('forwards play / pause / seek once loaded', async () => {
    const backend = make();
    backend.load('u', events);
    resolveLoad();
    await flush();
    backend.play();
    backend.pause();
    backend.seekTo(-5);
    expect(cast.play).toHaveBeenCalledTimes(1);
    expect(cast.pause).toHaveBeenCalledTimes(1);
    expect(cast.seek).toHaveBeenCalledWith(0);
  });

  it('reports the start position until loaded, then the receiver position', async () => {
    const backend = make(90);
    backend.load('u', events);
    expect(await backend.getPosition()).toBe(90);
    resolveLoad();
    await flush();
    expect(await backend.getPosition()).toBe(42);
  });

  it('release unsubscribes, pauses the receiver and mutes late events', async () => {
    const backend = make();
    backend.load('u', events);
    resolveLoad();
    await flush();
    backend.release();
    expect(unsubscribe).toHaveBeenCalled();
    expect(cast.pause).toHaveBeenCalled();
    listener!(status('PLAYING'));
    expect(events.onRunning).not.toHaveBeenCalled();
    expect(await backend.getPosition()).toBe(0);
  });

  it('does not pause the receiver when released before the load completed', () => {
    const backend = make();
    backend.load('u', events);
    backend.release();
    expect(cast.pause).not.toHaveBeenCalled();
  });
});
