## Context

TuneTag is a new cross-platform audio tag editor. No code exists yet. This change establishes the project structure that all subsequent feature work builds on. The PRD (docs/PRD.md) defines a Tauri v2 app with a React + TypeScript frontend and a shared Rust core library used by both the GUI and CLI.

## Goals / Non-Goals

**Goals:**
- Establish a Rust workspace with clean crate boundaries (core, gui, cli)
- Get a Tauri v2 app window rendering with the basic layout shell
- Get a CLI binary that parses arguments and prints help
- Set up CI that builds on all three target platforms
- Ensure `lofty` compiles and is accessible from the core crate

**Non-Goals:**
- Implementing any actual tag reading/writing logic (that's the `core-tag-io` change)
- Building real UI components beyond the layout shell
- Making the CLI subcommands do anything beyond parsing args
- Setting up release/distribution pipelines (installers, signing, notarization)

## Decisions

### 1. Rust workspace structure

**Decision:** Three crates in a single workspace:
```
Cargo.toml (workspace)
crates/
  tunetag-core/    # shared library — tag I/O, rename logic, etc.
  tunetag-gui/     # Tauri v2 app (depends on tunetag-core)
  tunetag-cli/     # CLI binary (depends on tunetag-core)
```

**Rationale:** Clean separation of concerns. The core crate has no GUI or CLI dependencies — it's pure library code. Both binaries depend on it. This matches the PRD architecture.

**Alternative considered:** A single crate with feature flags (`--features gui`, `--features cli`). Rejected — feature flags add conditional compilation complexity and make it harder to ensure the CLI has zero GUI dependencies.

### 2. Frontend tooling

**Decision:** React + TypeScript with Vite, initialized via `create-tauri-app` or equivalent Tauri v2 scaffolding.

**Rationale:** Vite is the standard bundler for Tauri v2 React projects. Fast HMR, minimal config. The PRD specifies React + TypeScript.

**Alternative considered:** Next.js. Rejected — Tauri doesn't need SSR, and Next.js adds unnecessary complexity for a desktop app.

### 3. CLI argument parser

**Decision:** Use `clap` (derive API) for CLI argument parsing.

**Rationale:** clap is the standard Rust CLI framework. Derive API gives us type-safe argument definitions with minimal boilerplate. Generates help text automatically.

**Alternative considered:** `argh` — smaller, but less ecosystem support and fewer features (no shell completions, no colored help).

### 4. CI configuration

**Decision:** GitHub Actions with a matrix build across Windows, macOS, and Linux. Runs on push to main and on PRs.

**Rationale:** GitHub Actions is free for open-source repos and has good Rust/Node.js toolchain support. Matrix builds ensure we catch platform-specific issues early.

### 5. CSS framework

**Decision:** Tailwind CSS for the frontend.

**Rationale:** Utility-first approach works well for custom UIs like this. Good Tauri + Vite integration. No runtime overhead.

**Alternative considered:** CSS Modules or plain CSS. Rejected — more boilerplate for a complex UI with many interactive components.

## Risks / Trade-offs

- **[Risk] Tauri v2 is relatively new** — Some APIs may change or have rough edges. → Mitigation: Pin Tauri version, monitor changelog.
- **[Risk] Cross-platform build matrix is slow** — CI builds on three OSes take time. → Mitigation: Cache Rust target dirs and node_modules. Only run full matrix on main/PRs, not feature branches.
- **[Trade-off] Three crates vs. one** — More crates means more `Cargo.toml` files and slightly more complex dependency management. Accepted for the clean separation benefit.
