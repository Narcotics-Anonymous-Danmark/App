/**
 * na-airplay-picker — JS side (iOS only; `window.NaAirPlay` is absent elsewhere).
 *
 *   showPicker()          -> Promise<void>     opens the system AirPlay route sheet
 *   getRoute()            -> Promise<Route>
 *   onRouteChange(cb)     -> unsubscribe()     cb(Route) on every output-route change
 *
 *   Route = { airplay: boolean, routeName: string, portType: string }
 */
var exec = require('cordova/exec');

var SERVICE = 'NaAirPlay';
var listeners = [];
var lastRoute = null;
var listening = false;

function call(action, args) {
    return new Promise(function (resolve, reject) {
        exec(resolve, reject, SERVICE, action, args || []);
    });
}

function normalize(route) {
    route = route || {};
    return {
        airplay: !!route.airplay,
        routeName: route.routeName || '',
        portType: route.portType || ''
    };
}

function ensureListening() {
    if (listening) {
        return;
    }
    listening = true;
    exec(function (route) {
        lastRoute = normalize(route);
        listeners.slice().forEach(function (cb) {
            try {
                cb(lastRoute);
            } catch (e) {
                console.error('[na-airplay] listener threw', e);
            }
        });
    }, function (err) {
        listening = false;
        console.warn('[na-airplay] route listener failed', err);
    }, SERVICE, 'onRouteChange', []);
}

module.exports = {
    showPicker: function () {
        return call('showPicker');
    },

    getRoute: function () {
        return call('getRoute').then(normalize);
    },

    onRouteChange: function (cb) {
        if (typeof cb !== 'function') {
            throw new TypeError('na-airplay: listener must be a function');
        }
        ensureListening();
        listeners.push(cb);
        if (lastRoute) {
            cb(lastRoute);
        }
        return function unsubscribe() {
            var i = listeners.indexOf(cb);
            if (i !== -1) {
                listeners.splice(i, 1);
            }
        };
    },

    get route() {
        return lastRoute;
    }
};
