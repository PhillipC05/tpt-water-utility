# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅ Yes    |

## Reporting a Vulnerability

**Please do not open a public GitHub Issue for security vulnerabilities.**

Email **phillipthen@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce or a proof-of-concept
- The potential impact
- Any suggested mitigations (optional)

You will receive an acknowledgement within 48 hours. We aim to release a fix within 14 days for critical issues and 30 days for moderate issues.

We ask that you:
- Give us reasonable time to address the issue before public disclosure
- Avoid accessing, modifying, or deleting data that does not belong to you during testing

## Security Best Practices for Deployment

Before running this platform in production:

1. **Change all default secrets** — set a strong random `JWT_SECRET` and database passwords
2. **Enable MQTT authentication** — edit `docker/mosquitto/config/mosquitto.conf` to disable anonymous access and set a password file
3. **Restrict CORS** — set `FRONTEND_URL` to your exact production domain in the backend `.env`
4. **Use HTTPS** — terminate TLS at your reverse proxy (nginx / Caddy) and never serve the API over plain HTTP in production
5. **Rotate JWT secrets** periodically and plan for token invalidation
6. **Enable PostgreSQL SSL** — set `ssl: true` in the database connection when using a managed database
7. **Firewall** — only expose ports 80 and 443 publicly; keep 5000, 5432, 6379, and 1883 internal
