# TWA Android signing — private/local setup

The repository is public. **Never generate a signing keystore in GitHub Actions and upload it as an artifact.** Public-repository workflow artifacts can be downloaded by people with repository read access. The former key-generation workflow has therefore been removed.

## Generate the key on a trusted private device

Run these commands on your own computer or a trusted private Android/Linux environment. Keep the resulting keystore and passwords in a private backup.

```bash
umask 077
mkdir -p "$HOME/.config/arrow-out-signing"
cd "$HOME/.config/arrow-out-signing"
STORE_PASS="$(openssl rand -hex 24)"
KEY_PASS="$STORE_PASS"
keytool -genkeypair -v \
  -keystore android.keystore \
  -alias android \
  -keyalg RSA -keysize 2048 \
  -validity 10950 \
  -storepass "$STORE_PASS" -keypass "$KEY_PASS" \
  -dname "CN=Arrow Out, O=GoGo Company, C=IN"
base64 < android.keystore | tr -d '\n' > android.keystore.b64
keytool -list -v -keystore android.keystore -alias android -storepass "$STORE_PASS"
```

Record the passwords securely. Do not paste them into chat, commit them, or put them in build logs.

## Configure GitHub Actions secrets

In the repository's **Settings → Secrets and variables → Actions**, create:

- `TWA_KEYSTORE_B64`: the one-line contents of `android.keystore.b64`
- `TWA_KEYSTORE_PASSWORD`: the value of `STORE_PASS`
- `TWA_KEY_PASSWORD`: the value of `KEY_PASS`

Then run **TWA APK build** manually. The workflow reads these secrets and uploads only the signed APK/AAB and generated Digital Asset Links file; it does not upload the keystore or password file.

## Backup and release safety

- Keep at least two encrypted, private backups of the keystore and passwords.
- Never regenerate or replace the key after publishing an app update with it.
- Do not upload the keystore, base64 file, passwords, or secret setup notes to GitHub, issue comments, or workflow artifacts.
- If this app has already been published, first verify the Play App Signing / upload-key arrangement in Play Console before changing any signing setup.
