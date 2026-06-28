#!/bin/zsh
# Creates a STABLE self-signed code-signing identity ("Debrief Local Signing") in the
# login keychain, so every build is signed with the same identity and macOS keeps TCC
# grants (Screen Recording, Microphone) across rebuilds. No Apple Developer account; not
# for distribution — only to stabilize the signature on this machine. Idempotent.
set -e

IDENTITY="Debrief Local Signing"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

if security find-identity -v -p codesigning 2>/dev/null | grep -q "$IDENTITY"; then
  echo "==> Signing identity '$IDENTITY' already present."
  exit 0
fi

echo "==> Creating self-signed code-signing identity '$IDENTITY'"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/cfg.cnf" <<CNF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $IDENTITY
[ext]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
CNF

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$TMP/key.pem" -out "$TMP/cert.pem" -config "$TMP/cfg.cnf"

# Approach 1: import key + cert as one PEM (no PKCS#12, so no MAC-algorithm mismatch).
echo "==> Importing key + certificate into the login keychain"
cat "$TMP/key.pem" "$TMP/cert.pem" > "$TMP/combined.pem"
security import "$TMP/combined.pem" -k "$KEYCHAIN" -A -T /usr/bin/codesign 2>&1 || true

# Trust the cert for code signing (this is the step that may ask for your login password).
echo "==> Trusting the certificate for code signing (you may be prompted for your password)"
security add-trusted-cert -r trustRoot -p codeSign -k "$KEYCHAIN" "$TMP/cert.pem" 2>&1 || \
  echo "    (auto-trust returned non-zero; will verify below)"

# Approach 2 (fallback): legacy-format PKCS#12 with SHA-1 MAC that macOS can read.
if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "$IDENTITY"; then
  echo "==> PEM import insufficient; trying legacy PKCS#12"
  PW="debrief-temp"
  EXTRA="-macalg sha1 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES"
  openssl version 2>/dev/null | grep -qi "^OpenSSL 3" && EXTRA="-legacy $EXTRA"
  openssl pkcs12 -export ${=EXTRA} -inkey "$TMP/key.pem" -in "$TMP/cert.pem" \
    -name "$IDENTITY" -out "$TMP/id.p12" -passout pass:"$PW" 2>&1 || true
  security import "$TMP/id.p12" -k "$KEYCHAIN" -P "$PW" -A -T /usr/bin/codesign 2>&1 || true
  security add-trusted-cert -r trustRoot -p codeSign -k "$KEYCHAIN" "$TMP/cert.pem" 2>&1 || true
fi

if security find-identity -v -p codesigning 2>/dev/null | grep -q "$IDENTITY"; then
  echo "==> Identity '$IDENTITY' is ready for signing."
else
  echo "WARNING: '$IDENTITY' is not recognized by codesign yet."
  echo "  In Keychain Access > login, find '$IDENTITY' > Get Info > Trust > Code Signing: Always Trust."
fi
