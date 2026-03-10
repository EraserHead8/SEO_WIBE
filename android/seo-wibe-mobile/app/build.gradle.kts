import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import java.util.Locale
import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
  keystorePropertiesFile.inputStream().use(keystoreProperties::load)
}

fun signingValue(propertyName: String, envName: String): String? {
  val propertyValue = keystoreProperties.getProperty(propertyName)?.trim().orEmpty()
  if (propertyValue.isNotEmpty()) {
    return propertyValue
  }
  val envValue = System.getenv(envName)?.trim().orEmpty()
  return envValue.ifEmpty { null }
}

val releaseStoreFilePath = signingValue("storeFile", "SEO_WIBE_ANDROID_KEYSTORE_FILE")
val releaseStorePassword = signingValue("storePassword", "SEO_WIBE_ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = signingValue("keyAlias", "SEO_WIBE_ANDROID_KEY_ALIAS")
val releaseKeyPassword = signingValue("keyPassword", "SEO_WIBE_ANDROID_KEY_PASSWORD")
val isReleaseSigningConfigured = listOf(
  releaseStoreFilePath,
  releaseStorePassword,
  releaseKeyAlias,
  releaseKeyPassword,
).all { !it.isNullOrBlank() }
val releaseStoreFileRef = releaseStoreFilePath?.let { file(it) }

fun requireReleaseSigning(): File {
  if (!isReleaseSigningConfigured || releaseStoreFileRef == null) {
    throw GradleException(
      "Missing Android release signing config. Provide android/seo-wibe-mobile/keystore.properties or SEO_WIBE_ANDROID_KEYSTORE_* environment variables."
    )
  }
  if (!releaseStoreFileRef.exists()) {
    throw GradleException("Android release keystore file not found: ${releaseStoreFileRef.path}")
  }
  val canonicalPath = releaseStoreFileRef.canonicalPath.lowercase(Locale.ROOT)
  val debugMarkers = listOf(
    "${File.separator}.android${File.separator}debug.keystore".lowercase(Locale.ROOT),
    "${File.separator}debug.keystore".lowercase(Locale.ROOT),
    "/.android/debug.keystore",
  )
  if (debugMarkers.any { canonicalPath.contains(it) || canonicalPath.endsWith(it) }) {
    throw GradleException("Release signing cannot use debug.keystore. Configure a dedicated production keystore.")
  }
  return releaseStoreFileRef
}

fun sha256Fingerprint(bytes: ByteArray): String =
  MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(":") { "%02X".format(it) }

android {
  namespace = "com.seowibe.mobile"
  compileSdk = 34

  defaultConfig {
    applicationId = "com.seowibe.mobile"
    minSdk = 24
    targetSdk = 34
    versionCode = 18
    versionName = "1.5.12"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  signingConfigs {
    if (isReleaseSigningConfigured) {
      create("release") {
        storeFile = requireReleaseSigning()
        storePassword = releaseStorePassword
        keyAlias = releaseKeyAlias
        keyPassword = releaseKeyPassword
        enableV1Signing = true
        enableV2Signing = true
      }
    }
  }

  buildTypes {
    release {
      if (isReleaseSigningConfigured) {
        signingConfig = signingConfigs.getByName("release")
      }
      isMinifyEnabled = true
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
    debug {
      isMinifyEnabled = false
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
  buildFeatures {
    buildConfig = true
  }
}

tasks.register("verifyReleaseSigning") {
  doLast {
    val keystoreFile = requireReleaseSigning()
    println("Using release keystore: ${keystoreFile.canonicalPath}")
    println("Release signing alias: ${releaseKeyAlias ?: ""}")
  }
}

tasks.register("printReleaseSigningFingerprint") {
  dependsOn("verifyReleaseSigning")
  doLast {
    val keystoreFile = requireReleaseSigning()
    val keyStore = KeyStore.getInstance(KeyStore.getDefaultType())
    keystoreFile.inputStream().use { stream ->
      keyStore.load(stream, releaseStorePassword!!.toCharArray())
    }
    val certificate = keyStore.getCertificate(releaseKeyAlias!!)
      ?: throw GradleException("Release signing alias not found in keystore: ${releaseKeyAlias}")
    println("Release signing SHA-256: ${sha256Fingerprint(certificate.encoded)}")
  }
}

tasks.matching { task ->
  task.name in setOf("assembleRelease", "bundleRelease", "packageRelease")
}.configureEach {
  dependsOn("verifyReleaseSigning")
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.work:work-runtime-ktx:2.9.1")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.constraintlayout:constraintlayout:2.1.4")
}