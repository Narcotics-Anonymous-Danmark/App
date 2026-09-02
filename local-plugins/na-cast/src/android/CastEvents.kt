package dk.nadanmark.cast

import com.google.android.gms.cast.MediaStatus
import org.json.JSONObject

/**
 * Builds the JSON payloads of the two event types the JS contract knows about.
 * Kept separate from the plugin so the mapping is trivially portable (Flutter
 * EventChannel payloads are the same maps).
 */
object CastEvents {

    fun sessionState(available: Boolean, connected: Boolean, connecting: Boolean, deviceName: String?): JSONObject =
        JSONObject()
            .put("type", "session")
            .put("available", available)
            .put("connected", connected)
            .put("connecting", connecting)
            .put("deviceName", deviceName ?: JSONObject.NULL)

    fun mediaStatus(status: MediaStatus?, positionSeconds: Double, durationSeconds: Double): JSONObject =
        JSONObject()
            .put("type", "media")
            .put("playerState", playerStateName(status?.playerState ?: MediaStatus.PLAYER_STATE_UNKNOWN))
            .put(
                "idleReason",
                if (status != null && status.playerState == MediaStatus.PLAYER_STATE_IDLE)
                    idleReasonName(status.idleReason)
                else JSONObject.NULL
            )
            .put("position", positionSeconds.coerceAtLeast(0.0))
            .put("duration", durationSeconds.coerceAtLeast(0.0))

    fun playerStateName(state: Int): String = when (state) {
        MediaStatus.PLAYER_STATE_IDLE -> "IDLE"
        MediaStatus.PLAYER_STATE_PLAYING -> "PLAYING"
        MediaStatus.PLAYER_STATE_PAUSED -> "PAUSED"
        MediaStatus.PLAYER_STATE_BUFFERING -> "BUFFERING"
        MediaStatus.PLAYER_STATE_LOADING -> "LOADING"
        else -> "UNKNOWN"
    }

    fun idleReasonName(reason: Int): String = when (reason) {
        MediaStatus.IDLE_REASON_FINISHED -> "FINISHED"
        MediaStatus.IDLE_REASON_CANCELED -> "CANCELLED"
        MediaStatus.IDLE_REASON_INTERRUPTED -> "INTERRUPTED"
        MediaStatus.IDLE_REASON_ERROR -> "ERROR"
        else -> "NONE"
    }
}
