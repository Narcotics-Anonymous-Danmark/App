package dk.nadanmark.cast

import android.util.Log
import androidx.core.content.ContextCompat
import androidx.mediarouter.app.MediaRouteChooserDialog
import androidx.mediarouter.app.MediaRouteControllerDialog
import androidx.mediarouter.media.MediaRouteSelector
import androidx.mediarouter.media.MediaRouter
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.MediaSeekOptions
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.CastState
import com.google.android.gms.cast.framework.CastStateListener
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.cast.framework.media.RemoteMediaClient
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.apache.cordova.PluginResult
import org.json.JSONArray
import org.json.JSONObject

/**
 * Cordova plugin wrapping the Google Cast sender SDK (play-services-cast-framework).
 *
 * Contract: see www/na-cast.js. Everything that touches the Cast SDK runs on the
 * main thread (the SDK requires it). One `listen` callback carries both session
 * and media events to JS; per-call actions get their own CallbackContext.
 *
 * Portability: the only Cordova-specific pieces are [execute] and the
 * CallbackContext plumbing. The SDK wiring below (options provider, session
 * listener, remote media client callback, load/play/pause/seek/position) is what a
 * Flutter MethodChannel/EventChannel plugin would call verbatim.
 */
class NaCast : CordovaPlugin() {

    private var castContext: CastContext? = null
    private var listenCallback: CallbackContext? = null
    private var playServicesAvailable = false
    private var initializing = false
    private val pendingInitCallbacks = mutableListOf<CallbackContext>()
    private var remoteMediaClient: RemoteMediaClient? = null

    private val mediaCallback = object : RemoteMediaClient.Callback() {
        override fun onStatusUpdated() = emitMediaStatus()
        override fun onMetadataUpdated() = emitMediaStatus()
    }

    private var routerCallbackRegistered = false

    private val routerCallback = object : MediaRouter.Callback() {
        override fun onRouteAdded(router: MediaRouter, route: MediaRouter.RouteInfo) = emitSessionState()
        override fun onRouteRemoved(router: MediaRouter, route: MediaRouter.RouteInfo) = emitSessionState()
        override fun onRouteChanged(router: MediaRouter, route: MediaRouter.RouteInfo) = emitSessionState()
    }

    private val castStateListener = CastStateListener { emitSessionState() }

    private val sessionListener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarting(session: CastSession) = emitSessionState()
        override fun onSessionStarted(session: CastSession, sessionId: String) = attach(session)
        override fun onSessionStartFailed(session: CastSession, error: Int) = detach()
        override fun onSessionEnding(session: CastSession) = emitSessionState()
        override fun onSessionEnded(session: CastSession, error: Int) = detach()
        override fun onSessionResuming(session: CastSession, sessionId: String) = emitSessionState()
        override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) = attach(session)
        override fun onSessionResumeFailed(session: CastSession, error: Int) = detach()
        override fun onSessionSuspended(session: CastSession, reason: Int) = emitSessionState()
    }

    override fun execute(action: String, args: JSONArray, callbackContext: CallbackContext): Boolean {
        when (action) {
            "listen" -> {
                listenCallback = callbackContext
                val result = PluginResult(PluginResult.Status.NO_RESULT)
                result.keepCallback = true
                callbackContext.sendPluginResult(result)
                if (castContext != null || !playServicesAvailable) {
                    runOnUi { emitSessionState() }
                }
            }
            "initialize" -> runOnUi { initialize(callbackContext) }
            "requestSession" -> runOnUi { requestSession(callbackContext) }
            "endSession" -> runOnUi { endSession(args.optBoolean(0, true), callbackContext) }
            "loadMedia" -> runOnUi { loadMedia(args.optJSONObject(0) ?: JSONObject(), callbackContext) }
            "play" -> runOnUi { withMedia(callbackContext) { it.play(); callbackContext.success() } }
            "pause" -> runOnUi { withMedia(callbackContext) { it.pause(); callbackContext.success() } }
            "seek" -> runOnUi {
                withMedia(callbackContext) {
                    val seconds = args.optDouble(0, 0.0).coerceAtLeast(0.0)
                    it.seek(MediaSeekOptions.Builder().setPosition((seconds * 1000).toLong()).build())
                    callbackContext.success()
                }
            }
            "getPosition" -> runOnUi {
                val client = remoteMediaClient
                if (client == null) {
                    callbackContext.sendPluginResult(PluginResult(PluginResult.Status.OK, 0f))
                } else {
                    callbackContext.sendPluginResult(
                        PluginResult(PluginResult.Status.OK, (client.approximateStreamPosition / 1000.0).toFloat())
                    )
                }
            }
            else -> return false
        }
        return true
    }

    override fun onDestroy() {
        detach()
        if (routerCallbackRegistered) {
            MediaRouter.getInstance(cordova.activity).removeCallback(routerCallback)
            routerCallbackRegistered = false
        }
        castContext?.let {
            it.removeCastStateListener(castStateListener)
            it.sessionManager.removeSessionManagerListener(sessionListener, CastSession::class.java)
        }
        castContext = null
        listenCallback = null
        super.onDestroy()
    }

    private fun initialize(callback: CallbackContext) {
        val existing = castContext
        if (existing != null) {
            callback.success(currentSessionState())
            return
        }
        pendingInitCallbacks.add(callback)
        if (initializing) {
            return
        }
        initializing = true

        val activity = cordova.activity
        val availability = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(activity)
        if (availability != ConnectionResult.SUCCESS) {
            Log.w(TAG, "Google Play Services unavailable ($availability); Cast disabled")
            playServicesAvailable = false
            finishInit(null)
            return
        }
        playServicesAvailable = true

        try {
            CastContext.getSharedInstance(activity, ContextCompat.getMainExecutor(activity))
                .addOnSuccessListener { context -> finishInit(context) }
                .addOnFailureListener { e ->
                    Log.e(TAG, "CastContext init failed", e)
                    playServicesAvailable = false
                    finishInit(null)
                }
        } catch (e: Exception) {
            Log.e(TAG, "CastContext init threw", e)
            playServicesAvailable = false
            finishInit(null)
        }
    }

    private fun finishInit(context: CastContext?) {
        initializing = false
        if (context != null) {
            castContext = context
            context.addCastStateListener(castStateListener)
            context.sessionManager.addSessionManagerListener(sessionListener, CastSession::class.java)
            context.sessionManager.currentCastSession?.let { if (it.isConnected) attach(it) }
            startDiscovery(context)
        }
        val state = currentSessionState()
        pendingInitCallbacks.forEach { it.success(state) }
        pendingInitCallbacks.clear()
        emitSessionState()
    }

    private fun startDiscovery(context: CastContext) {
        if (routerCallbackRegistered) {
            return
        }
        val selector = context.mergedSelector ?: MediaRouteSelector.EMPTY
        val router = MediaRouter.getInstance(cordova.activity)
        router.addCallback(selector, routerCallback, MediaRouter.CALLBACK_FLAG_REQUEST_DISCOVERY)
        routerCallbackRegistered = true
    }

    private fun castRouteCount(): Int {
        val context = castContext ?: return 0
        val selector = context.mergedSelector ?: return 0
        return MediaRouter.getInstance(cordova.activity).routes.count { it.matchesSelector(selector) }
    }

    private fun attach(session: CastSession) {
        val client = session.remoteMediaClient
        if (client !== remoteMediaClient) {
            remoteMediaClient?.unregisterCallback(mediaCallback)
            remoteMediaClient = client
            client?.registerCallback(mediaCallback)
        }
        emitSessionState()
        emitMediaStatus()
    }

    private fun detach() {
        remoteMediaClient?.unregisterCallback(mediaCallback)
        remoteMediaClient = null
        emitSessionState()
    }

    private fun requestSession(callback: CallbackContext) {
        val context = castContext
        if (context == null) {
            callback.error("Cast is not available on this device")
            return
        }
        val activity = cordova.activity
        try {
            val selector = context.mergedSelector ?: MediaRouteSelector.EMPTY
            if (context.sessionManager.currentCastSession?.isConnected == true) {
                MediaRouteControllerDialog(activity).show()
            } else {
                MediaRouteChooserDialog(activity).apply {
                    routeSelector = selector
                }.show()
            }
            callback.success()
        } catch (e: Exception) {
            Log.e(TAG, "Could not open the Cast device picker", e)
            callback.error(e.message ?: "Could not open the Cast device picker")
        }
    }

    private fun endSession(stopReceiver: Boolean, callback: CallbackContext) {
        val context = castContext
        if (context == null) {
            callback.error("Cast is not available on this device")
            return
        }
        context.sessionManager.endCurrentSession(stopReceiver)
        callback.success()
    }

    private fun loadMedia(media: JSONObject, callback: CallbackContext) {
        withMedia(callback) { client ->
            val url = media.optString("url", "")
            if (url.isEmpty()) {
                callback.error("loadMedia requires a url")
                return@withMedia
            }
            val metadata = MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK).apply {
                putString(MediaMetadata.KEY_TITLE, media.optString("title", ""))
                putString(MediaMetadata.KEY_ARTIST, media.optString("artist", ""))
            }
            val info = MediaInfo.Builder(url)
                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                .setContentType(media.optString("contentType", "audio/mpeg"))
                .setMetadata(metadata)
                .apply {
                    val duration = media.optDouble("duration", 0.0)
                    if (duration > 0) setStreamDuration((duration * 1000).toLong())
                }
                .build()
            val request = MediaLoadRequestData.Builder()
                .setMediaInfo(info)
                .setAutoplay(media.optBoolean("autoplay", true))
                .setCurrentTime((media.optDouble("position", 0.0).coerceAtLeast(0.0) * 1000).toLong())
                .build()

            client.load(request).setResultCallback { result ->
                if (result.status.isSuccess) {
                    callback.success()
                } else {
                    callback.error("Load failed: ${result.status.statusCode} ${result.status.statusMessage ?: ""}".trim())
                }
            }
        }
    }

    private inline fun withMedia(callback: CallbackContext, block: (RemoteMediaClient) -> Unit) {
        val client = remoteMediaClient
        if (client == null) {
            callback.error("No Cast session")
            return
        }
        try {
            block(client)
        } catch (e: Exception) {
            Log.e(TAG, "Cast media call failed", e)
            callback.error(e.message ?: "Cast media call failed")
        }
    }

    private fun currentSessionState(): JSONObject {
        val context = castContext
        val state = context?.castState ?: CastState.NO_DEVICES_AVAILABLE
        val session = context?.sessionManager?.currentCastSession
        val connected = state == CastState.CONNECTED && session?.isConnected == true
        return CastEvents.sessionState(
            available = context != null && (state != CastState.NO_DEVICES_AVAILABLE || castRouteCount() > 0),
            connected = connected,
            connecting = state == CastState.CONNECTING,
            deviceName = if (connected) session?.castDevice?.friendlyName else null
        )
    }

    private fun emitSessionState() = emit(currentSessionState())

    private fun emitMediaStatus() {
        val client = remoteMediaClient ?: return
        emit(
            CastEvents.mediaStatus(
                client.mediaStatus,
                client.approximateStreamPosition / 1000.0,
                client.streamDuration / 1000.0
            )
        )
    }

    private fun emit(payload: JSONObject) {
        val callback = listenCallback ?: return
        val result = PluginResult(PluginResult.Status.OK, payload)
        result.keepCallback = true
        callback.sendPluginResult(result)
    }

    private fun runOnUi(block: () -> Unit) = cordova.activity.runOnUiThread(block)

    companion object {
        private const val TAG = "NaCast"
    }
}
