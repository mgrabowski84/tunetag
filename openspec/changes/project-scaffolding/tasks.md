## 1. Rust Workspace Setup

- [x] 1.1 Create workspace root `Cargo.toml` with three member crates under `crates/`
- [x] 1.2 Create `tunetag-core` library crate with `lofty` as a dependency
- [x] 1.3 Create `tunetag-cli` binary crate depending on `tunetag-core`
- [x] 1.4 Create `tunetag-gui` crate directory structure (Tauri v2 Rust backend under `src-tauri/`)
- [x] 1.5 Verify `cargo build --workspace` compiles all three crates

## 2. Frontend Setup

- [x] 2.1 Initialize React + TypeScript + Vite project in `crates/tunetag-gui/`
- [x] 2.2 Install and configure Tailwind CSS
- [x] 2.3 Configure Tauri v2 integration (tauri.conf.json, Tauri CLI)
- [x] 2.4 Verify `npm run dev` starts the Vite dev server and Tauri app launches

## 3. App Shell UI

- [x] 3.1 Create the menu bar component with File, Edit, Convert, Tag Sources, View menus and placeholder items per PRD section 10
- [x] 3.2 Create the resizable split pane layout (file list panel left, tag panel right) with a draggable divider
- [x] 3.3 Create the status bar component showing "0 files loaded | 0 selected | 0 unsaved"
- [x] 3.4 Wire up the app shell: menu bar at top, split pane in center, status bar at bottom

## 4. CLI Scaffold

- [x] 4.1 Add `clap` (derive API) as a dependency to `tunetag-cli`
- [x] 4.2 Define the top-level CLI struct with `--json` and `--dry-run` global flags
- [x] 4.3 Define subcommand enums: `read`, `write`, `rename`, `cover` (set/remove), `info`, `autonumber` with their respective arguments per PRD section 8
- [x] 4.4 Implement placeholder handlers that print "not yet implemented" for each subcommand
- [x] 4.5 Verify `tunetag --help`, `tunetag --version`, and `tunetag read --help` produce correct output

## 5. CI Setup

- [x] 5.1 Create `.github/workflows/ci.yml` with a matrix build (Windows, macOS, Linux)
- [x] 5.2 Configure Rust toolchain caching and Node.js setup in CI
- [x] 5.3 Add `cargo build --workspace`, `cargo test --workspace`, and `cargo clippy --workspace` steps
- [x] 5.4 Add frontend lint step (`npm run lint` or equivalent)
- [ ] 5.5 Verify CI passes on push to main
