pip3 install bcrypt --quiet && python3 -c "
import bcrypt, secrets, base64

# Generate password hash
password = 'ChangeMe2026!'
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
print('password_hash:', hashed)

# Generate TOTP secret (base32)
totp_secret = base64.b32encode(secrets.token_bytes(20)).decode()
print('mfa_secret:', totp_secret)
"
