/**
 * na-cast — JS side of the minimal Google Cast sender.
 *
 * This file *is* the contract that the Angular CastSessionService / CastBackend
 * (and, later, the Flutter port) build on. Keep it small and platform-neutral.
 *
 *   initialize()                      -> Promise<SessionState>
 *   onSessionState(cb)                -> unsubscribe()      cb(SessionState)
 *   requestSession()                  -> Promise<void>      opens the native device picker
 *                                                           (or the controller dialog while connected)
 *   endSession(stopReceiver = true)   -> Promise<void>
 *   loadMedia(media)                  -> Promise<void>      resolves once the receiver accepted the load
 *   play() / pause() / seek(seconds)  -> Promise<void>
 *   onMediaStatus(cb)                 -> unsubscribe()      cb(MediaStatus)
 *   getPosition()                     -> Promise<number>    receiver's estimated position, seconds
 *
 *   SessionState = { available: boolean, connected: boolean, connecting: boolean, deviceName: string|null }
 *     available  Android: at least one Cast device has been discovered.
 *                iOS:     true once initialised — discovery is deferred to the first
 *                         requestSession() so the local-network permission prompt is
 *                         tied to a user action instead of app launch.
 *   MediaStatus  = { playerState: 'IDLE'|'PLAYING'|'PAUSED'|'BUFFERING'|'LOADING'|'UNKNOWN',
 *                    idleReason: 'NONE'|'FINISHED'|'CANCELLED'|'INTERRUPTED'|'ERROR'|null,
 *                    position: number (s), duration: number (s, 0 while unknown) }
 *   media        = { url, contentType, title, artist, duration (s, optional), position (s), autoplay (default true) }
 *
 * All Promises reject with a string message when the SDK is unavailable
 * (no Google Play Services, no session, ...).
 */
var exec = require('cordova/exec');

var SERVICE = 'NaCast';

var sessionListeners = [];
var mediaListeners = [];
var lastSessionState = null;
var lastMediaStatus = null;
var listening = false;

function call(action, args) {
    return new Promise(function (resolve, reject) {
        exec(resolve, reject, SERVICE, action, args || []);
    });
}

function dispatch(listeners, payload) {
    listeners.slice().forEach(function (cb) {
        try {
            cb(payload);
        } catch (e) {
            console.error('[na-cast] listener threw', e);
        }
    });
}

function onNativeEvent(event) {
    if (!event || typeof event !== 'object') {
        return;
    }
    if (event.type === 'session') {
        lastSessionState = {
            available: !!event.available,
            connected: !!event.connected,
            connecting: !!event.connecting,
            deviceName: event.deviceName || null
        };
        dispatch(sessionListeners, lastSessionState);
    } else if (event.type === 'media') {
        lastMediaStatus = {
            playerState: event.playerState || 'UNKNOWN',
            idleReason: event.idleReason || null,
            position: typeof event.position === 'number' ? event.position : 0,
            duration: typeof event.duration === 'number' ? event.duration : 0
        };
        dispatch(mediaListeners, lastMediaStatus);
    }
}

function ensureListening() {
    if (listening) {
        return;
    }
    listening = true;
    exec(onNativeEvent, function (err) {
        listening = false;
        onNativeEvent({ type: 'session', available: false, connected: false, connecting: false, deviceName: null });
        console.warn('[na-cast] listen channel failed', err);
    }, SERVICE, 'listen', []);
}

function subscribe(listeners, cb, replay) {
    if (typeof cb !== 'function') {
        throw new TypeError('na-cast: listener must be a function');
    }
    ensureListening();
    listeners.push(cb);
    if (replay) {
        cb(replay);
    }
    return function unsubscribe() {
        var i = listeners.indexOf(cb);
        if (i !== -1) {
            listeners.splice(i, 1);
        }
    };
}

var NaCast = {
    initialize: function () {
        ensureListening();
        return call('initialize').then(function (state) {
            onNativeEvent(Object.assign({ type: 'session' }, state || {}));
            return lastSessionState;
        });
    },

    onSessionState: function (cb) {
        return subscribe(sessionListeners, cb, lastSessionState);
    },

    requestSession: function () {
        return call('requestSession');
    },

    endSession: function (stopReceiver) {
        return call('endSession', [stopReceiver !== false]);
    },

    loadMedia: function (media) {
        media = media || {};
        if (!media.url) {
            return Promise.reject('na-cast: loadMedia requires a url');
        }
        return call('loadMedia', [{
            url: String(media.url),
            contentType: media.contentType || 'audio/mpeg',
            title: media.title || '',
            artist: media.artist || '',
            duration: typeof media.duration === 'number' && media.duration > 0 ? media.duration : 0,
            position: typeof media.position === 'number' && media.position > 0 ? media.position : 0,
            autoplay: media.autoplay !== false
        }]);
    },

    play: function () {
        return call('play');
    },

    pause: function () {
        return call('pause');
    },

    seek: function (seconds) {
        return call('seek', [Math.max(0, Number(seconds) || 0)]);
    },

    onMediaStatus: function (cb) {
        return subscribe(mediaListeners, cb, lastMediaStatus);
    },

    getPosition: function () {
        return call('getPosition').then(function (pos) {
            return typeof pos === 'number' && pos >= 0 ? pos : 0;
        });
    },

    get sessionState() {
        return lastSessionState;
    },
    get mediaStatus() {
        return lastMediaStatus;
    }
};

module.exports = NaCast;
