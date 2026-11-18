use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Tiny TTL cache for content endpoints and the i18n catalog — one entry
/// per logical response, refreshed at most once per TTL window.
pub struct TtlCache {
    map: RwLock<HashMap<String, (Instant, Arc<Value>)>>,
    ttl: Duration,
}

impl TtlCache {
    pub fn new(ttl_secs: u64) -> Self {
        Self { map: RwLock::new(HashMap::new()), ttl: Duration::from_secs(ttl_secs) }
    }

    pub async fn get(&self, key: &str) -> Option<Arc<Value>> {
        let map = self.map.read().await;
        match map.get(key) {
            Some((at, v)) if at.elapsed() < self.ttl => Some(Arc::clone(v)),
            _ => None,
        }
    }

    pub async fn put(&self, key: &str, value: Value) {
        let mut map = self.map.write().await;
        map.insert(key.to_string(), (Instant::now(), Arc::new(value)));
    }
}
