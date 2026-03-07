package com.seowibe.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.View
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView
  private lateinit var progressBar: ProgressBar
  private lateinit var filePickerLauncher: ActivityResultLauncher<Intent>
  private var filePathCallback: ValueCallback<Array<Uri>>? = null
  private var apkDownloadId: Long = -1L
  private var updateCheckStarted = false
  private val updatePrefs by lazy { getSharedPreferences(PREF_UPDATES, Context.MODE_PRIVATE) }
  private val authPrefs by lazy { getSharedPreferences(PREF_AUTH, Context.MODE_PRIVATE) }
  private val allowedHosts by lazy {
    val host = Uri.parse(getString(R.string.base_url)).host?.lowercase(Locale.ROOT).orEmpty()
    setOf(host, "127.0.0.1", "localhost")
  }

  private data class ApkRelease(
    val versionName: String,
    val versionCode: Int,
    val releasedAt: String,
    val summary: String,
    val notes: String,
    val downloadUrl: String,
  )

  private inner class SeoWibeJsBridge {
    @JavascriptInterface
    fun updateAuth(token: String?, lang: String?) {
      persistAuthSnapshot(token = token, lang = lang)
      syncCookieSnapshot()
      scheduleBackgroundNotifications(runNow = true)
    }
  }

  private val downloadReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
      val doneId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
      if (doneId <= 0L) return
      val activeId = updatePrefs.getLong(PREF_APK_DOWNLOAD_ID, -1L)
      if (doneId != activeId) return
      onApkDownloaded(doneId)
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.mainWebView)
    progressBar = findViewById(R.id.pageProgress)
    apkDownloadId = updatePrefs.getLong(PREF_APK_DOWNLOAD_ID, -1L)

    filePickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
      val callback = filePathCallback
      filePathCallback = null
      if (callback == null) return@registerForActivityResult
      if (result.resultCode == RESULT_OK) {
        val data = result.data
        val uris = when {
          data == null -> emptyArray()
          data.clipData != null -> {
            val clip = data.clipData!!
            Array(clip.itemCount) { index -> clip.getItemAt(index).uri }
          }
          data.data != null -> arrayOf(data.data!!)
          else -> emptyArray()
        }
        callback.onReceiveValue(uris)
      } else {
        callback.onReceiveValue(null)
      }
    }

    configureWebView()
    registerDownloadReceiver()
    requestNotificationPermissionIfNeeded()
    scheduleBackgroundNotifications(runNow = true)

    onBackPressedDispatcher.addCallback(
      this,
      object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
          if (webView.canGoBack()) {
            webView.goBack()
          } else {
            finish()
          }
        }
      }
    )

    webView.loadUrl(getString(R.string.base_url))
  }

  override fun onResume() {
    super.onResume()
    syncCookieSnapshot()
    scheduleBackgroundNotifications(runNow = true)
  }

  private fun registerDownloadReceiver() {
    val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      registerReceiver(downloadReceiver, filter)
    }
  }

  private fun requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    if (granted) return
    ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFICATIONS)
  }

  private fun scheduleBackgroundNotifications(runNow: Boolean = false) {
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()
    val manager = WorkManager.getInstance(applicationContext)
    val periodic = PeriodicWorkRequestBuilder<BackgroundNotifyWorker>(15, TimeUnit.MINUTES)
      .setConstraints(constraints)
      .addTag(WORK_BG_NOTIF_PERIODIC)
      .build()
    manager.enqueueUniquePeriodicWork(
      WORK_BG_NOTIF_PERIODIC,
      ExistingPeriodicWorkPolicy.UPDATE,
      periodic,
    )
    if (runNow) {
      val immediate = OneTimeWorkRequestBuilder<BackgroundNotifyWorker>()
        .setConstraints(constraints)
        .setInitialDelay(20, TimeUnit.SECONDS)
        .addTag(WORK_BG_NOTIF_IMMEDIATE)
        .build()
      manager.enqueueUniqueWork(
        WORK_BG_NOTIF_IMMEDIATE,
        ExistingWorkPolicy.REPLACE,
        immediate,
      )
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  private fun configureWebView() {
    val cookieManager = CookieManager.getInstance()
    cookieManager.setAcceptCookie(true)
    cookieManager.setAcceptThirdPartyCookies(webView, true)

    val settings = webView.settings
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.databaseEnabled = true
    settings.allowFileAccess = false
    settings.allowContentAccess = true
    settings.loadsImagesAutomatically = true
    settings.mediaPlaybackRequiresUserGesture = false
    settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      settings.safeBrowsingEnabled = true
    }
    settings.userAgentString = settings.userAgentString + " SEO_WIBE_ANDROID_APP/1.2"
    webView.addJavascriptInterface(SeoWibeJsBridge(), "SeoWibeApp")

    webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return false
        val host = uri.host?.lowercase(Locale.ROOT).orEmpty()
        if (host.isNotBlank() && allowedHosts.contains(host)) {
          return false
        }
        return try {
          startActivity(Intent(Intent.ACTION_VIEW, uri))
          true
        } catch (_: Exception) {
          false
        }
      }

      override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        progressBar.visibility = View.VISIBLE
        super.onPageStarted(view, url, favicon)
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        injectAuthBridgeScript()
        syncCookieSnapshot()
        scheduleBackgroundNotifications(runNow = true)
        if (!updateCheckStarted) {
          updateCheckStarted = true
          checkForApkUpdates()
        }
      }
    }

    webView.webChromeClient = object : WebChromeClient() {
      override fun onProgressChanged(view: WebView?, newProgress: Int) {
        progressBar.progress = newProgress
        progressBar.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
      }

      override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?,
      ): Boolean {
        this@MainActivity.filePathCallback?.onReceiveValue(null)
        this@MainActivity.filePathCallback = filePathCallback
        val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "*/*"
          putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        return try {
          filePickerLauncher.launch(intent)
          true
        } catch (_: Exception) {
          this@MainActivity.filePathCallback = null
          false
        }
      }
    }
  }

  private fun injectAuthBridgeScript() {
    val js = """
      (function() {
        try {
          function push() {
            try {
              var token = localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('token_shadow') || '';
              var lang = localStorage.getItem('ui_lang') || 'ru';
              if (window.SeoWibeApp && typeof window.SeoWibeApp.updateAuth === 'function') {
                window.SeoWibeApp.updateAuth(String(token || ''), String(lang || 'ru'));
              }
            } catch (e) {}
          }
          if (!window.__seoWibeAndroidBridgeInstalled) {
            window.__seoWibeAndroidBridgeInstalled = true;
            window.__seoWibePushAuthSnapshot = push;
            push();
            window.setInterval(push, 12000);
            document.addEventListener('visibilitychange', push, { passive: true });
          } else if (window.__seoWibePushAuthSnapshot) {
            window.__seoWibePushAuthSnapshot();
          } else {
            push();
          }
        } catch (e) {}
      })();
    """.trimIndent()
    try {
      webView.evaluateJavascript(js, null)
    } catch (_: Exception) {
    }
  }

  private fun persistAuthSnapshot(token: String?, lang: String?) {
    val cleanedToken = (token ?: "").trim().trim('"')
    val cleanedLang = (lang ?: "").trim().trim('"')
    authPrefs.edit()
      .putString(PREF_AUTH_TOKEN, cleanedToken)
      .putString(PREF_AUTH_LANG, if (cleanedLang.isBlank()) "ru" else cleanedLang)
      .putString(PREF_AUTH_BASE_ORIGIN, baseOrigin())
      .apply()
  }

  private fun syncCookieSnapshot() {
    try {
      val cookie = CookieManager.getInstance().getCookie(getString(R.string.base_url)) ?: ""
      authPrefs.edit()
        .putString(PREF_AUTH_COOKIE, cookie)
        .putString(PREF_AUTH_BASE_ORIGIN, baseOrigin())
        .apply()
    } catch (_: Exception) {
    }
  }

  private fun checkForApkUpdates() {
    Thread {
      val release = fetchLatestApkRelease() ?: return@Thread
      val isNew = isRemoteBuildNewer(release.versionCode, release.versionName)
      if (!isNew) return@Thread
      val deferredCode = updatePrefs.getInt(PREF_DEFERRED_CODE, -1)
      val deferredName = updatePrefs.getString(PREF_DEFERRED_NAME, "") ?: ""
      if (deferredCode == release.versionCode && deferredName == release.versionName) return@Thread
      runOnUiThread {
        if (isFinishing || isDestroyed) return@runOnUiThread
        showUpdateDialog(release)
      }
    }.start()
  }

  private fun fetchLatestApkRelease(): ApkRelease? {
    val endpoint = "${baseOrigin()}/api/mobile/apk/latest?ts=${System.currentTimeMillis()}"
    var conn: HttpURLConnection? = null
    return try {
      conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 12000
        readTimeout = 12000
        setRequestProperty("Accept", "application/json")
      }
      val code = conn.responseCode
      if (code !in 200..299) return null
      val body = conn.inputStream.bufferedReader().use { it.readText() }
      val json = JSONObject(body)
      val versionName = json.optString("version", "").trim()
      val versionCode = json.optInt("version_code", 0)
      val downloadUrl = resolveDownloadUrl(json.optString("android_download_url", ""))
      if (versionName.isBlank() || downloadUrl.isBlank()) return null
      ApkRelease(
        versionName = versionName,
        versionCode = versionCode,
        releasedAt = json.optString("released_at", "").trim(),
        summary = json.optString("summary", "").trim(),
        notes = json.optString("notes", "").trim(),
        downloadUrl = downloadUrl,
      )
    } catch (_: Exception) {
      null
    } finally {
      conn?.disconnect()
    }
  }

  private fun showUpdateDialog(release: ApkRelease) {
    val title = getString(R.string.update_title)
    val details = buildString {
      append(getString(R.string.update_message, release.versionName))
      if (release.releasedAt.isNotBlank()) append("\n${release.releasedAt}")
      if (release.summary.isNotBlank()) append("\n\n${release.summary}")
      if (release.notes.isNotBlank()) append("\n\n${release.notes}")
    }
    AlertDialog.Builder(this)
      .setTitle(title)
      .setMessage(details)
      .setCancelable(true)
      .setNegativeButton(R.string.update_later) { _, _ ->
        deferUpdate(release)
      }
      .setPositiveButton(R.string.update_install) { _, _ ->
        updatePrefs.edit()
          .remove(PREF_DEFERRED_CODE)
          .remove(PREF_DEFERRED_NAME)
          .apply()
        enqueueApkDownload(release)
      }
      .show()
  }

  private fun deferUpdate(release: ApkRelease) {
    updatePrefs.edit()
      .putInt(PREF_DEFERRED_CODE, release.versionCode)
      .putString(PREF_DEFERRED_NAME, release.versionName)
      .apply()
  }

  private fun enqueueApkDownload(release: ApkRelease) {
    val manager = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
    val fileName = "seo-wibe-mobile-${release.versionName.replace(Regex("[^0-9A-Za-z._-]"), "_")}.apk"
    val request = DownloadManager.Request(Uri.parse(release.downloadUrl))
      .setTitle(getString(R.string.update_download_title, release.versionName))
      .setDescription(getString(R.string.update_download_description))
      .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
      .setAllowedOverMetered(true)
      .setAllowedOverRoaming(true)
      .setMimeType("application/vnd.android.package-archive")
      .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)

    apkDownloadId = manager.enqueue(request)
    updatePrefs.edit().putLong(PREF_APK_DOWNLOAD_ID, apkDownloadId).apply()
    Toast.makeText(this, getString(R.string.update_download_started), Toast.LENGTH_SHORT).show()
  }

  private fun onApkDownloaded(downloadId: Long) {
    updatePrefs.edit().remove(PREF_APK_DOWNLOAD_ID).apply()
    apkDownloadId = -1L
    val manager = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
    val query = DownloadManager.Query().setFilterById(downloadId)
    manager.query(query).use { cursor ->
      if (cursor == null || !cursor.moveToFirst()) return
      val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      if (status != DownloadManager.STATUS_SUCCESSFUL) {
        Toast.makeText(this, getString(R.string.update_download_failed), Toast.LENGTH_LONG).show()
        return
      }
    }
    val uri = manager.getUriForDownloadedFile(downloadId)
    if (uri == null) {
      Toast.makeText(this, getString(R.string.update_download_failed), Toast.LENGTH_LONG).show()
      return
    }
    promptInstallApk(uri)
  }

  private fun promptInstallApk(uri: Uri) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
      Toast.makeText(this, getString(R.string.update_allow_unknown_sources), Toast.LENGTH_LONG).show()
      val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
        data = Uri.parse("package:$packageName")
      }
      try {
        startActivity(settingsIntent)
      } catch (_: Exception) {
      }
      return
    }
    val installIntent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    try {
      startActivity(installIntent)
    } catch (_: Exception) {
      Toast.makeText(this, getString(R.string.update_install_failed), Toast.LENGTH_LONG).show()
    }
  }

  private fun resolveDownloadUrl(raw: String): String {
    val value = raw.trim()
    if (value.isBlank()) return ""
    return if (value.startsWith("http://") || value.startsWith("https://")) value else "${baseOrigin()}${if (value.startsWith("/")) value else "/$value"}"
  }

  private fun baseOrigin(): String {
    val base = Uri.parse(getString(R.string.base_url))
    val scheme = base.scheme ?: "http"
    val host = base.host ?: return ""
    val port = if (base.port > 0) ":${base.port}" else ""
    return "$scheme://$host$port"
  }

  private fun isRemoteBuildNewer(remoteCode: Int, remoteName: String): Boolean {
    if (remoteCode > 0 && remoteCode > BuildConfig.VERSION_CODE) return true
    return compareVersionNames(remoteName, BuildConfig.VERSION_NAME) > 0
  }

  private fun compareVersionNames(a: String, b: String): Int {
    val pa = a.split('.').mapNotNull { it.toIntOrNull() }
    val pb = b.split('.').mapNotNull { it.toIntOrNull() }
    val max = maxOf(pa.size, pb.size)
    for (i in 0 until max) {
      val av = pa.getOrNull(i) ?: 0
      val bv = pb.getOrNull(i) ?: 0
      if (av != bv) return av.compareTo(bv)
    }
    return 0
  }

  override fun onDestroy() {
    super.onDestroy()
    try {
      unregisterReceiver(downloadReceiver)
    } catch (_: Exception) {
    }
    filePathCallback?.onReceiveValue(null)
    filePathCallback = null
  }

  companion object {
    private const val REQ_NOTIFICATIONS = 1201
    private const val PREF_UPDATES = "seo_wibe_apk_updates"
    private const val PREF_AUTH = "seo_wibe_mobile_auth"
    private const val PREF_DEFERRED_CODE = "deferred_update_code"
    private const val PREF_DEFERRED_NAME = "deferred_update_name"
    private const val PREF_APK_DOWNLOAD_ID = "apk_download_id"
    private const val PREF_AUTH_TOKEN = "auth_token"
    private const val PREF_AUTH_COOKIE = "auth_cookie"
    private const val PREF_AUTH_LANG = "auth_lang"
    private const val PREF_AUTH_BASE_ORIGIN = "base_origin"
    private const val WORK_BG_NOTIF_PERIODIC = "seo_wibe_bg_notif_periodic"
    private const val WORK_BG_NOTIF_IMMEDIATE = "seo_wibe_bg_notif_immediate"
  }
}
