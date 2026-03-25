## ADDED Requirements

### Requirement: Rust workspace with three crates
The project SHALL be organized as a Cargo workspace with three member crates: `tunetag-core` (library), `tunetag-gui` (Tauri v2 binary), and `tunetag-cli` (CLI binary).

#### Scenario: Workspace builds successfully
- **WHEN** `cargo build --workspace` is run from the project root
- **THEN** all three crates compile without errors

#### Scenario: Core crate has no GUI dependencies
- **WHEN** `tunetag-core` is compiled
- **THEN** it SHALL NOT depend on Tauri, React, or any GUI framework

### Requirement: Core crate includes lofty dependency
The `tunetag-core` crate SHALL include `lofty` as a dependency for audio tag I/O.

#### Scenario: lofty is accessible from core
- **WHEN** `tunetag-core` is compiled
- **THEN** `lofty` types are importable and usable within the crate

### Requirement: Directory layout follows convention
The workspace SHALL use the following directory structure:
```
Cargo.toml (workspace root)
crates/
  tunetag-core/Cargo.toml
  tunetag-gui/Cargo.toml
  tunetag-gui/src-tauri/ (Rust backend)
  tunetag-gui/src/ (React frontend)
  tunetag-cli/Cargo.toml
```

#### Scenario: Standard layout exists
- **WHEN** the repository is cloned
- **THEN** the directory structure matches the convention above with all Cargo.toml files present

### Requirement: CI builds on all target platforms
GitHub Actions SHALL build and test the project on Windows, macOS, and Linux on pushes to main and on pull requests.

#### Scenario: CI runs on push to main
- **WHEN** code is pushed to the `main` branch
- **THEN** the CI pipeline runs `cargo build --workspace` and `cargo test --workspace` on Windows, macOS, and Linux

#### Scenario: CI runs on pull requests
- **WHEN** a pull request is opened against `main`
- **THEN** the CI pipeline runs the same build and test matrix
