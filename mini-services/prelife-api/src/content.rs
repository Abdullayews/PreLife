//! Content assembly — the port of lib/server/content.ts. Reads the
//! normalized tables and rebuilds the exact JSON the frontend expects
//! (same keys, same shapes, same ordering), TTL-cached 60s in-process.

use crate::error::DomainError;
use crate::state::St;
use crate::util::*;
use serde_json::{json, Map, Value};

type Res<T> = Result<T, DomainError>;

async fn sel(st: &St, table: &str, params: &[(&str, &str)]) -> Res<Vec<Row>> {
    let p: Vec<(String, String)> = params.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
    st.supa.select(table, &p).await.map_err(DomainError::from_supa)
}

fn v(row: &Row) -> Value {
    Value::Object(row.clone())
}

/* ── Row-grouping helpers ─────────────────────────────────────────────── */

fn group_str<'a>(rows: &'a [Row], key: &str) -> std::collections::HashMap<String, Vec<&'a Row>> {
    let mut map = std::collections::HashMap::new();
    for r in rows {
        let k = s(&v(r), key);
        if !k.is_empty() {
            map.entry(k).or_insert_with(Vec::new).push(r);
        }
    }
    map
}

fn group_num<'a>(rows: &'a [Row], key: &str) -> std::collections::HashMap<i64, Vec<&'a Row>> {
    let mut map = std::collections::HashMap::new();
    for r in rows {
        if let Some(k) = i64_opt(&v(r), key) {
            map.entry(k).or_insert_with(Vec::new).push(r);
        }
    }
    map
}

fn sorted_by_order<'a>(list: &[&'a Row], key: &str) -> Vec<&'a Row> {
    let mut out: Vec<&Row> = list.to_vec();
    out.sort_by_key(|r| i64_opt(&v(r), key).unwrap_or(0));
    out
}

/* ── Shared world assembly ────────────────────────────────────────────── */

async fn world_rows(st: &St, world_id: &str) -> Res<(Value, Value, Value, Value)> {
    let wf = format!("eq.{world_id}");

    let plans = sel(st, "world_plans", &[("select", "*"), ("world_id", &wf), ("order", "sort_order.asc")]).await?;
    let all_metas = sel(st, "world_plan_meta", &[("select", "plan_id,meta_key,value")]).await?;
    let plan_ids: Vec<i64> = plans.iter().filter_map(|p| i64_opt(&v(p), "id")).collect();
    let metas: Vec<&Row> = all_metas
        .iter()
        .filter(|m| i64_opt(&v(m), "plan_id").map(|id| plan_ids.contains(&id)).unwrap_or(false))
        .collect();

    let items = sel(st, "world_items", &[("select", "*"), ("world_id", &wf), ("order", "sort_order.asc")]).await?;
    let places = sel(st, "world_places", &[("select", "*"), ("world_id", &wf), ("order", "sort_order.asc")]).await?;
    let place_feats = sel(st, "world_place_features", &[("select", "place_id,feature_key,sort_order")]).await?;

    let slots = sel(st, "world_schedule_slots", &[("select", "*"), ("world_id", &wf), ("order", "sort_order.asc")]).await?;
    let kinds = sel(st, "world_schedule_kinds", &[("select", "code,label_key,sort_order"), ("world_id", &wf), ("order", "sort_order.asc")]).await?;
    let all_cells = sel(st, "world_schedule_cells", &[("select", "slot_id,day_index,cell_code")]).await?;
    let slot_ids: Vec<i64> = slots.iter().filter_map(|x| i64_opt(&v(x), "id")).collect();
    let cells: Vec<&Row> = all_cells
        .iter()
        .filter(|c| i64_opt(&v(c), "slot_id").map(|id| slot_ids.contains(&id)).unwrap_or(false))
        .collect();

    let metas_owned: Vec<Row> = metas.iter().map(|r| (*r).clone()).collect();
    let meta_by_plan = group_num(&metas_owned, "plan_id");
    let feat_by_place = group_num(&place_feats, "place_id");
    let cells_owned: Vec<Row> = cells.iter().map(|r| (*r).clone()).collect();
    let cells_by_slot = group_num(&cells_owned, "slot_id");

    let plans_json: Vec<Value> = plans
        .iter()
        .map(|p| {
            let id = i64_opt(&v(p), "id").unwrap_or(0);
            let meta: Vec<Value> = meta_by_plan
                .get(&id)
                .map(|list| {
                    list.iter()
                        .map(|m| json!([s(&v(m), "meta_key"), v(m).get("value").cloned().unwrap_or(Value::Null)]))
                        .collect()
                })
                .unwrap_or_default();
            json!({
                "id": s(&v(p), "slug"),
                "nameKey": s(&v(p), "name_key"),
                "descKey": s(&v(p), "desc_key"),
                "image": s(&v(p), "image_url"),
                "level": s(&v(p), "level"),
                "featured": is_true(&v(p), "featured"),
                "meta": meta,
            })
        })
        .collect();

    let items_json: Vec<Value> = items
        .iter()
        .map(|it| {
            json!({
                "id": s(&v(it), "slug"),
                "nameKey": s(&v(it), "name_key"),
                "targetKey": s(&v(it), "target_key"),
                "icon": s(&v(it), "icon"),
                "level": s(&v(it), "level"),
            })
        })
        .collect();

    let places_json: Vec<Value> = places
        .iter()
        .map(|p| {
            let id = i64_opt(&v(p), "id").unwrap_or(0);
            let feats: Vec<Value> = feat_by_place
                .get(&id)
                .map(|list| sorted_by_order(list, "sort_order").iter().map(|f| json!(s(&v(f), "feature_key"))).collect())
                .unwrap_or_default();
            json!({
                "id": s(&v(p), "slug"),
                "nameKey": s(&v(p), "name_key"),
                "descKey": s(&v(p), "desc_key"),
                "image": s(&v(p), "image_url"),
                "rating": v(p).get("rating").cloned().unwrap_or(Value::Null),
                "featureKeys": feats,
            })
        })
        .collect();

    let mut cell_keys = Map::new();
    for k in &kinds {
        cell_keys.insert(s(&v(k), "code"), json!(s(&v(k), "label_key")));
    }

    let slots_json: Vec<Value> = slots
        .iter()
        .map(|slot| {
            let id = i64_opt(&v(slot), "id").unwrap_or(0);
            let mut day_cells: Vec<(i64, String)> = cells_by_slot
                .get(&id)
                .map(|list| {
                    list.iter()
                        .filter_map(|c| i64_opt(&v(c), "day_index").map(|d| (d, s(&v(c), "cell_code"))))
                        .collect()
                })
                .unwrap_or_default();
            day_cells.sort_by_key(|(d, _)| *d);
            json!({
                "time": s(&v(slot), "time"),
                "labelKey": s(&v(slot), "label_key"),
                "cells": day_cells.into_iter().map(|(_, code)| code).collect::<Vec<_>>(),
            })
        })
        .collect();

    Ok((
        json!(plans_json),
        json!(items_json),
        json!(places_json),
        json!({ "slots": slots_json, "cellKeys": cell_keys }),
    ))
}

/* ── GET /api/content/worlds ──────────────────────────────────────────── */

pub async fn worlds_catalog(st: &St) -> Option<Value> {
    if !st.cfg.db_ready() {
        return None;
    }
    if let Some(hit) = st.ttl_get("content:worlds") {
        return Some(hit);
    }
    let build = async {
        let world_list = sel(st, "worlds", &[("select", "*"), ("order", "sort_order.asc")]).await?;
        let cando = sel(st, "world_cando", &[("select", "world_id,icon,title_key,desc_key,sort_order")]).await?;
        let cando_by_world = group_str(&cando, "world_id");

        let mut worlds_map = Map::new();
        for w in &world_list {
            let id = s(&v(w), "id");
            let (plans, items, places, schedule) = world_rows(st, &id).await?;
            let can_do: Vec<Value> = cando_by_world
                .get(&id)
                .map(|list| {
                    sorted_by_order(list, "sort_order")
                        .iter()
                        .map(|c| {
                            json!({
                                "icon": s(&v(c), "icon"),
                                "titleKey": s(&v(c), "title_key"),
                                "descKey": s(&v(c), "desc_key"),
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            worlds_map.insert(
                id.clone(),
                json!({
                    "slug": id,
                    "ns": s(&v(w), "ns"),
                    "ids": {
                        "plans": s(&v(w), "anchor_plans"),
                        "items": s(&v(w), "anchor_items"),
                        "places": s(&v(w), "anchor_places"),
                    },
                    "prefix": {
                        "items": s(&v(w), "prefix_items"),
                        "places": s(&v(w), "prefix_places"),
                    },
                    "hero": {
                        "images": v(w).get("hero_images").cloned().unwrap_or(json!([])),
                        "positions": v(w).get("hero_positions").cloned().unwrap_or(json!([])),
                        "stats": v(w).get("hero_stats").cloned().unwrap_or(json!([])),
                    },
                    "plans": plans,
                    "items": items,
                    "canDo": can_do,
                    "schedule": schedule,
                    "initials": v(w).get("initials").cloned().unwrap_or(json!([])),
                    "places": places,
                }),
            );
        }

        // Landing frames: the banner still-life + each world's lead photo.
        let mut frames: Vec<Value> = vec![json!({ "src": "/img/banner.png", "pos": "center" })];
        for w in &world_list {
            let images = v(w).get("hero_images").and_then(|x| x.as_array()).cloned().unwrap_or_default();
            let positions = v(w).get("hero_positions").and_then(|x| x.as_array()).cloned().unwrap_or_default();
            if let (Some(img), Some(pos)) = (images.first(), positions.first()) {
                if img.is_string() {
                    frames.push(json!({ "src": img, "pos": pos }));
                }
            }
        }
        Ok::<Value, DomainError>(json!({ "worlds": worlds_map, "landingFrames": frames }))
    };
    match build.await {
        Ok(out) => {
            st.ttl_put("content:worlds", out.clone());
            Some(out)
        }
        Err(e) => {
            eprintln!("[content:worlds] {e}");
            None
        }
    }
}

/* ── GET /api/content/gym ─────────────────────────────────────────────── */

pub async fn gym_catalog(st: &St) -> Option<Value> {
    if !st.cfg.db_ready() {
        return None;
    }
    if let Some(hit) = st.ttl_get("content:gym") {
        return Some(hit);
    }
    let build = async {
        let (world_plans, _world_items, _world_places, world_schedule) = world_rows(st, "gym").await?;

        let places = sel(st, "gym_places", &[("select", "*"), ("order", "sort_order.asc")]).await?;
        let feats = sel(st, "gym_place_features", &[("select", "gym_place_id,feature_key,sort_order")]).await?;
        let equipment = sel(st, "gym_place_equipment", &[("select", "gym_place_id,equipment_code,sort_order")]).await?;
        let trainers = sel(st, "gym_trainers", &[("select", "gym_place_id,name,spec_code,years,sort_order")]).await?;

        let feat_by = group_num(&feats, "gym_place_id");
        let eq_by = group_num(&equipment, "gym_place_id");
        let tr_by = group_num(&trainers, "gym_place_id");

        let places_json: Vec<Value> = places
            .iter()
            .map(|p| {
                let id = i64_opt(&v(p), "id").unwrap_or(0);
                let feature_keys: Vec<Value> = feat_by
                    .get(&id)
                    .map(|l| l.iter().map(|f| json!(s(&v(f), "feature_key"))).collect())
                    .unwrap_or_default();
                let eq: Vec<Value> = eq_by
                    .get(&id)
                    .map(|l| sorted_by_order(l, "sort_order").iter().map(|e| json!(s(&v(e), "equipment_code"))).collect())
                    .unwrap_or_default();
                let tr: Vec<Value> = tr_by
                    .get(&id)
                    .map(|l| {
                        sorted_by_order(l, "sort_order")
                            .iter()
                            .map(|t| {
                                json!({
                                    "name": s(&v(t), "name"),
                                    "spec": s(&v(t), "spec_code"),
                                    "years": i64_opt(&v(t), "years").unwrap_or(0),
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                json!({
                    "id": s(&v(p), "slug"),
                    "ns": s(&v(p), "ns"),
                    "nameKey": s(&v(p), "name_key"),
                    "descKey": s(&v(p), "desc_key"),
                    "image": s(&v(p), "image_url"),
                    "rating": v(p).get("rating").cloned().unwrap_or(Value::Null),
                    "featureKeys": feature_keys,
                    "address": s(&v(p), "address"),
                    "hours": s(&v(p), "hours"),
                    "dayPrice": v(p).get("day_price").cloned().unwrap_or(Value::Null),
                    "equipment": eq,
                    "trainers": tr,
                })
            })
            .collect();

        let eq_master = sel(st, "gym_equipment", &[("select", "code,name_key"), ("order", "sort_order.asc")]).await?;
        let spec_master = sel(st, "gym_trainer_specs", &[("select", "code,name_key"), ("order", "sort_order.asc")]).await?;
        let mut equipment_registry = Map::new();
        for e in &eq_master {
            equipment_registry.insert(s(&v(e), "code"), json!({ "nameKey": s(&v(e), "name_key") }));
        }
        let mut trainer_specs = Map::new();
        for sp in &spec_master {
            trainer_specs.insert(s(&v(sp), "code"), json!({ "nameKey": s(&v(sp), "name_key") }));
        }

        let stores = sel(st, "gym_stores", &[("select", "*"), ("order", "sort_order.asc")]).await?;
        let mut stores_map = Map::new();
        for srow in &stores {
            stores_map.insert(
                s(&v(srow), "slug"),
                json!({
                    "slug": s(&v(srow), "slug"),
                    "name": s(&v(srow), "name"),
                    "kind": s(&v(srow), "kind"),
                    "url": s(&v(srow), "url"),
                }),
            );
        }

        let products = sel(st, "gym_products", &[("select", "*"), ("order", "category.asc,sort_order.asc")]).await?;
        let offers = sel(st, "gym_product_offers", &[("select", "product_id,store_slug,price,sort_order")]).await?;
        let offers_by = group_num(&offers, "product_id");
        let mut catalog = Map::new();
        for cat in ["equipment", "supplements", "accessories", "clothing"] {
            let list: Vec<Value> = products
                .iter()
                .filter(|p| s(&v(p), "category") == cat)
                .map(|p| {
                    let id = i64_opt(&v(p), "id").unwrap_or(0);
                    let at: Vec<Value> = offers_by
                        .get(&id)
                        .map(|l| {
                            sorted_by_order(l, "sort_order")
                                .iter()
                                .map(|o| {
                                    json!({
                                        "store": s(&v(o), "store_slug"),
                                        "price": v(o).get("price").cloned().unwrap_or(Value::Null),
                                    })
                                })
                                .collect()
                        })
                        .unwrap_or_default();
                    json!({
                        "id": s(&v(p), "slug"),
                        "nameKey": s(&v(p), "name_key"),
                        "brand": s(&v(p), "brand"),
                        "icon": s(&v(p), "icon"),
                        "price": [
                            v(p).get("price_min").cloned().unwrap_or(Value::Null),
                            v(p).get("price_max").cloned().unwrap_or(Value::Null),
                        ],
                        "image": v(p).get("image_url").cloned().unwrap_or(Value::Null),
                        "at": at,
                    })
                })
                .collect();
            catalog.insert(cat.to_string(), json!(list));
        }

        let exercises = sel(st, "gym_exercises", &[("select", "code,name_key,target_key,guide_key,sort_order"), ("order", "sort_order.asc")]).await?;
        let mut ex_map = Map::new();
        for ex in &exercises {
            ex_map.insert(
                s(&v(ex), "code"),
                json!({
                    "nameKey": s(&v(ex), "name_key"),
                    "targetKey": s(&v(ex), "target_key"),
                    "guideKey": s(&v(ex), "guide_key"),
                }),
            );
        }

        let gym_plans = sel(st, "world_plans", &[("select", "id,slug"), ("world_id", "eq.gym"), ("order", "sort_order.asc")]).await?;
        let mut plan_slug_by_id = std::collections::HashMap::new();
        for p in &gym_plans {
            if let Some(id) = i64_opt(&v(p), "id") {
                plan_slug_by_id.insert(id, s(&v(p), "slug"));
            }
        }
        let days = sel(st, "gym_workout_days", &[("select", "id,plan_id,day,sort_order")]).await?;
        let wex = sel(st, "gym_workout_exercises", &[("select", "day_id,exercise_code,sets,reps_type,reps_a,reps_b,rest_seconds,sort_order")]).await?;
        let wex_by_day = group_num(&wex, "day_id");

        let mut workouts = Map::new();
        for d in &days {
            let plan_id = i64_opt(&v(d), "plan_id").unwrap_or(0);
            let Some(plan_slug) = plan_slug_by_id.get(&plan_id).cloned() else { continue };
            let day_id = i64_opt(&v(d), "id").unwrap_or(0);
            let list: Vec<Value> = wex_by_day
                .get(&day_id)
                .map(|l| {
                    sorted_by_order(l, "sort_order")
                        .iter()
                        .map(|e| {
                            let reps = if v(e).get("reps_b").map(|b| b.is_number()).unwrap_or(false) {
                                json!({
                                    "t": s(&v(e), "reps_type"),
                                    "a": v(e).get("reps_a").cloned().unwrap_or(Value::Null),
                                    "b": v(e).get("reps_b").cloned().unwrap_or(Value::Null),
                                })
                            } else {
                                json!({
                                    "t": s(&v(e), "reps_type"),
                                    "a": v(e).get("reps_a").cloned().unwrap_or(Value::Null),
                                })
                            };
                            json!({
                                "ex": s(&v(e), "exercise_code"),
                                "sets": v(e).get("sets").cloned().unwrap_or(Value::Null),
                                "reps": reps,
                                "rest": i64_opt(&v(e), "rest_seconds").unwrap_or(0),
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            let entry = json!({ "day": i64_opt(&v(d), "day").unwrap_or(1), "exercises": list });
            match workouts.get_mut(&plan_slug) {
                Some(Value::Array(arr)) => arr.push(entry),
                _ => {
                    workouts.insert(plan_slug, json!([entry]));
                }
            }
        }

        let progress = sel(st, "gym_plan_progress", &[("select", "plan_id,week,total")]).await?;
        let mut plan_weeks = Map::new();
        for p in &progress {
            let plan_id = i64_opt(&v(p), "plan_id").unwrap_or(0);
            if let Some(slug) = plan_slug_by_id.get(&plan_id) {
                plan_weeks.insert(
                    slug.clone(),
                    json!({
                        "week": i64_opt(&v(p), "week").unwrap_or(1),
                        "total": i64_opt(&v(p), "total").unwrap_or(1),
                    }),
                );
            }
        }

        Ok::<Value, DomainError>(json!({
            "plans": world_plans,
            "schedule": world_schedule,
            "places": places_json,
            "stores": stores_map,
            "equipmentRegistry": equipment_registry,
            "trainerSpecs": trainer_specs,
            "catalog": catalog,
            "exercises": ex_map,
            "workouts": workouts,
            "planWeeks": plan_weeks,
        }))
    };
    match build.await {
        Ok(out) => {
            st.ttl_put("content:gym", out.clone());
            Some(out)
        }
        Err(e) => {
            eprintln!("[content:gym] {e}");
            None
        }
    }
}

/* ── GET /api/content/diet ────────────────────────────────────────────── */

pub async fn diet_catalog(st: &St) -> Option<Value> {
    if !st.cfg.db_ready() {
        return None;
    }
    if let Some(hit) = st.ttl_get("content:diet") {
        return Some(hit);
    }
    let build = async {
        let (plans, recipes, places, _schedule) = world_rows(st, "diet").await?;

        let recipe_rows = sel(st, "diet_recipes", &[("select", "slug,minutes,kcal")]).await?;
        let ingredients = sel(st, "diet_recipe_ingredients", &[("select", "recipe_slug,ingredient_key,sort_order")]).await?;
        let ing_by = group_str(&ingredients, "recipe_slug");
        let mut recipe_details = Map::new();
        for r in &recipe_rows {
            let slug = s(&v(r), "slug");
            let ing: Vec<Value> = ing_by
                .get(&slug)
                .map(|l| sorted_by_order(l, "sort_order").iter().map(|i| json!(s(&v(i), "ingredient_key"))).collect())
                .unwrap_or_default();
            recipe_details.insert(
                slug.clone(),
                json!({
                    "id": slug,
                    "minutes": v(r).get("minutes").cloned().unwrap_or(Value::Null),
                    "kcal": v(r).get("kcal").cloned().unwrap_or(Value::Null),
                    "ingredients": ing,
                }),
            );
        }

        let place_rows = sel(st, "world_places", &[("select", "id,slug"), ("world_id", "eq.diet")]).await?;
        let mut slug_by_place_id = std::collections::HashMap::new();
        for p in &place_rows {
            if let Some(id) = i64_opt(&v(p), "id") {
                slug_by_place_id.insert(id, s(&v(p), "slug"));
            }
        }
        let details = sel(st, "diet_place_details", &[("select", "place_id,address,hours,map_query")]).await?;
        let mut venue_details = Map::new();
        for d in &details {
            let pid = i64_opt(&v(d), "place_id").unwrap_or(0);
            if let Some(slug) = slug_by_place_id.get(&pid) {
                venue_details.insert(
                    slug.clone(),
                    json!({
                        "id": slug,
                        "address": s(&v(d), "address"),
                        "hours": s(&v(d), "hours"),
                        "mapQuery": s(&v(d), "map_query"),
                    }),
                );
            }
        }

        Ok::<Value, DomainError>(json!({
            "plans": plans,
            "recipes": recipes,
            "places": places,
            "recipeDetails": recipe_details,
            "venueDetails": venue_details,
        }))
    };
    match build.await {
        Ok(out) => {
            st.ttl_put("content:diet", out.clone());
            Some(out)
        }
        Err(e) => {
            eprintln!("[content:diet] {e}");
            None
        }
    }
}

/* ── GET /api/content/meditation ──────────────────────────────────────── */

pub async fn meditation_catalog(st: &St) -> Option<Value> {
    if !st.cfg.db_ready() {
        return None;
    }
    if let Some(hit) = st.ttl_get("content:meditation") {
        return Some(hit);
    }
    let build = async {
        let (plans, sessions, mentors, _schedule) = world_rows(st, "meditation").await?;

        let psy = sel(st, "psychologists_v2", &[("select", "*"), ("order", "sort_order.asc")]).await?;
        let psy_specs = sel(st, "psychologist_specialties", &[("select", "psychologist_slug,specialty_code,sort_order")]).await?;
        let psy_formats = sel(st, "psychologist_formats", &[("select", "psychologist_slug,format,sort_order")]).await?;
        let psy_langs = sel(st, "psychologist_languages", &[("select", "psychologist_slug,lang,sort_order")]).await?;
        let psy_avail = sel(st, "psychologist_availability", &[("select", "psychologist_slug,day,from_hour,to_hour,sort_order")]).await?;
        let psy_certs = sel(st, "psychologist_certificates", &[("select", "psychologist_slug,cert_key,sort_order")]).await?;

        let specs_by = group_str(&psy_specs, "psychologist_slug");
        let formats_by = group_str(&psy_formats, "psychologist_slug");
        let langs_by = group_str(&psy_langs, "psychologist_slug");
        let avail_by = group_str(&psy_avail, "psychologist_slug");
        let certs_by = group_str(&psy_certs, "psychologist_slug");

        let sorted_codes = |list: Option<&Vec<&Row>>, key: &str| -> Vec<Value> {
            list.map(|l| sorted_by_order(l, "sort_order").iter().map(|r| json!(s(&v(r), key))).collect())
                .unwrap_or_default()
        };

        let psy_json: Vec<Value> = psy
            .iter()
            .map(|p| {
                let slug = s(&v(p), "slug");
                let avail: Vec<Value> = avail_by
                    .get(&slug)
                    .map(|l| {
                        sorted_by_order(l, "sort_order")
                            .iter()
                            .map(|a| {
                                json!({
                                    "day": v(a).get("day").cloned().unwrap_or(Value::Null),
                                    "from": v(a).get("from_hour").cloned().unwrap_or(Value::Null),
                                    "to": v(a).get("to_hour").cloned().unwrap_or(Value::Null),
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                json!({
                    "slug": slug,
                    "nameKey": s(&v(p), "name_key"),
                    "titleKey": s(&v(p), "title_key"),
                    "bioKey": s(&v(p), "bio_key"),
                    "image": s(&v(p), "image_url"),
                    "rating": v(p).get("rating").cloned().unwrap_or(Value::Null),
                    "price": v(p).get("price").cloned().unwrap_or(Value::Null),
                    "specialties": sorted_codes(specs_by.get(&slug), "specialty_code"),
                    "formats": sorted_codes(formats_by.get(&slug), "format"),
                    "languages": sorted_codes(langs_by.get(&slug), "lang"),
                    "availability": avail,
                    "initials": s(&v(p), "initials"),
                    "since": i64_opt(&v(p), "since_year").unwrap_or(2000),
                    "eduKey": s(&v(p), "edu_key"),
                    "certKeys": sorted_codes(certs_by.get(&slug), "cert_key"),
                    "rulesKey": s(&v(p), "rules_key"),
                })
            })
            .collect();

        let media = sel(st, "media_resources", &[("select", "*"), ("collection", "eq.practice"), ("order", "sort_order.asc")]).await?;
        let tdb = sel(st, "media_resources", &[("select", "*"), ("collection", "eq.tdb"), ("order", "sort_order.asc")]).await?;

        let media_view = |m: &Row| {
            json!({
                "id": s(&v(m), "id"),
                "kind": s(&v(m), "kind"),
                "titleKey": s(&v(m), "title_key"),
                "descKey": s(&v(m), "desc_key"),
                "minutes": v(m).get("minutes").cloned().unwrap_or(Value::Null),
                "src": s(&v(m), "src"),
                "poster": s(&v(m), "poster"),
            })
        };

        let quizzes = sel(st, "quizzes", &[("select", "code,question_count"), ("order", "sort_order.asc")]).await?;
        let quizzes_json: Vec<Value> = quizzes
            .iter()
            .map(|q| json!({ "id": s(&v(q), "code"), "questions": v(q).get("question_count").cloned().unwrap_or(Value::Null) }))
            .collect();

        let mood_tags = sel(st, "mood_tags", &[("select", "code"), ("order", "sort_order.asc")]).await?;
        let mood_json: Vec<Value> = mood_tags.iter().map(|m| json!(s(&v(m), "code"))).collect();

        let quotes = sel(st, "daily_quotes", &[("select", "msg_key"), ("order", "sort_order.asc")]).await?;
        let quote_keys: Vec<Value> = quotes.iter().map(|m| json!(s(&v(m), "msg_key"))).collect();

        let prompts = sel(st, "journal_prompts", &[("select", "msg_key"), ("order", "sort_order.asc")]).await?;
        let prompt_keys: Vec<Value> = prompts.iter().map(|m| json!(s(&v(m), "msg_key"))).collect();

        Ok::<Value, DomainError>(json!({
            "plans": plans,
            "sessions": sessions,
            "mentors": mentors,
            "psychologists": psy_json,
            "media": media.iter().map(|m| media_view(m)).collect::<Vec<_>>(),
            "tdb": tdb.iter().map(|m| media_view(m)).collect::<Vec<_>>(),
            "quizzes": quizzes_json,
            "moodTags": mood_json,
            "quoteKeys": quote_keys,
            "promptKeys": prompt_keys,
        }))
    };
    match build.await {
        Ok(out) => {
            st.ttl_put("content:meditation", out.clone());
            Some(out)
        }
        Err(e) => {
            eprintln!("[content:meditation] {e}");
            None
        }
    }
}

/* ── GET /api/content/library ─────────────────────────────────────────── */

pub async fn library_catalog(st: &St) -> Option<Value> {
    if !st.cfg.db_ready() {
        return None;
    }
    if let Some(hit) = st.ttl_get("content:library") {
        return Some(hit);
    }
    let build = async {
        let (collections, books, places, _schedule) = world_rows(st, "library").await?;

        let book_rows = sel(st, "library_books", &[("select", "slug,author,pages,minutes,blurb_key")]).await?;
        let mut book_details = Map::new();
        for b in &book_rows {
            let slug = s(&v(b), "slug");
            book_details.insert(
                slug.clone(),
                json!({
                    "id": slug,
                    "author": s(&v(b), "author"),
                    "pages": v(b).get("pages").cloned().unwrap_or(Value::Null),
                    "minutes": v(b).get("minutes").cloned().unwrap_or(Value::Null),
                    "blurbKey": s(&v(b), "blurb_key"),
                }),
            );
        }

        let place_rows = sel(st, "world_places", &[("select", "id,slug"), ("world_id", "eq.library")]).await?;
        let mut slug_by_place_id = std::collections::HashMap::new();
        for p in &place_rows {
            if let Some(id) = i64_opt(&v(p), "id") {
                slug_by_place_id.insert(id, s(&v(p), "slug"));
            }
        }
        let details = sel(st, "library_place_details", &[("select", "place_id,address,hours,map_query")]).await?;
        let mut venue_details = Map::new();
        for d in &details {
            let pid = i64_opt(&v(d), "place_id").unwrap_or(0);
            if let Some(slug) = slug_by_place_id.get(&pid) {
                venue_details.insert(
                    slug.clone(),
                    json!({
                        "id": slug,
                        "address": s(&v(d), "address"),
                        "hours": s(&v(d), "hours"),
                        "mapQuery": s(&v(d), "map_query"),
                    }),
                );
            }
        }

        Ok::<Value, DomainError>(json!({
            "collections": collections,
            "books": books,
            "places": places,
            "bookDetails": book_details,
            "venueDetails": venue_details,
        }))
    };
    match build.await {
        Ok(out) => {
            st.ttl_put("content:library", out.clone());
            Some(out)
        }
        Err(e) => {
            eprintln!("[content:library] {e}");
            None
        }
    }
}

/* ── GET /api/content/subscription ────────────────────────────────────── */

pub async fn subscription_catalog(st: &St) -> Option<Value> {
    if !st.cfg.db_ready() {
        return None;
    }
    if let Some(hit) = st.ttl_get("content:subscription") {
        return Some(hit);
    }
    let build = async {
        let features = sel(st, "subscription_features", &[("select", "*"), ("order", "sort_order.asc")]).await?;
        let tiers = sel(st, "subscription_tiers", &[("select", "*"), ("order", "sort_order.asc")]).await?;
        let tier_feats = sel(st, "subscription_tier_features", &[("select", "tier_code,feature_code,sort_order")]).await?;
        let tf_by = group_str(&tier_feats, "tier_code");

        let features_json: Vec<Value> = features
            .iter()
            .map(|f| {
                json!({
                    "id": s(&v(f), "code"),
                    "nameKey": s(&v(f), "name_key"),
                    "price": v(f).get("price").cloned().unwrap_or(Value::Null),
                })
            })
            .collect();
        let tiers_json: Vec<Value> = tiers
            .iter()
            .map(|t| {
                let code = s(&v(t), "code");
                let fl: Vec<Value> = tf_by
                    .get(&code)
                    .map(|l| sorted_by_order(l, "sort_order").iter().map(|x| json!(s(&v(x), "feature_code"))).collect())
                    .unwrap_or_default();
                json!({
                    "id": code,
                    "nameKey": s(&v(t), "name_key"),
                    "price": v(t).get("price").cloned().unwrap_or(Value::Null),
                    "features": fl,
                })
            })
            .collect();

        Ok::<Value, DomainError>(json!({ "features": features_json, "tiers": tiers_json }))
    };
    match build.await {
        Ok(out) => {
            st.ttl_put("content:subscription", out.clone());
            Some(out)
        }
        Err(e) => {
            eprintln!("[content:subscription] {e}");
            None
        }
    }
}

/* ── GET /api/i18n?locale=… ───────────────────────────────────────────── */

fn set_nested(root: &mut Value, path: &[&str], leaf: &str) {
    if path.is_empty() {
        return;
    }
    if path.len() == 1 {
        if !root.is_object() {
            *root = json!({});
        }
        root.as_object_mut()
            .unwrap()
            .insert(path[0].to_string(), json!(leaf));
        return;
    }
    if !root.is_object() {
        *root = json!({});
    }
    let obj = root.as_object_mut().unwrap();
    let entry = obj
        .entry(path[0].to_string())
        .or_insert_with(|| json!({}));
    if !entry.is_object() {
        *entry = json!({});
    }
    set_nested(entry, &path[1..], leaf);
}

pub async fn i18n_catalog(st: &St, locale: &str) -> Result<Value, DomainError> {
    if !st.cfg.db_ready() {
        return Ok(Value::Null);
    }
    let loc = match locale {
        "en" => "en",
        "ru" => "ru",
        _ => "az",
    };
    let cache_key = format!("i18n:{loc}");
    if let Some(hit) = st.ttl_get(&cache_key) {
        return Ok(hit);
    }

    let value_col = format!("value_{loc}");
    // PostgREST caps at 1000 rows — paginate deterministically.
    let mut rows: Vec<Row> = Vec::new();
    let mut offset = 0i64;
    loop {
        let page = sel(
            st,
            "i18n_messages",
            &[
                ("select", &format!("key,{}", value_col)),
                ("order", "key.asc"),
                ("limit", "1000"),
                ("offset", &offset.to_string()),
            ],
        )
        .await?;
        let page_len = page.len();
        rows.extend(page);
        if page_len < 1000 {
            break;
        }
        offset += 1000;
    }

    let mut root = json!({});
    for r in rows {
        let key = s(&v(&r), "key");
        let value = s(&v(&r), &value_col);
        if key.is_empty() || value.is_empty() {
            continue;
        }
        let path: Vec<&str> = key.split('.').collect();
        set_nested(&mut root, &path, &value);
    }

    st.ttl_put(&cache_key, root.clone());
    Ok(root)
}
