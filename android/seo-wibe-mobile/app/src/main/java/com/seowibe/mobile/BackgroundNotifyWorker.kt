package com.seowibe.mobile

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class BackgroundNotifyWorker(
  appContext: Context,
  params: WorkerParameters,
) : Worker(appContext, params) {

  override fun doWork(): Result {
    return try {
      ensureNotificationChannel()
      val prefs = applicationContext.getSharedPreferences(PREF_AUTH, Context.MODE_PRIVATE)
      val token = (prefs.getString(PREF_AUTH_TOKEN, "") ?: "").trim()
      val cookie = (prefs.getString(PREF_AUTH_COOKIE, "") ?: "").trim()
      val baseOrigin = (prefs.getString(PREF_AUTH_BASE_ORIGIN, "") ?: "").trim().ifBlank {
        inferBaseOrigin()
      }
      if (baseOrigin.isBlank() || (token.isBlank() && cookie.isBlank())) {
        return Result.success()
      }

      val lastId = prefs.getLong(PREF_LAST_NOTIFIED_ID, 0L)
      val endpoint = "$baseOrigin/api/social/notifications?since_id=$lastId&limit=80"
      val payload = fetchJson(endpoint, token, cookie) ?: return Result.retry()
      val rows = payload.optJSONArray("rows") ?: JSONArray()
      if (rows.length() <= 0) return Result.success()

      val maxSeenId = maxNotificationId(rows)
      if (lastId <= 0L) {
        // First sync anchors on latest notification to avoid flooding old history.
        prefs.edit().putLong(PREF_LAST_NOTIFIED_ID, maxSeenId).apply()
        return Result.success()
      }

      var newestId = lastId
      for (i in 0 until rows.length()) {
        val row = rows.optJSONObject(i) ?: continue
        val id = row.optLong("id", 0L)
        if (id <= lastId) continue
        postNotification(row, id)
        if (id > newestId) newestId = id
      }
      if (newestId > lastId) {
        prefs.edit().putLong(PREF_LAST_NOTIFIED_ID, newestId).apply()
      }
      Result.success()
    } catch (_: Exception) {
      Result.retry()
    }
  }

  private fun fetchJson(endpoint: String, token: String, cookie: String): JSONObject? {
    var conn: HttpURLConnection? = null
    return try {
      conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 12000
        readTimeout = 12000
        setRequestProperty("Accept", "application/json")
        if (token.isNotBlank()) setRequestProperty("Authorization", "Bearer $token")
        if (cookie.isNotBlank()) setRequestProperty("Cookie", cookie)
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

  private fun postNotification(row: JSONObject, id: Long) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val granted = ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
      if (!granted) return
    }
    val titleRaw = row.optString("title", "").trim()
    val bodyRaw = row.optString("body", "").trim()
    val kind = row.optString("kind", "").trim().lowercase(Locale.ROOT)
    val title = if (titleRaw.isNotBlank()) titleRaw else kindFallbackTitle(kind)
    val body = if (bodyRaw.isNotBlank()) bodyRaw else "SEO WIBE"

    val intent = Intent(applicationContext, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      data = Uri.parse("seo-wibe://notification/$id")
      putExtra("open_social", true)
    }
    val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    val pendingIntent = PendingIntent.getActivity(
      applicationContext,
      id.toInt(),
      intent,
      pendingIntentFlags,
    )

    val notification = NotificationCompat.Builder(applicationContext, CHANNEL_SOCIAL)
      .setSmallIcon(android.R.drawable.stat_notify_chat)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setContentIntent(pendingIntent)
      .build()

    NotificationManagerCompat.from(applicationContext).notify(id.toInt(), notification)
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
      enableLights(true)
      enableVibration(true)
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

  companion object {
    private const val PREF_AUTH = "seo_wibe_mobile_auth"
    private const val PREF_AUTH_TOKEN = "auth_token"
    private const val PREF_AUTH_COOKIE = "auth_cookie"
    private const val PREF_AUTH_BASE_ORIGIN = "base_origin"
    private const val PREF_LAST_NOTIFIED_ID = "last_notified_id"
    private const val CHANNEL_SOCIAL = "seo_wibe_social_notifications"
  }
}
