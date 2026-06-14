"""Generate self-signed SSL certificate for local HTTPS testing."""

from pathlib import Path
import subprocess
import sys

CERT_DIR = Path(__file__).parent.parent / "certs"
CERT_DIR.mkdir(exist_ok=True)

KEY_FILE = CERT_DIR / "key.pem"
CERT_FILE = CERT_DIR / "cert.pem"

# Generate self-signed certificate using openssl (if available) or Python
def generate_with_python():
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.backends import default_backend
        import datetime

        # Generate key
        key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )

        # Generate certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "FI"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Uusimaa"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Helsinki"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "ScanFi"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])

        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
            .add_extension(
                x509.SubjectAlternativeName([
                    x509.DNSName("localhost"),
                    x509.DNSName("*.localhost"),
                    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                    x509.IPAddress(ipaddress.IPv4Address("192.168.22.120")),
                ]),
                critical=False,
            )
            .sign(key, hashes.SHA256(), default_backend())
        )

        # Write key
        KEY_FILE.write_bytes(
            key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            )
        )

        # Write cert
        CERT_FILE.write_bytes(cert.public_bytes(serialization.Encoding.PEM))

        print(f"Generated: {KEY_FILE}")
        print(f"Generated: {CERT_FILE}")
        return True

    except ImportError:
        return False

import ipaddress

if __name__ == "__main__":
    if generate_with_python():
        print("\nSSL certificates generated successfully!")
    else:
        print("Please install cryptography: pip install cryptography")
        sys.exit(1)
