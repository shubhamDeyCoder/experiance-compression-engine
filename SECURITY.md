# 🛡️ Security Policy

## 🔒 Experience Compression Engine

Security is an important part of Experience Compression Engine (ECE). The application uses Supabase authentication, PostgreSQL Row Level Security (RLS), and database functions to protect user data and workflow operations.

## 📌 Supported Versions

Security fixes are prioritized for the latest version available on the project's main branch and the currently deployed application.

Older versions may not receive security updates.

## 🚨 Reporting a Vulnerability

If you discover a potential security vulnerability, please report it responsibly.

Please include:

- A clear description of the vulnerability.
- The affected feature or component.
- Steps to reproduce the issue, if safe to share.
- The potential impact of the vulnerability.
- Any suggested mitigation, if known.

**Do not publish sensitive vulnerability details in public GitHub issues.**

Until a private reporting channel is configured, contact the repository owner privately through their GitHub profile.

GitHub's private vulnerability reporting feature can also be enabled in the repository's security settings, if available.

## 🔐 Security Best Practices

- Never commit API keys, passwords, access tokens, or populated environment files.
- Never expose Supabase service-role credentials in browser code.
- Keep Row Level Security enabled on tables containing protected data.
- Validate authorization inside database functions and server-side operations.
- Restrict expert, reviewer, and learner access according to their permissions.
- Keep dependencies and deployment configuration updated.
- Review database migrations before applying them to production.

## ⚠️ Responsible Disclosure

Please allow the project maintainer reasonable time to investigate and address a reported vulnerability before publicly disclosing technical details.

Thank you for helping improve the security and reliability of Experience Compression Engine.
