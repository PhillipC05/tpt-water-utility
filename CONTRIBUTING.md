# Contributing to TPT Water Utility Platform

Thank you for your interest in contributing. This document explains how to get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create a branch** for your change (`git checkout -b feat/my-feature`)
4. **Make your changes**, following the coding standards below
5. **Test** your changes (`cd backend && npm test`)
6. **Push** and open a **Pull Request** against `master`

## Development Setup

```bash
# Backend
cd backend
cp .env.example .env        # fill in your values
npm install
npm run dev                 # starts on port 5000

# Frontend
cd frontend
cp .env.example .env
npm install
npm start                   # starts on port 3000

# Infrastructure (Docker)
docker-compose -f docker/docker-compose.yml up postgres redis mosquitto -d
```

## Coding Standards

- **Language**: TypeScript throughout (backend is 100% TS; new frontend code must be `.tsx`/`.ts`)
- **Linting**: `npm run lint` must pass before committing (ESLint + Prettier configured)
- **Tests**: Backend uses Jest + Supertest. Add or update tests for any new endpoint or service
- **Security**: Never commit credentials, tokens, or secrets. Use `.env` (gitignored)
- **Database**: Use parameterised queries (`$1, $2, ...`) — never string-interpolate user data into SQL

## Pull Request Guidelines

- Keep PRs focused on a single concern
- Update relevant tests
- Summarise _why_ the change is needed in the PR description
- Reference any related issues (`Closes #123`)
- Ensure `npm test` and `npm run lint` pass in CI

## Reporting Bugs

Open a GitHub Issue with:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behaviour
- Environment details (OS, Node version, Docker version)

## Security Vulnerabilities

Please **do not** open a public issue for security bugs. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
