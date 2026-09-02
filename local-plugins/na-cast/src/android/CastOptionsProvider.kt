package dk.nadanmark.cast

import android.content.Context
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionProvider
import com.google.android.gms.cast.framework.media.CastMediaOptions
import com.google.android.gms.cast.framework.media.MediaIntentReceiver
import com.google.android.gms.cast.framework.media.NotificationOptions

/**
 * Cast SDK options. Registered in AndroidManifest.xml through plugin.xml as
 * `com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME`, so the SDK
 * instantiates it reflectively when [com.google.android.gms.cast.framework.CastContext]
 * is first created.
 *
 * - Receiver: the default media receiver (CC1AD845) unless the plugin variable
 *   CAST_RECEIVER_APP_ID says otherwise. It is read from the `na_cast_receiver_app_id`
 *   string resource so this class does not need to import the app's `R`.
 * - Notification: the SDK posts (and keeps a foreground service behind) its own media
 *   notification while casting. That is what keeps the process — and therefore the
 *   JS that drives the queue — alive while the screen is locked and no local audio
 *   plays. The JS side must not show music-controls2 at the same time.
 */
class CastOptionsProvider : OptionsProvider {

    override fun getCastOptions(context: Context): CastOptions {
        val notificationOptions = NotificationOptions.Builder()
            .setActions(
                listOf(
                    MediaIntentReceiver.ACTION_REWIND,
                    MediaIntentReceiver.ACTION_TOGGLE_PLAYBACK,
                    MediaIntentReceiver.ACTION_FORWARD,
                    MediaIntentReceiver.ACTION_STOP_CASTING
                ),
                intArrayOf(1, 3)
            )
            .setSkipStepMs(SKIP_STEP_MS)
            .apply { launchActivityClassName(context)?.let { setTargetActivityClassName(it) } }
            .build()

        val mediaOptions = CastMediaOptions.Builder()
            .setNotificationOptions(notificationOptions)
            .setMediaSessionEnabled(true)
            .build()

        return CastOptions.Builder()
            .setReceiverApplicationId(receiverAppId(context))
            .setCastMediaOptions(mediaOptions)
            .setStopReceiverApplicationWhenEndingSession(true)
            .build()
    }

    override fun getAdditionalSessionProviders(context: Context): List<SessionProvider>? = null

    companion object {
        private const val SKIP_STEP_MS = 15_000L

        fun receiverAppId(context: Context): String {
            val id = context.resources.getIdentifier("na_cast_receiver_app_id", "string", context.packageName)
            val value = if (id != 0) context.getString(id).trim() else ""
            return if (value.isEmpty()) CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID else value
        }

        private fun launchActivityClassName(context: Context): String? =
            context.packageManager.getLaunchIntentForPackage(context.packageName)?.component?.className
    }
}
