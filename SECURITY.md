# Security Policy

## Supported Versions

Merizo is deployed as a single rolling release (no maintained older
versions) — security fixes are applied to `main` and deployed as soon as
they're ready.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue — an authentication bypass, data exposure,
injection vulnerability, or anything else that could compromise user data or
the service — report it privately by emailing **support@merizo.app** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce it (a minimal proof-of-concept is ideal)
- Any relevant logs, screenshots, or request/response examples

You should expect an initial response within a few days. Please give us a
reasonable amount of time to investigate and patch the issue before any
public disclosure.

## Scope

This covers the `backend/` (FastAPI API, auth, database access) and
`frontend/` (Expo app) code in this repository. Issues in third-party
dependencies should generally be reported upstream, but let us know too if
they affect Merizo directly.

## What to expect

- We'll acknowledge your report and confirm whether it's in scope.
- We'll keep you updated as we investigate and fix the issue.
- We're happy to credit reporters in release notes, if you'd like — just let
  us know your preference when you report.

Thank you for helping keep Merizo and its users safe.
