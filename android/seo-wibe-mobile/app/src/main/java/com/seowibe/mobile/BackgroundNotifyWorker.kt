package com.seowibe.mobile

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.TimeUnit

class BackgroundNotifyWorker(
  appContext: Context,
  params: WorkerParameters,
) : Worker(appContext, params) {

  override fun doWork(): Result {
    var result: Result
    try {
      ensureNotificationChannel()
      val auth = readAuthSnapshot()
      if (auth.baseOrigin.isBlank() || (auth.token.isBlank() && auth.cookie.isBlank())) {
        refreshBadgeSummary(0)
        return Result.success()
      }

      val prefs = applicationContext.getSharedPreferences(PREF_AUTH, Context.MODE_PRIVATE)
      val lastId = prefs.getLong(PREF_LAST_NOTIFIED_ID, 0L)
      val endpoint = "${auth.baseOrigin}/api/social/notifications?since_id=$lastId&limit=80"
      val payload = fetchJson(endpoint, auth) ?: return Result.retry()
      val unreadTotal = payload.optInt("unread", 0).coerceAtLeast(0)
      val rows = payload.optJSONArray("rows") ?: JSONArray()
      val maxSeenId = maxNotificationId(rows)

      if (lastId <= 0L) {
        // First sync anchors on latest notification to avoid flooding old history.
        if (maxSeenId > 0L) prefs.edit().putLong(PREF_LAST_NOTIFIED_ID, maxSeenId).apply()
        refreshBadgeSummary(unreadTotal)
        return Result.success()
      }

      var newestId = lastId
      for (i in 0 until rows.length()) {
        val row = rows.optJSONObject(i) ?: continue
        val id = row.optLong("id", 0L)
        if (id <= lastId) continue
        postNotification(row, id, unreadTotal)
        if (id > newestId) newestId = id
      }
      if (newestId > lastId) {
        prefs.edit().putLong(PREF_LAST_NOTIFIED_ID, newestId).apply()
      }
      refreshBadgeSummary(unreadTotal)
      result = Result.success()
    } catch (_: Exception) {
      result = Result.retry()
    } finally {
      enqueueSoon(applicationContext, 120)
    }
    return result
  }

  private data class AuthSnapshot(
    val token: String,
    val cookie: String,
    val baseOrigin: String,
  )

  private fun readAuthSnapshot(): AuthSnapshot {
    val prefs = applicationContext.getSharedPreferences(PREF_AUTH, Context.MODE_PRIVATE)
    val token = (prefs.getString(PREF_AUTH_TOKEN, "") ?: "").trim()
    val cookie = (prefs.getString(PREF_AUTH_COOKIE, "") ?: "").trim()
    val baseOrigin = (prefs.getString(PREF_AUTH_BASE_ORIGIN, "") ?: "").trim().ifBlank {
      inferBaseOrigin()
    }
    return AuthSnapshot(token = token, cookie = cookie, baseOrigin = baseOrigin)
  }

  private fun fetchJson(endpoint: String, auth: AuthSnapshot): JSONObject? {
    var conn: HttpURLConnection? = null
    return try {
      conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 12000
        readTimeout = 12000
        setRequestProperty("Accept", "application/json")
        if (auth.token.isNotBlank()) setRequestProperty("Authorization", "Bearer ${auth.token}")
        if (auth.cookie.isNotBlank()) setRequestProperty("Cookie", auth.cookie)
      }
      val code = conn.responseCode
      if (code == 401 || code == 403) return JSONObject()
      if (code !in 200..299) return null
      val body = conn.inputStream.bufferedReader().use { it.readText() }
      JSONObject(body)
    } catch (_: Exception) {
      null
    } finally {
      conn?.disconnect()
    }
  }

  private fun maxNotificationId(rows: JSONArray): Long {
    var maxId = 0L
    for (i in 0 until rows.length()) {
      val row = rows.optJSONObject(i) ?: continue
      val id = row.optLong("id", 0L)
      if (id > maxId) maxId = id
    }
    return maxId
  }

  private fun postNotification(row: JSONObject, id: Long, unreadCount: Int) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val granted = ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
      if (!granted) return
    }
    val titleRaw = row.optString("title", "").trim()
    val bodyRaw = row.optString("body", "").trim()
    val kind = row.optString("kind", "").trim().lowercase(Locale.ROOT)
    val payload = row.optJSONObject("payload") ?: JSONObject()
    val threadId = payload.optInt("thread_id", 0)
    val title = if (titleRaw.isNotBlank()) titleRaw else kindFallbackTitle(kind)
    val body = if (bodyRaw.isNotBlank()) bodyRaw else "SEO WIBE"

    val openIntent = Intent(applicationContext, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      data = Uri.parse("seo-wibe://notification/$id")
      putExtra("open_social", true)
      if (threadId > 0) putExtra("open_social_thread_id", threadId)
    }
    val openFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    val openPendingIntent = PendingIntent.getActivity(
      applicationContext,
      requestCodeFrom(id, 101),
      openIntent,
      openFlags,
    )

    val builder = NotificationCompat.Builder(applicationContext, CHANNEL_SOCIAL)
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setContentIntent(openPendingIntent)
      .setGroup(NOTIFICATION_GROUP_SOCIAL)
      .setNumber(unreadCount.coerceAtLeast(0))
      .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)

    if ((kind.contains("chat") || kind.contains("message")) && threadId > 0) {
      val replyIntent = Intent(applicationContext, NotificationReplyReceiver::class.java).apply {
        action = ACTION_REPLY_CHAT
        putExtra(EXTRA_THREAD_ID, threadId)
        putExtra(EXTRA_NOTIFICATION_ID, requestCodeFrom(id, 11))
      }
      val replyFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      val replyPendingIntent = PendingIntent.getBroadcast(
        applicationContext,
        requestCodeFrom(id, 202),
        replyIntent,
        replyFlags,
      )
      val remoteInput = RemoteInput.Builder(KEY_TEXT_REPLY)
        .setLabel("Ответить")
        .build()
      val replyAction = NotificationCompat.Action.Builder(
        android.R.drawable.ic_menu_send,
        "Ответить",
        replyPendingIntent,
      )
        .addRemoteInput(remoteInput)
        .setAllowGeneratedReplies(true)
        .build()
      builder.addAction(replyAction)
    }

    NotificationManagerCompat.from(applicationContext).notify(requestCodeFrom(id, 11), builder.build())
  }

  private fun refreshBadgeSummary(unreadCount: Int) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val granted = ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
      if (!granted) return
    }
    val manager = NotificationManagerCompat.from(applicationContext)
    val safeUnread = unreadCount.coerceAtLeast(0)
    if (safeUnread <= 0) {
      manager.cancel(NOTIFICATION_ID_SUMMARY)
      return
    }

    val openIntent = Intent(applicationContext, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("open_social", true)
    }
    val openFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    val openPendingIntent = PendingIntent.getActivity(
      applicationContext,
      9091,
      openIntent,
      openFlags,
    )

    val summary = NotificationCompat.Builder(applicationContext, CHANNEL_SOCIAL)
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle("SEO WIBE")
      .setContentText("Новых уведомлений: $safeUnread")
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .setGroup(NOTIFICATION_GROUP_SOCIAL)
      .setGroupSummary(true)
      .setNumber(safeUnread)
      .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
      .setContentIntent(openPendingIntent)
      .build()

    manager.notify(NOTIFICATION_ID_SUMMARY, summary)
  }

  private fun kindFallbackTitle(kind: String): String {
    return when {
      kind.contains("task") -> "SEO WIBE • Задачи"
      kind.contains("calendar") || kind.contains("reminder") -> "SEO WIBE • Календарь"
      kind.contains("chat") || kind.contains("message") -> "SEO WIBE • Чат"
      else -> "SEO WIBE"
    }
  }

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    val exists = manager.getNotificationChannel(CHANNEL_SOCIAL) != null
    if (exists) return
    val channel = NotificationChannel(
      CHANNEL_SOCIAL,
      "SEO WIBE Notifications",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Сообщения чата, задачи и напоминания"
      setShowBadge(true)
      enableLights(true)
      enableVibration(true)
      lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
    }
    manager.createNotificationChannel(channel)
  }

  private fun inferBaseOrigin(): String {
    val base = Uri.parse(applicationContext.getString(R.string.base_url))
    val scheme = base.scheme ?: "http"
    val host = base.host ?: return ""
    val port = if (base.port > 0) ":${base.port}" else ""
    return "$scheme://$host$port"
  }

  private fun requestCodeFrom(id: Long, salt: Int): Int {
    val base = (id and 0x7FFFFFFF).toInt()
    return base xor salt
  }

  companion object {
    const val PREF_AUTH = "seo_wibe_mobile_auth"
    const val PREF_AUTH_TOKEN = "auth_token"
    const val PREF_AUTH_COOKIE = "auth_cookie"
    const val PREF_AUTH_BASE_ORIGIN = "base_origin"
    private const val PREF_LAST_NOTIFIED_ID = "last_notified_id"
    const val CHANNEL_SOCIAL = "seo_wibe_social_notifications"

    const val ACTION_REPLY_CHAT = "com.seowibe.mobile.ACTION_REPLY_CHAT"
    const val EXTRA_THREAD_ID = "extra_thread_id"
    const val EXTRA_NOTIFICATION_ID = "extra_notification_id"
    const val KEY_TEXT_REPLY = "key_text_reply"

    private const val WORK_BG_NOTIF_LOOP = "seo_wibe_bg_notif_loop"
    private const val NOTIFICATION_GROUP_SOCIAL = "seo_wibe_group_social"
    private const val NOTIFICATION_ID_SUMMARY = 9001

    fun enqueueSoon(context: Context, delaySeconds: Long = 20L) {
      val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
      val request = OneTimeWorkRequestBuilder<BackgroundNotifyWorker>()
        .setConstraints(constraints)
        .setInitialDelay(delaySeconds.coerceAtLeast(5), TimeUnit.SECONDS)
        .addTag(WORK_BG_NOTIF_LOOP)
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(
        WORK_BG_NOTIF_LOOP,
        ExistingWorkPolicy.REPLACE,
        request,
      )
    }
  }
}
