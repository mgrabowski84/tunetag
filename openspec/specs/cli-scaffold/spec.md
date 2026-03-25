## ADDED Requirements

### Requirement: CLI binary with clap
The `tunetag-cli` crate SHALL produce a binary named `tunetag` that uses `clap` (derive API) for argument parsing.

#### Scenario: CLI prints help
- **WHEN** `tunetag --help` is run
- **THEN** the CLI prints a help message listing all subcommands

#### Scenario: CLI prints version
- **WHEN** `tunetag --version` is run
- **THEN** the CLI prints the application name and version

### Requirement: Placeholder subcommands defined
The CLI SHALL define the following subcommands as placeholders: `read`, `write`, `rename`, `cover` (with `set` and `remove` sub-subcommands), `info`, and `autonumber`. Each SHALL accept the arguments defined in PRD section 8 but print a "not yet implemented" message.

#### Scenario: Read subcommand exists
- **WHEN** `tunetag read --help` is run
- **THEN** help text is shown with a `<file>` positional argument

#### Scenario: Write subcommand exists
- **WHEN** `tunetag write --help` is run
- **THEN** help text is shown with a `<file>` positional argument and tag field flags (--artist, --title, --album, etc.)

#### Scenario: Unimplemented subcommand prints message
- **WHEN** `tunetag read somefile.mp3` is run
- **THEN** the CLI prints "not yet implemented" and exits with code 0

### Requirement: Global flags defined
The CLI SHALL support the following global flags: `--json` (output as JSON) and `--dry-run` (preview without writing).

#### Scenario: Global flags accepted
- **WHEN** `tunetag write track.mp3 --artist "Test" --json --dry-run` is run
- **THEN** the flags are parsed without error (even though the command is not yet implemented)
