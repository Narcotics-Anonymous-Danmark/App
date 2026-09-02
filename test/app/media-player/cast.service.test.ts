import { NgZone } from '@angular/core';
import { CastSessionService, IDLE_CAST_STATE } from 'src/app/media-player/cast.service';

describe('CastSessionService', () => {
  const zone = { run: (fn: () => any) => fn() } as unknown as NgZone;
  let plugin: any;
  let sessionListener: ((s: NaCastSessionState) => void) | null;

  beforeEach(() => {
    sessionListener = null;
    plugin = {
      initialize: jest.fn().mockResolvedValue({ available: true, connected: false, connecting: false, deviceName: null }),
      onSessionState: jest.fn((cb: any) => { sessionListener = cb; return jest.fn(); }),
      requestSession: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
      loadMedia: jest.fn().mockResolvedValue(undefined),
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      seek: jest.fn().mockResolvedValue(undefined),
      onMediaStatus: jest.fn(() => jest.fn()),
      getPosition: jest.fn().mockResolvedValue(12.5),
    };
  });

  afterEach(() => {
    delete (window as any).NaCast;
    delete (window as any).cordova;
  });

  it('is a no-op without the plugin (browser dev)', async () => {
    const service = new CastSessionService(zone);
    await service.initialize();
    expect(service.supported).toBe(false);
    expect(service.state).toEqual(IDLE_CAST_STATE);
    await expect(service.requestSession()).resolves.toBeUndefined();
    await expect(service.loadMedia({ url: 'u' })).rejects.toBeDefined();
    expect(await service.getPosition()).toBe(0);
    expect(typeof service.onMediaStatus(() => { })).toBe('function');
  });

  it('initializes the plugin once and publishes its state', async () => {
    (window as any).NaCast = plugin;
    const service = new CastSessionService(zone);
    await service.initialize();
    await service.initialize();
    expect(plugin.initialize).toHaveBeenCalledTimes(1);
    expect(service.state.available).toBe(true);
    expect(service.connected).toBe(false);
  });

  it('waits for deviceready when cordova exists but the plugin is not attached yet', async () => {
    (window as any).cordova = {};
    const service = new CastSessionService(zone);
    const pending = service.initialize();
    (window as any).NaCast = plugin;
    document.dispatchEvent(new Event('deviceready'));
    await pending;
    expect(plugin.initialize).toHaveBeenCalledTimes(1);
  });

  it('forwards session events and only emits real changes', async () => {
    (window as any).NaCast = plugin;
    const service = new CastSessionService(zone);
    await service.initialize();
    const seen: any[] = [];
    service.state$.subscribe((s) => seen.push(s));
    sessionListener!({ available: true, connected: false, connecting: false, deviceName: null }); // same
    sessionListener!({ available: true, connected: true, connecting: false, deviceName: 'Living Room' });
    expect(seen.length).toBe(2);
    expect(service.connected).toBe(true);
    expect(service.state.deviceName).toBe('Living Room');
  });

  it('forwards media calls to the plugin', async () => {
    (window as any).NaCast = plugin;
    const service = new CastSessionService(zone);
    await service.requestSession();
    await service.endSession();
    await service.loadMedia({ url: 'u' });
    await service.play();
    await service.pause();
    await service.seek(3);
    expect(plugin.requestSession).toHaveBeenCalled();
    expect(plugin.endSession).toHaveBeenCalledWith(true);
    expect(plugin.loadMedia).toHaveBeenCalledWith({ url: 'u' });
    expect(plugin.seek).toHaveBeenCalledWith(3);
    expect(await service.getPosition()).toBe(12.5);
  });

  it('falls back to idle state when initialize rejects', async () => {
    plugin.initialize.mockRejectedValue('boom');
    (window as any).NaCast = plugin;
    const service = new CastSessionService(zone);
    await service.initialize();
    expect(service.state).toEqual(IDLE_CAST_STATE);
  });
});
