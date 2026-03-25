//! TuneTag Core — shared library for audio tag I/O and utilities.
//!
//! This crate provides the core functionality used by both the TuneTag GUI
//! application and the `tunetag` CLI binary.

/// Re-export lofty for consumers that need direct access.
pub use lofty;

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    #[test]
    fn lofty_is_accessible() {
        // Verify lofty is accessible by constructing a Probe from empty data
        let data = Cursor::new(Vec::<u8>::new());
        let _probe = lofty::probe::Probe::new(data);
    }
}
