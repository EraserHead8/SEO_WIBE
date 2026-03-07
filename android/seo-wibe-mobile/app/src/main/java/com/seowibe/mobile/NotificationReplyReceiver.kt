package com.seowibe.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class NotificationReplyReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != BackgroundNotifyWorker.ACTION_REPLY_CHAT) return
    val threadId = intent.getIntExtra(BackgroundNotifyWorker.EXTRA_THREAD_ID, 0)
    if (threadId <= 0) return
    val remoteInput = RemoteInput.getResultsFromIntent(intent)
    val text = (remoteInput?.getCharSequence(BackgroundNotifyWorker.KEY_TEXT_REPLY)?.toString() ?: "").trim()
    if (text.isBlank()) return
    val notificationId = intent.getIntExtra(BackgroundNotifyWorker.EXTRA_NOTIFICATION_ID, 0)
    val pendingResult = goAsync()
    Thread {
      try {
        val sent = sendReply(context, threadId, text)
        if (sent && notificationId > 0) {
          NotificationManagerCompat.from(context).cancel(notificationId)
        }
      } catch (_: Exception) {
      } finally {
        try {
          BackgroundNotifyWorker.enqueueSoon(context, 8)
        } catch (_: Exception) {
        }
        pendingResult.finish()
      }
    }.start()
  }

  private fun sendReply(context: Context, threadId: Int, text: String): Boolean {
    val prefs = context.getSharedPreferences(BackgroundNotifyWorker.PREF_AUTH, Context.MODE_PRIVATE)
    val token = (prefs.getString(BackgroundNotifyWorker.PREF_AUTH_TOKEN, "") ?: "").trim()
    val cookie = (prefs.getString(BackgroundNotifyWorker.PREF_AUTH_COOKIE, "") ?: "").trim()
    val baseOrigin = (prefs.getString(BackgroundNotifyWorker.PREF_AUTH_BASE_ORIGIN, "") ?: "").trim()
      .ifBlank { inferBaseOrigin(context) }
    if (baseOrigin.isBlank() || (token.isBlank() && cookie.isBlank())) return false

    var conn: HttpURLConnection? = null
    return try {
      val endpoint = "$baseOrigin/api/social/chat/messages/$threadId"
      val body = JSONObject().put("text", text).toString()
      conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15000
        readTimeout = 15000
        doOutput = true
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Content-Type", "application/json")
        if (token.isNotBlank()) setRequestProperty("Authorization", "Bearer $token")
        if (cookie.isNotBlank()) setRequestProperty("Cookie", cookie)
      }
      conn.outputStream.use { out ->
        out.write(body.toByteArray(Charsets.UTF_8))
      }
      val code = conn.responseCode
      code in 200..299
    } catch (_: Exception) {
      false
    } finally {
      conn?.disconnect()
    }
  }

  private fun inferBaseOrigin(context: Context): String {
    val base = android.net.Uri.parse(context.getString(R.string.base_url))
    val scheme = base.scheme ?: "http"
    val host = base.host ?: return ""
    val port = if (base.port > 0) ":${base.port}" else ""
    return "$scheme://$host$port"
  }
}
