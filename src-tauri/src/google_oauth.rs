use anyhow::{anyhow, Result};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::Duration;
use std::fs;
use std::path::PathBuf;
use base64::Engine;
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug)]
struct GoogleTokens {
  access_token: String,
  expires_in: Option<u64>,
  refresh_token: Option<String>,
  scope: Option<String>,
  token_type: Option<String>,
  id_token: Option<String>,
  obtained_at_ms: u128,
}

fn b64_url_no_pad(input: &[u8]) -> String {
  base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(input)
}

fn generate_pkce_pair() -> (String, String) {
  // code_verifier must be 43-128 chars
  let verifier: String = rand::thread_rng()
    .sample_iter(&Alphanumeric)
    .take(64)
    .map(char::from)
    .collect();
  let challenge = {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let digest = hasher.finalize();
    b64_url_no_pad(&digest)
  };
  (verifier, challenge)
}

fn load_env(var: &str) -> Result<String> {
  std::env::var(var).map_err(|_| anyhow!("Missing environment variable: {}", var))
}

fn tokens_path(app: &tauri::AppHandle) -> Result<PathBuf> {
  let mut path = app
    .path()
    .app_data_dir()
    .map_err(|e| anyhow!("Failed to resolve app data dir: {}", e))?;
  path.push("google_oauth");
  fs::create_dir_all(&path).ok();
  path.push("tokens.json");
  Ok(path)
}

fn save_tokens(app: &tauri::AppHandle, tokens: &GoogleTokens) -> Result<()> {
  let path = tokens_path(app)?;
  let json = serde_json::to_string_pretty(tokens)?;
  fs::write(&path, json)?;
  
  // Automatically bridge tokens to MCP directories
  let _ = bridge_tokens_to_mcp(app, tokens);
  
  Ok(())
}

fn bridge_tokens_to_mcp(_app: &tauri::AppHandle, tokens: &GoogleTokens) -> Result<()> {
  // Create MCP-compatible credentials format
  let mcp_credentials = serde_json::json!({
      "access_token": tokens.access_token,
      "refresh_token": tokens.refresh_token,
      "scope": tokens.scope,
      "token_type": tokens.token_type.as_ref().unwrap_or(&"Bearer".to_string()),
      "expiry_date": if let Some(expires_in) = tokens.expires_in {
          tokens.obtained_at_ms + (expires_in as u128 * 1000)
      } else {
          tokens.obtained_at_ms + (3600 * 1000) // Default 1 hour
      }
  });
  
  // Get home directory
  let home_dir = dirs::home_dir().ok_or_else(|| anyhow!("Could not find home directory"))?;
  
  // Create both calendar and gmail MCP config directories
  let calendar_config_dir = home_dir.join(".calendar-mcp");
  let gmail_config_dir = home_dir.join(".gmail-mcp");
  
  fs::create_dir_all(&calendar_config_dir)?;
  fs::create_dir_all(&gmail_config_dir)?;
  
  // Write credentials for both services
  let calendar_creds_path = calendar_config_dir.join("credentials.json");
  let gmail_creds_path = gmail_config_dir.join("credentials.json");
  
  let creds_json = serde_json::to_string_pretty(&mcp_credentials)?;
  fs::write(&calendar_creds_path, &creds_json)?;
  fs::write(&gmail_creds_path, &creds_json)?;
  
  // Create OAuth client config for both services if env vars are available
  if let Ok(client_id) = std::env::var("GOOGLE_CLIENT_ID") {
      let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();
      
      let oauth_config = serde_json::json!({
          "installed": {
              "client_id": client_id,
              "client_secret": client_secret,
              "auth_uri": "https://accounts.google.com/o/oauth2/auth",
              "token_uri": "https://oauth2.googleapis.com/token",
              "redirect_uris": ["http://localhost:3000/oauth2callback"]
          }
      });
      
      let calendar_oauth_path = calendar_config_dir.join("gcp-oauth.keys.json");
      let gmail_oauth_path = gmail_config_dir.join("gcp-oauth.keys.json");
      
      let oauth_json = serde_json::to_string_pretty(&oauth_config)?;
      fs::write(&calendar_oauth_path, &oauth_json)?;
      fs::write(&gmail_oauth_path, &oauth_json)?;
  }
  
  Ok(())
}

fn open_in_browser(url: &str) -> Result<()> {
  if webbrowser::open(url).is_ok() {
    Ok(())
  } else {
    Err(anyhow!("Failed to open browser for URL"))
  }
}

#[tauri::command]
pub fn is_google_connected(app: tauri::AppHandle) -> Result<bool, String> {
  let path = match tokens_path(&app) {
    Ok(p) => p,
    Err(_) => return Ok(false),
  };
  Ok(path.exists())
}

#[tauri::command]
pub fn disconnect_google_suite(app: tauri::AppHandle) -> Result<String, String> {
  // Attempt token revoke (best-effort)
  let path = tokens_path(&app).map_err(|e| e.to_string())?;
  if path.exists() {
    if let Ok(content) = fs::read_to_string(&path) {
      if let Ok(tokens) = serde_json::from_str::<GoogleTokens>(&content) {
        let revoke_token = tokens.refresh_token.as_deref().unwrap_or(&tokens.access_token);
        let client = reqwest::blocking::Client::new();
        let _ = client
          .post("https://oauth2.googleapis.com/revoke")
          .form(&[("token", revoke_token)])
          .send();
      }
    }
    let _ = fs::remove_file(&path);
  }
  Ok("Disconnected from Google Suite".to_string())
}

#[tauri::command]
pub fn connect_google_suite(app: tauri::AppHandle) -> Result<String, String> {
  // Load .env (safe to call multiple times; no-op if already loaded)
  let _ = dotenvy::dotenv();

  // Read secrets from env
  let client_id = load_env("GOOGLE_CLIENT_ID").map_err(|e| e.to_string())?;
  // Prefer PKCE flow (no need for client secret), but allow secret if present
  let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").ok();

  // Scopes for Gmail and Calendar (read and write access for MCP servers)
  let scopes = vec![
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
  ].join(" ");

  // Start ephemeral local server for OAuth redirect
  let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
  listener
    .set_nonblocking(false)
    .map_err(|e| e.to_string())?;
  let redirect_port = listener.local_addr().map_err(|e| e.to_string())?.port();
  let redirect_uri = format!("http://127.0.0.1:{}", redirect_port);

  let (code_verifier, code_challenge) = generate_pkce_pair();

  // Build authorization URL (use v2 endpoint)
  let auth_url = format!(
    "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={client_id}&redirect_uri={redirect_uri}&scope={scopes}&access_type=offline&prompt=consent&code_challenge={code_challenge}&code_challenge_method=S256",
  );

  open_in_browser(&auth_url).map_err(|e| e.to_string())?;

  // Accept single connection for redirect
  // Simple HTTP parsing sufficient for this loopback
  listener
    .set_nonblocking(false)
    .map_err(|e| e.to_string())?;

  let (mut stream, _) = listener.accept().map_err(|e| e.to_string())?;
  stream
    .set_read_timeout(Some(Duration::from_secs(120)))
    .ok();

  let mut buffer = [0; 8192];
  let n = stream.read(&mut buffer).map_err(|e| e.to_string())?;
  let req = String::from_utf8_lossy(&buffer[..n]);

  // Parse the first line: GET /?code=... HTTP/1.1
  let first_line = req.lines().next().unwrap_or("");
  let code_opt = first_line
    .split_whitespace()
    .nth(1)
    .and_then(|path| {
      let parts: Vec<&str> = path.split('?').collect();
      if parts.len() < 2 { return None; }
      let query = parts[1];
      for kv in query.split('&') {
        let mut it = kv.splitn(2, '=');
        let k = it.next()?;
        let v = it.next().unwrap_or("");
        if k == "code" { return Some(urlencoding::decode(v).ok()?.to_string()); }
      }
      None
    });

  let code = match code_opt {
    Some(c) => c,
    None => {
      let _ = stream.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\nContent-Length: 12\r\n\r\nBad Request");
      return Err("Authorization code not found in redirect".into());
    }
  };

  // Respond to browser so user can close the tab
  let _ = stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h2>Google authorization received.</h2><p>You can close this window and return to ArkAngel.</p></body></html>");

  // Exchange code for tokens
  let token_endpoint = "https://oauth2.googleapis.com/token";
  let client = reqwest::blocking::Client::new();

  let mut form = vec![
    ("code", code.as_str()),
    ("client_id", client_id.as_str()),
    ("redirect_uri", redirect_uri.as_str()),
    ("grant_type", "authorization_code"),
    ("code_verifier", code_verifier.as_str()),
  ];
  if let Some(ref secret) = client_secret {
    form.push(("client_secret", secret.as_str()));
  }

  let resp = client
    .post(token_endpoint)
    .form(&form)
    .send()
    .map_err(|e| e.to_string())?;

  if !resp.status().is_success() {
    let text = resp.text().unwrap_or_default();
    return Err(format!("Token exchange failed: {}", text));
  }

  #[derive(Deserialize)]
  struct TokenResp {
    access_token: String,
    expires_in: Option<u64>,
    refresh_token: Option<String>,
    scope: Option<String>,
    token_type: Option<String>,
    id_token: Option<String>,
  }

  let token_resp: TokenResp = resp.json().map_err(|e| e.to_string())?;

  let tokens = GoogleTokens {
    access_token: token_resp.access_token,
    expires_in: token_resp.expires_in,
    refresh_token: token_resp.refresh_token,
    scope: token_resp.scope,
    token_type: token_resp.token_type,
    id_token: token_resp.id_token,
    obtained_at_ms: std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| e.to_string())?
      .as_millis(),
  };

  save_tokens(&app, &tokens).map_err(|e| e.to_string())?;

  Ok("Google Suite connected successfully".to_string())
} 