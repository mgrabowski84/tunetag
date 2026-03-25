## Why

TuneTag is a greenfield project with no codebase yet. Before any features can be implemented, we need the foundational project structure: a Rust workspace with a shared core library, a Tauri v2 desktop app shell, a React + TypeScript frontend skeleton, and a CLI binary scaffold. Without this, no feature work can begin.

## What Changes

- Initialize a Rust workspace with three crates: `tunetag-core` (shared library), `tunetag-gui` (Tauri v2 app), and `tunetag-cli` (CLI binary)
- Set up Tauri v2 with React + TypeScript frontend using Vite
- Create the basic app shell: window with menu bar, resizable split pane layout (file list + tag panel), and status bar
- Set up the CLI binary with `clap` for argument parsing, with placeholder subcommands
- Add `lofty` as a dependency in `tunetag-core`
- Configure CI with GitHub Actions (build + lint + test on all three platforms)

## Capabilities

### New Capabilities
- `project-structure`: Rust workspace layout, crate organization, and build configuration
- `app-shell`: Tauri v2 desktop app with basic window, menu bar, split pane layout, and status bar
- `cli-scaffold`: CLI binary structure with clap subcommand definitions

### Modified Capabilities

## Impact

- Creates the entire project from scratch — no existing code affected
- Dependencies: Rust toolchain, Node.js, Tauri v2 CLI, lofty, clap, React, TypeScript, Vite
- CI: GitHub Actions workflows for Windows, macOS, and Linux builds
