use anyhow::{anyhow, Context, Result};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::{Path, PathBuf}, thread, time::Duration};
use walkdir::WalkDir;

// -------- config --------

#[derive(Deserialize, Debug)]
pub struct AwsConfig {
    pub api_url: String,         // e.g., https://<api-id>.execute-api.us-west-2.amazonaws.com/ingest/new
    pub device_id: String,       // e.g., "dev001"
    pub watch_dir: String,       // e.g., ".\\memory"
    pub scan_interval_secs: Option<u64>,
    pub concurrency: Option<usize>,
}

impl AwsConfig {
    pub fn load() -> Result<Self> {
        let text = fs::read_to_string("config.toml").context("reading config.toml")?;
        let mut cfg: AwsConfig = toml::from_str(&text).context("parsing config.toml")?;
        if cfg.scan_interval_secs.is_none() { cfg.scan_interval_secs = Some(60); }
        if cfg.concurrency.is_none() { cfg.concurrency = Some(2); }
        Ok(cfg)
    }
}

// -------- presign request/response contracts --------

#[derive(Serialize)]
struct PresignReq<'a> {
    #[serde(rename = "deviceId")]
    device_id: &'a str,
    filename: &'a str,
}

#[derive(Deserialize, Debug)]
struct PresignResp {
    url: String,
    key: String,
}

// -------- helpers --------

fn is_complete_json(path: &Path) -> bool {
    // Only pick *.json files (not *.tmp or already-synced files)
    if path.extension().and_then(|e| e.to_str()) != Some("json") {
        return false;
    }
    if path.file_name().and_then(|n| n.to_str()).map(|s| s.ends_with(".synced")).unwrap_or(false) {
        return false;
    }
    true
}

fn mark_synced(path: &Path) -> Result<()> {
    let mut new_path = path.to_path_buf();
    // change foo.json -> foo.json.synced
    let new_name = format!(
        "{}.synced",
        path.file_name().unwrap().to_string_lossy()
    );
    new_path.set_file_name(new_name);
    // prefer atomic rename; fallback to copy+delete if cross-device
    if fs::rename(path, &new_path).is_err() {
        fs::copy(path, &new_path)?;
        fs::remove_file(path)?;
    }
    Ok(())
}

fn read_all_bytes(path: &Path) -> Result<Vec<u8>> {
    // If the producer writes atomically (tmp+rename), this just works.
    // If not, you can add a small sleep or check size-stability.
    let mut f = fs::File::open(path)?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf)?;
    Ok(buf)
}

// -------- core upload logic --------

fn presign(client: &Client, api_url: &str, device_id: &str, filename: &str) -> Result<PresignResp> {
    let body = PresignReq { device_id, filename };
    let resp = client
        .post(api_url)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .context("calling presign endpoint")?
        .error_for_status()
        .context("non-200 from presign endpoint")?
        .json::<PresignResp>()
        .context("decoding presign response")?;
    Ok(resp)
}

fn upload_with_put(client: &Client, put_url: &str, bytes: Vec<u8>) -> Result<()> {
    let r = client
        .put(put_url)
        .header("content-type", "application/json")
        .body(bytes)
        .send()
        .context("PUT to presigned URL")?;
    if !r.status().is_success() {
        return Err(anyhow!("upload failed with status {}", r.status()));
    }
    Ok(())
}

// Exponential backoff helper
fn retry<F>(mut f: F, attempts: usize, base_delay_ms: u64) -> Result<()>
where
    F: FnMut() -> Result<()>,
{
    let mut delay = base_delay_ms;
    for i in 0..attempts {
        match f() {
            Ok(_) => return Ok(()),
            Err(e) => {
                eprintln!("attempt {}/{} failed: {e:?}", i + 1, attempts);
                if i + 1 == attempts { break; }
                thread::sleep(Duration::from_millis(delay));
                delay = (delay as f64 * 1.8).min(30_000.0) as u64; // cap ~30s
            }
        }
    }
    Err(anyhow!("all {} attempts failed", attempts))
}

fn process_file(client: &Client, cfg: &AwsConfig, path: &Path) -> Result<()> {
    let filename = path.file_name().unwrap().to_string_lossy().to_string();

    // 1) presign with retry logic
    let presigned = {
        let mut last_error: Option<anyhow::Error> = None;
        let mut result: Option<PresignResp> = None;
        
        for delay in [500, 1200, 2500] {
            match presign(client, &cfg.api_url, &cfg.device_id, &filename) {
                Ok(p) => { 
                    result = Some(p); 
                    break; 
                }
                Err(e) => { 
                    last_error = Some(e); 
                    thread::sleep(Duration::from_millis(delay)); 
                }
            }
        }
        
        result.ok_or_else(|| last_error.unwrap_or_else(|| anyhow!("Presign failed after all attempts")))
    }?;

    // 2) read bytes
    let bytes = read_all_bytes(path).context("reading file before upload")?;

    // 3) upload (presigned PUT)
    retry(
        || {
            upload_with_put(client, &presigned.url, bytes.clone())
        },
        5,   // attempts
        700, // base delay ms
    )?;

    // 4) mark local file as synced
    mark_synced(path)?;

    println!("✅ uploaded: {}  →  s3://arkangel-json-ingest-prod/{}", filename, presigned.key);
    Ok(())
}

// -------- public interface --------

pub struct AwsUploader {
    config: AwsConfig,
    client: Client,
}

impl AwsUploader {
    pub fn new() -> Result<Self> {
        let config = AwsConfig::load()?;
        fs::create_dir_all(&config.watch_dir).ok();

        // HTTP client with sensible timeouts
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .context("building http client")?;

        Ok(Self { config, client })
    }

    pub fn scan_and_upload(&self) -> Result<()> {
        // gather candidate files
        let mut files: Vec<PathBuf> = Vec::new();
        for entry in WalkDir::new(&self.config.watch_dir).max_depth(1) {
            let entry = match entry { Ok(e) => e, Err(_) => continue };
            let p = entry.path().to_path_buf();
            if p.is_file() && is_complete_json(&p) {
                files.push(p);
            }
        }

        if !files.is_empty() {
            println!("found {} file(s) to upload", files.len());
        }

        // process files sequentially for now (can be made parallel later)
        for p in files {
            if let Err(e) = process_file(&self.client, &self.config, &p) {
                eprintln!("⚠️  failed processing {}: {e:?}", p.display());
            }
        }

        Ok(())
    }

    pub fn start_background_uploader() -> Result<()> {
        let uploader = AwsUploader::new()?;
        let scan_secs = uploader.config.scan_interval_secs.unwrap_or(60);

        // Start background thread
        std::thread::spawn(move || {
            loop {
                if let Err(e) = uploader.scan_and_upload() {
                    eprintln!("⚠️  uploader error: {e:?}");
                }
                thread::sleep(Duration::from_secs(scan_secs));
            }
        });

        Ok(())
    }
}
