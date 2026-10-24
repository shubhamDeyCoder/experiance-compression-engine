# 🤝 Contributing to Experience Compression Engine

Thank you for your interest in contributing to **Experience Compression Engine (ECE)**! 🚀

ECE aims to transform real-world practitioner experience into reviewed learning cases that help learners develop practical problem-solving and decision-making skills.

Contributions that improve reliability, security, accessibility, learning quality, and usability are welcome.

## 🌟 Ways to Contribute

You can contribute by:

- 🐛 Reporting reproducible bugs.
- ✨ Suggesting useful features.
- 🎨 Improving the user interface and accessibility.
- 🧠 Improving case retrieval and learning recommendations.
- 🔐 Strengthening authentication and database security.
- 🧪 Adding automated tests.
- 📚 Improving documentation and setup instructions.

## 🛠️ Development Setup

### 1. Fork and clone the repository

Fork the repository on GitHub, then clone your fork:

```bash
git clone YOUR_FORK_REPOSITORY_URL
cd experience-compression-engine
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env.local` using `.env.example` as a reference. Add your own development credentials.

Never commit real API keys, passwords, access tokens, or populated environment files.

### 4. Apply database migrations

Configure your development Supabase project and apply the required migrations after reviewing them.

```bash
supabase login
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
supabase db push
```

Avoid applying unreviewed migrations to a production database.

### 5. Run the application

```bash
npm run dev
```

Open `http://localhost:3000`.

## 🌿 Branching Guidelines

Create a separate branch for each change.

```bash
git checkout -b feat/your-feature-name
```

Suggested prefixes:

- `feat/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code improvements
- `test/` — Testing improvements
- `security/` — Security-related changes

## 💻 Code Guidelines

- Follow the existing project structure and coding conventions.
- Use TypeScript types appropriately.
- Keep components focused and reusable.
- Handle loading, error, and empty states.
- Validate user input on the server, not only in the browser.
- Enforce permissions through database policies and trusted server-side operations.
- Avoid exposing secrets or privileged database credentials to client-side code.
- Read the installed Next.js documentation before changing version-specific APIs or conventions.
- Update documentation when behavior or configuration changes.

## 🧪 Before Submitting a Pull Request

Run the available project checks:

```bash
npm run lint
npm run build
```

Also test the relevant user workflow and authorization boundaries. If a command is not configured in `package.json`, report that instead of claiming it passed.

## 📬 Pull Request Process

1. Explain the problem your change solves.
2. Describe the implementation and its impact.
3. Link related issues, if applicable.
4. Include screenshots or a short recording for UI changes.
5. List tests performed and any known limitations.
6. Submit your pull request against the repository's designated target branch.

Keep pull requests focused and avoid unrelated changes.

## 🔐 Reporting Security Issues

Do not disclose credentials or sensitive vulnerability details in public issues.

Follow the reporting guidance in [`SECURITY.md`](SECURITY.md).

## 📜 License

By contributing, you agree that your contributions may be distributed under the project's MIT License, subject to applicable ownership rights and any separate agreements.

Please ensure you have the right to contribute the code or other materials you submit.

---

**Thank you for helping make practical experience more accessible through technology!** ⚡
