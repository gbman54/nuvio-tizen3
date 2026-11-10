# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting on this repository (Security → Report a vulnerability). Include:

- Affected version
- Steps to reproduce
- Impact (what an attacker could do)
- Any suggested fix

You can expect an acknowledgement within a few days. This is a volunteer project, so please allow reasonable time before disclosing.

## Scope

Relevant issues include:

- Escaping the scraper sandbox (`new Function` runtime in `src/js/13-plugins.js`)
- Remote code execution via addon manifests or plugin payloads
- Credential or token leakage (Trakt, debrid, resolver)
- Injection into the UI from addon metadata

## Out of scope

- Content provided by third-party addons or scrapers
- The TV's own firmware or Tizen platform vulnerabilities
- Issues that require physical access to the TV
- Denial of service by installing a malicious addon the user explicitly chose

## Repository hygiene

This repository must never contain:

- Signing certificates or private keys (`certs/`, `*.p12`, `*.key`, `*.cer`)
- Signed `.wgt` packages
- Trakt tokens, debrid API keys, or resolver passwords
- Personal IP addresses or device identifiers

If you find any of these committed, report it privately as a security issue.
