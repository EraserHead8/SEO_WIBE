# Android Release Signing

SEO WIBE Android release builds must use a dedicated release keystore.
Do not sign release APKs with the Android debug keystore.

## Required files

- Keystore file stored outside git.
- `android/seo-wibe-mobile/keystore.properties` stored only on the build machine.

Example `keystore.properties`:

```properties
storeFile=/absolute/path/to/seowibe-release.jks
storePassword=...
keyAlias=seowibe
keyPassword=...
```

## Environment variable alternative

If `keystore.properties` is not present, Gradle also accepts these environment variables:

- `SEO_WIBE_ANDROID_KEYSTORE_FILE`
- `SEO_WIBE_ANDROID_KEYSTORE_PASSWORD`
- `SEO_WIBE_ANDROID_KEY_ALIAS`
- `SEO_WIBE_ANDROID_KEY_PASSWORD`

## Release verification

Run these commands before publishing a new APK:

```bash
./gradlew printReleaseSigningFingerprint
./gradlew assembleRelease
```

The build fails if release signing is missing or if it points to `debug.keystore`.

## Server build notes

Recommended server location for the canonical release key:

- `/opt/seo_wibe/.secrets/android/seowibe-release.jks`
- `/opt/seo_wibe/android/seo-wibe-mobile/keystore.properties`

Back up the keystore outside the server as well. Future APK updates must be signed with the same release key.