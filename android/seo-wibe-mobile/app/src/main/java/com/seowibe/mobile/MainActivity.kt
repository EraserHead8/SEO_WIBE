package com.seowibe.mobile

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ArrayAdapter
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.Spinner
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale

class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView
  private lateinit var navSpinner: Spinner
  private lateinit var progressBar: ProgressBar
  private lateinit var filePickerLauncher: ActivityResultLauncher<Intent>
  private var filePathCallback: ValueCallback<Array<Uri>>? = null
  private var initialRouteApplied = false
  private var isSpinnerInit = true
  private val allowedHosts by lazy {
    val host = Uri.parse(getString(R.string.base_url)).host?.lowercase(Locale.ROOT).orEmpty()
    setOf(host, "127.0.0.1", "localhost")
  }

  private data class MobileRoute(
    val title: String,
    val script: String,
  )

  private val routes by lazy {
    listOf(
      MobileRoute("Чат", "if(window.showTab){window.showTab('social');} if(window.switchSocialSubtab){window.switchSocialSubtab('chat');}"),
      MobileRoute("Задачи", "if(window.showTab){window.showTab('social');} if(window.switchSocialSubtab){window.switchSocialSubtab('tasks');}"),
      MobileRoute("Заметки", "if(window.showTab){window.showTab('social');} if(window.switchSocialSubtab){window.switchSocialSubtab('notes');}"),
      MobileRoute("Калькулятор", "if(window.showTab){window.showTab('social');} if(window.switchSocialSubtab){window.switchSocialSubtab('calculator');}"),
      MobileRoute("Календарь", "if(window.showTab){window.showTab('social');} if(window.switchSocialSubtab){window.switchSocialSubtab('calendar');}"),
      MobileRoute("Ответы на отзывы", "if(window.showTab){window.showTab('reviews');} if(window.switchReviewsSubtab){window.switchReviewsSubtab('reviews');}"),
      MobileRoute("Ответы на вопросы", "if(window.showTab){window.showTab('reviews');} if(window.switchReviewsSubtab){window.switchReviewsSubtab('questions');}"),
      MobileRoute("Профиль", "if(window.showTab){window.showTab('profile');}")
    )
  }

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.mainWebView)
    navSpinner = findViewById(R.id.navSpinner)
    progressBar = findViewById(R.id.pageProgress)
    val refreshButton: ImageButton = findViewById(R.id.refreshButton)

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

    setupSpinner()
    configureWebView()

    refreshButton.setOnClickListener {
      if (webView.url.isNullOrBlank()) {
        webView.loadUrl(getString(R.string.base_url))
      } else {
        webView.reload()
      }
    }

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

  private fun setupSpinner() {
    val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, routes.map { it.title })
    navSpinner.adapter = adapter
    navSpinner.setSelection(0, false)
    navSpinner.setOnItemSelectedListener(object : android.widget.AdapterView.OnItemSelectedListener {
      override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
        if (isSpinnerInit) {
          isSpinnerInit = false
          return
        }
        routes.getOrNull(position)?.let { runRouteScript(it.script) }
      }
      override fun onNothingSelected(parent: android.widget.AdapterView<*>?) = Unit
    })
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
    settings.userAgentString = settings.userAgentString + " SEO_WIBE_ANDROID_APP/1.0"

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
        if (!initialRouteApplied) {
          initialRouteApplied = true
          navSpinner.setSelection(0, false)
          runRouteScript(routes.first().script)
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

  private fun runRouteScript(script: String) {
    val wrapped = """
      (function() {
        var __go = function() {
          try {
            $script
            if (window.closeMobileNav) { window.closeMobileNav(); }
          } catch (e) {}
        };
        __go();
        setTimeout(__go, 250);
        setTimeout(__go, 900);
      })();
    """.trimIndent()
    webView.evaluateJavascript(wrapped, null)
  }
}
