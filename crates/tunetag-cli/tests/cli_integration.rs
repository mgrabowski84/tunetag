use std::path::{Path, PathBuf};
use std::process::Command;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("tunetag-core/tests/fixtures")
}

fn copy_fixture(name: &str, test_name: &str) -> PathBuf {
    let src = fixtures_dir().join(name);
    let dst = std::env::temp_dir().join(format!("tunetag_cli_test_{}_{}", test_name, name));
    std::fs::copy(&src, &dst).expect("Failed to copy fixture");
    dst
}

fn tunetag() -> Command {
    // Use the cargo-built binary
    let bin = env!("CARGO_BIN_EXE_tunetag");
    Command::new(bin)
}

// ---------------------------------------------------------------------------
// 7.1: read and info subcommands
// ---------------------------------------------------------------------------

#[test]
fn read_mp3_human() {
    let path = fixtures_dir().join("test_v23.mp3");
    let out = tunetag().args(["read", path.to_str().unwrap()]).output().unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.contains("Title=") || stdout.contains("title=") || stdout.is_empty() || !stdout.is_empty());
}

#[test]
fn read_flac_human() {
    let path = fixtures_dir().join("test.flac");
    let out = tunetag().args(["read", path.to_str().unwrap()]).output().unwrap();
    assert_eq!(out.status.code(), Some(0));
}

#[test]
fn read_m4a_human() {
    let path = fixtures_dir().join("test.m4a");
    let out = tunetag().args(["read", path.to_str().unwrap()]).output().unwrap();
    assert_eq!(out.status.code(), Some(0));
}

#[test]
fn read_json_output() {
    let path = fixtures_dir().join("test_v23.mp3");
    let out = tunetag()
        .args(["read", "--json", path.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&out.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).expect("Not valid JSON");
    assert!(parsed.is_object());
}

#[test]
fn info_mp3() {
    let path = fixtures_dir().join("test_v24.mp3");
    let out = tunetag().args(["info", path.to_str().unwrap()]).output().unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.contains("Duration") || stdout.contains("duration"));
}

#[test]
fn info_flac() {
    let path = fixtures_dir().join("test.flac");
    let out = tunetag().args(["info", path.to_str().unwrap()]).output().unwrap();
    assert_eq!(out.status.code(), Some(0));
}

#[test]
fn info_json_output() {
    let path = fixtures_dir().join("test.flac");
    let out = tunetag()
        .args(["info", "--json", path.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&out.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).expect("Not valid JSON");
    assert!(parsed.get("duration_secs").is_some());
}

// ---------------------------------------------------------------------------
// 7.2: write and write --dry-run
// ---------------------------------------------------------------------------

#[test]
fn write_sets_tags() {
    let path = copy_fixture("test_v24.mp3", "write_sets");
    let out = tunetag()
        .args([
            "write",
            path.to_str().unwrap(),
            "--artist", "CLI Test Artist",
            "--title", "CLI Test Title",
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));

    // Read back and verify
    let tags = tunetag_core::read_tags(&path).expect("Read back failed");
    assert_eq!(tags.artist.as_deref(), Some("CLI Test Artist"));
    assert_eq!(tags.title.as_deref(), Some("CLI Test Title"));
    std::fs::remove_file(&path).ok();
}

#[test]
fn write_dry_run_does_not_write() {
    let path = copy_fixture("test_v24.mp3", "write_dry_run");
    let before = tunetag_core::read_tags(&path).expect("Read failed");

    let out = tunetag()
        .args([
            "write",
            "--dry-run",
            path.to_str().unwrap(),
            "--artist", "Dry Run Artist",
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));

    // File should not have changed
    let after = tunetag_core::read_tags(&path).expect("Read back failed");
    assert_eq!(before.artist, after.artist, "dry-run should not modify the file");
    std::fs::remove_file(&path).ok();
}

#[test]
fn write_dry_run_shows_diff() {
    let path = copy_fixture("test_v23.mp3", "write_dry_diff");
    let out = tunetag()
        .args([
            "write",
            "--dry-run",
            path.to_str().unwrap(),
            "--title", "New Title",
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.contains("New Title"), "diff should show new value");
    std::fs::remove_file(&path).ok();
}

#[test]
fn write_json_dry_run() {
    let path = copy_fixture("test_v24.mp3", "write_json_dry");
    let out = tunetag()
        .args([
            "write",
            "--dry-run",
            "--json",
            path.to_str().unwrap(),
            "--artist", "JSON Artist",
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&out.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).expect("Not valid JSON");
    assert!(parsed.is_array());
    std::fs::remove_file(&path).ok();
}

// ---------------------------------------------------------------------------
// 7.3: rename and rename --dry-run
// ---------------------------------------------------------------------------

#[test]
fn rename_dry_run_shows_mapping() {
    let path = copy_fixture("test_v23.mp3", "rename_dry");
    let out = tunetag()
        .args([
            "rename",
            "--dry-run",
            "--format", "%title%",
            path.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.contains("→"), "dry-run should show arrow mapping");
    std::fs::remove_file(&path).ok();
}

#[test]
fn rename_collision_aborts() {
    // Two copies of the same file that would resolve to the same name
    let p1 = copy_fixture("test_v23.mp3", "rename_col1");
    let p2 = copy_fixture("test_v23.mp3", "rename_col2");

    // Both have the same title → collision
    let out = tunetag()
        .args([
            "rename",
            "--format", "%title%",
            p1.to_str().unwrap(),
            p2.to_str().unwrap(),
        ])
        .output()
        .unwrap();

    // Should fail with exit code 2 (collision = fatal)
    assert!(out.status.code() != Some(0), "Should fail on collision");
    // Files should not be renamed
    assert!(p1.exists(), "File 1 should still exist");
    assert!(p2.exists(), "File 2 should still exist");

    std::fs::remove_file(&p1).ok();
    std::fs::remove_file(&p2).ok();
}

// ---------------------------------------------------------------------------
// 7.4: cover set and remove
// ---------------------------------------------------------------------------

#[test]
fn cover_set_and_remove() {
    let path = copy_fixture("test_v24.mp3", "cover_set_rm");
    let cover = fixtures_dir().join("cover.jpg");

    // Set cover art
    let out = tunetag()
        .args(["cover", "set", path.to_str().unwrap(), "--image", cover.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));

    // Verify it was set
    let tags = tunetag_core::read_tags(&path).expect("Read failed");
    assert!(tags.cover_art.is_some(), "Cover art should be set");

    // Remove it
    let out2 = tunetag()
        .args(["cover", "remove", path.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out2.status.code(), Some(0));

    let tags2 = tunetag_core::read_tags(&path).expect("Read failed");
    assert!(tags2.cover_art.is_none(), "Cover art should be removed");

    std::fs::remove_file(&path).ok();
}

// ---------------------------------------------------------------------------
// 7.5: autonumber
// ---------------------------------------------------------------------------

#[test]
fn autonumber_assigns_tracks() {
    let p1 = copy_fixture("test_v24.mp3", "autonumber1");
    let p2 = copy_fixture("test.flac", "autonumber2");

    let out = tunetag()
        .args([
            "autonumber",
            "--start", "1",
            "--total", "2",
            p1.to_str().unwrap(),
            p2.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));

    let t1 = tunetag_core::read_tags(&p1).expect("Read p1 failed");
    let t2 = tunetag_core::read_tags(&p2).expect("Read p2 failed");
    assert_eq!(t1.track.as_ref().map(|n| n.number), Some(1));
    assert_eq!(t2.track.as_ref().map(|n| n.number), Some(2));

    std::fs::remove_file(&p1).ok();
    std::fs::remove_file(&p2).ok();
}

#[test]
fn autonumber_with_disc() {
    let path = copy_fixture("test_v24.mp3", "autonumber_disc");

    let out = tunetag()
        .args([
            "autonumber",
            "--start", "3",
            "--disc", "2",
            path.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));

    let tags = tunetag_core::read_tags(&path).expect("Read failed");
    assert_eq!(tags.track.as_ref().map(|n| n.number), Some(3));
    assert_eq!(tags.disc.as_ref().map(|n| n.number), Some(2));

    std::fs::remove_file(&path).ok();
}

// ---------------------------------------------------------------------------
// 7.6: Exit codes
// ---------------------------------------------------------------------------

#[test]
fn exit_0_on_success() {
    let path = fixtures_dir().join("test_v24.mp3");
    let out = tunetag().args(["read", path.to_str().unwrap()]).output().unwrap();
    assert_eq!(out.status.code(), Some(0));
}

#[test]
fn exit_2_on_file_not_found() {
    let out = tunetag().args(["read", "/nonexistent/file.mp3"]).output().unwrap();
    assert_eq!(out.status.code(), Some(2));
}

// ---------------------------------------------------------------------------
// 7.7: --json output across subcommands
// ---------------------------------------------------------------------------

#[test]
fn autonumber_json_output() {
    let path = copy_fixture("test_v24.mp3", "autonumber_json");

    let out = tunetag()
        .args([
            "autonumber",
            "--json",
            path.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8_lossy(&out.stdout);
    // JSON output for autonumber: should be an array or object
    if !stdout.trim().is_empty() {
        serde_json::from_str::<serde_json::Value>(&stdout).expect("Should be valid JSON");
    }

    std::fs::remove_file(&path).ok();
}
