#![allow(dead_code)]

use base64::Engine as _;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const MB_API: &str = "https://musicbrainz.org/ws/2";
const CAA_API: &str = "https://coverartarchive.org/release";
const USER_AGENT: &str = "TuneTag/0.1.0 (https://github.com/mgrabowski84/tunetag)";
const TIMEOUT_SECS: u64 = 15;
const RATE_LIMIT_MS: u64 = 1000;

// ---------------------------------------------------------------------------
// Raw MusicBrainz API response types (tasks 3.1-3.2)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct MbSearchResponse {
    pub releases: Vec<MbRelease>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbRelease {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(rename = "artist-credit", default)]
    pub artist_credit: Vec<MbArtistCredit>,
    #[serde(rename = "release-group", default)]
    pub release_group: Option<MbReleaseGroup>,
    #[serde(rename = "label-info", default)]
    pub label_info: Vec<MbLabelInfo>,
    pub date: Option<String>,
    #[serde(rename = "track-count", default)]
    pub track_count: u32,
    pub media: Option<Vec<MbMedium>>,
    #[serde(rename = "release-events", default)]
    pub release_events: Vec<MbReleaseEvent>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbArtistCredit {
    pub name: Option<String>,
    pub artist: Option<MbArtist>,
    pub joinphrase: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbArtist {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbReleaseGroup {
    #[serde(rename = "primary-type")]
    pub primary_type: Option<String>,
    pub tags: Option<Vec<MbTag>>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbTag {
    pub name: String,
    pub count: i32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbLabelInfo {
    #[serde(rename = "catalog-number")]
    pub catalog_number: Option<String>,
    pub label: Option<MbLabel>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbLabel {
    pub name: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbMedium {
    pub format: Option<String>,
    pub position: Option<u32>,
    #[serde(rename = "track-count")]
    pub track_count: Option<u32>,
    pub tracks: Option<Vec<MbTrack>>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbTrack {
    pub number: Option<String>,
    pub position: Option<u32>,
    pub title: String,
    #[serde(rename = "artist-credit", default)]
    pub artist_credit: Vec<MbArtistCredit>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbReleaseEvent {
    pub date: Option<String>,
    pub area: Option<MbArea>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct MbArea {
    pub name: Option<String>,
    #[serde(rename = "iso-3166-1-codes", default)]
    pub iso_codes: Vec<String>,
}

// ---------------------------------------------------------------------------
// Cover Art Archive response
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CaaResponse {
    pub images: Vec<CaaImage>,
}

#[derive(Debug, Deserialize)]
pub struct CaaImage {
    pub front: bool,
    pub image: String,
    pub thumbnails: CaaThumbnails,
}

#[derive(Debug, Deserialize)]
pub struct CaaThumbnails {
    #[serde(rename = "500")]
    pub size_500: Option<String>,
    pub large: Option<String>,
}

// ---------------------------------------------------------------------------
// Frontend DTOs (task 3.3)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultDto {
    pub mbid: String,
    pub title: String,
    pub artist: String,
    pub year: String,
    pub label: String,
    pub format: String,
    pub track_count: u32,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrackDto {
    pub number: u32,
    pub title: String,
    pub artist: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseDetailDto {
    pub mbid: String,
    pub title: String,
    pub artist: String,
    pub album_artist: String,
    pub year: String,
    pub label: String,
    pub genre: String,
    pub tracks: Vec<TrackDto>,
}

// ---------------------------------------------------------------------------
// Rate limiter (task 2.1)
// ---------------------------------------------------------------------------

pub struct RateLimiter {
    last_request: Mutex<Option<Instant>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            last_request: Mutex::new(None),
        }
    }

    pub async fn wait(&self) {
        let sleep_duration = {
            let mut last = self.last_request.lock().unwrap();
            let sleep = if let Some(t) = *last {
                let elapsed = t.elapsed();
                let min_interval = Duration::from_millis(RATE_LIMIT_MS);
                if elapsed < min_interval {
                    Some(min_interval - elapsed)
                } else {
                    None
                }
            } else {
                None
            };
            *last = Some(Instant::now());
            sleep
        };
        if let Some(dur) = sleep_duration {
            tauri::async_runtime::spawn(async move {
                // Best-effort sleep — tokio is available via tauri runtime
                std::thread::sleep(dur);
            })
            .await
            .ok();
        }
    }
}

// ---------------------------------------------------------------------------
// MusicBrainzClient (task 2.2)
// ---------------------------------------------------------------------------

pub struct MusicBrainzClient {
    client: Client,
    rate_limiter: Arc<RateLimiter>,
}

impl MusicBrainzClient {
    pub fn new() -> Result<Self, reqwest::Error> {
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(TIMEOUT_SECS))
            .build()?;

        Ok(Self {
            client,
            rate_limiter: Arc::new(RateLimiter::new()),
        })
    }

    async fn get(&self, url: &str) -> Result<reqwest::Response, String> {
        self.rate_limiter.wait().await;

        let resp = self
            .client
            .get(url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        // Handle 503 with Retry-After (task 2.6)
        if resp.status() == 503 {
            let retry_after = resp
                .headers()
                .get("Retry-After")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(1);

            std::thread::sleep(Duration::from_secs(retry_after));

            // Retry once
            self.rate_limiter.wait().await;
            return self
                .client
                .get(url)
                .header("Accept", "application/json")
                .send()
                .await
                .map_err(|e| format!("Network error on retry: {}", e));
        }

        Ok(resp)
    }

    /// Search releases by query string (task 2.3)
    pub async fn search_releases(&self, query: &str) -> Result<Vec<SearchResultDto>, String> {
        let encoded = urlencoding_simple(query);
        let url = format!(
            "{}/release?query={}&limit=20&fmt=json",
            MB_API, encoded
        );

        let resp = self.get(&url).await?;
        let body: MbSearchResponse = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;

        Ok(body.releases.iter().map(release_to_search_dto).collect())
    }

    /// Get full release details by MBID (task 2.4)
    pub async fn get_release_details(&self, mbid: &str) -> Result<ReleaseDetailDto, String> {
        let url = format!(
            "{}/release/{}?inc=recordings+artists+labels+release-groups+tags&fmt=json",
            MB_API, mbid
        );

        let resp = self.get(&url).await?;
        let release: MbRelease = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;

        Ok(release_to_detail_dto(&release))
    }

    /// Fetch cover art for a release from Cover Art Archive (task 2.5)
    pub async fn fetch_cover_art(&self, mbid: &str) -> Result<Option<String>, String> {
        let url = format!("{}/{}", CAA_API, mbid);
        let resp = self.get(&url).await?;

        if resp.status() == 404 {
            return Ok(None);
        }

        if !resp.status().is_success() {
            return Ok(None);
        }

        let caa: CaaResponse = match resp.json().await {
            Ok(c) => c,
            Err(_) => return Ok(None),
        };

        // Find front cover, prefer 500px thumbnail
        let image_url = caa
            .images
            .iter()
            .find(|img| img.front)
            .map(|img| {
                img.thumbnails
                    .size_500
                    .clone()
                    .or_else(|| img.thumbnails.large.clone())
                    .unwrap_or_else(|| img.image.clone())
            });

        if let Some(url) = image_url {
            // Download the image and return as base64
            self.rate_limiter.wait().await;
            let img_resp = self
                .client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Cover art download error: {}", e))?;

            let bytes = img_resp
                .bytes()
                .await
                .map_err(|e| format!("Cover art read error: {}", e))?;

            let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
            // Detect MIME type from bytes
            let mime = if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
                "image/jpeg"
            } else {
                "image/png"
            };
            return Ok(Some(format!("data:{};base64,{}", mime, encoded)));
        }

        Ok(None)
    }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

fn format_artist_credit(credits: &[MbArtistCredit]) -> String {
    credits
        .iter()
        .map(|c| {
            let name = c
                .name
                .clone()
                .or_else(|| c.artist.as_ref().map(|a| a.name.clone()))
                .unwrap_or_default();
            let join = c.joinphrase.clone().unwrap_or_default();
            format!("{}{}", name, join)
        })
        .collect::<String>()
        .trim()
        .to_string()
}

fn release_to_search_dto(r: &MbRelease) -> SearchResultDto {
    let artist = format_artist_credit(&r.artist_credit);
    let year = r
        .date
        .as_deref()
        .and_then(|d| d.split('-').next())
        .unwrap_or("")
        .to_string();
    let label = r
        .label_info
        .first()
        .and_then(|li| li.label.as_ref())
        .map(|l| l.name.as_str())
        .unwrap_or("")
        .to_string();
    let format = r
        .media
        .as_deref()
        .and_then(|m| m.first())
        .and_then(|m| m.format.as_deref())
        .unwrap_or("")
        .to_string();
    SearchResultDto {
        mbid: r.id.clone(),
        title: r.title.clone(),
        artist,
        year,
        label,
        format,
        track_count: r.track_count,
    }
}

fn release_to_detail_dto(r: &MbRelease) -> ReleaseDetailDto {
    let artist = format_artist_credit(&r.artist_credit);
    let year = r
        .date
        .as_deref()
        .and_then(|d| d.split('-').next())
        .unwrap_or("")
        .to_string();
    let label = r
        .label_info
        .first()
        .and_then(|li| li.label.as_ref())
        .map(|l| l.name.as_str())
        .unwrap_or("")
        .to_string();

    // Genre: highest-voted tag from release-group folksonomy (task 7.4)
    let genre = r
        .release_group
        .as_ref()
        .and_then(|rg| rg.tags.as_ref())
        .and_then(|tags| {
            tags.iter()
                .filter(|t| t.count > 0)
                .max_by_key(|t| t.count)
                .map(|t| t.name.clone())
        })
        .unwrap_or_default();

    // Flatten tracks from all media
    let mut tracks: Vec<TrackDto> = Vec::new();
    if let Some(media) = &r.media {
        for medium in media {
            if let Some(medium_tracks) = &medium.tracks {
                for t in medium_tracks {
                    let track_num = t.position.unwrap_or(tracks.len() as u32 + 1);
                    let track_artist = if t.artist_credit.is_empty() {
                        artist.clone()
                    } else {
                        format_artist_credit(&t.artist_credit)
                    };
                    tracks.push(TrackDto {
                        number: track_num,
                        title: t.title.clone(),
                        artist: track_artist,
                    });
                }
            }
        }
    }

    ReleaseDetailDto {
        mbid: r.id.clone(),
        title: r.title.clone(),
        artist: artist.clone(),
        album_artist: artist,
        year,
        label,
        genre,
        tracks,
    }
}

/// Simple URL encoding without pulling in another crate
fn urlencoding_simple(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b' ' => out.push('+'),
            _ => {
                out.push('%');
                out.push_str(&format!("{:02X}", b));
            }
        }
    }
    out
}
