//! Message catalogs for server-side label resolution — static
//! messages/{locale}.json overlaid by the DB i18n_messages (DB wins),
//! TTL-cached 60s. The same merge next-intl's request config applies.

use crate::state::St;
use crate::util::*;
use serde_json::{Map, Value};

fn read_static(st: &St, locale: &str) -> Option<Value> {
    let p = st.cfg.root.join(format!("messages/{locale}.json"));
    let text = std::fs::read_to_string(p).ok()?;
    serde_json::from_str(&text).ok()
}

fn deep_merge(base: &mut Value, over: &Value) {
    match (base, over) {
        (Value::Object(b), Value::Object(o)) => {
            for (k, v) in o {
                match b.get_mut(k) {
                    Some(slot) if slot.is_object() && v.is_object() => deep_merge(slot, v),
                    _ => {
                        b.insert(k.clone(), v.clone());
                    }
                }
            }
        }
        (b, o) => *b = o.clone(),
    }
}

/// The merged catalog for a locale (static file + DB rows over it).
pub async fn messages_for(st: &St, locale: &str) -> Value {
    let loc = match locale {
        "en" => "en",
        "ru" => "ru",
        _ => "az",
    };
    let key = format!("messages:{loc}");
    if let Some(hit) = st.ttl_get(&key) {
        return hit;
    }
    let mut out = read_static(st, loc).unwrap_or(Value::Object(Map::new()));
    if let Ok(db) = crate::content::i18n_catalog(st, loc).await {
        if db.is_object() {
            deep_merge(&mut out, &db);
        }
    }
    st.ttl_put(&key, out.clone());
    out
}

/// Resolve "a.b.c" against the merged catalog of a locale.
pub async fn lookup(st: &St, locale: &str, path: &str) -> Option<String> {
    let tree = messages_for(st, locale).await;
    msg_path(&tree, path).map(String::from)
}
