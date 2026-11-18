use crate::auth::{err, generic, App, ApiError};
use crate::baku::num;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::{json, Map, Value};
use std::collections::HashMap;

/* ── Row-grouping helpers ────────────────────────────────────────────────── */

fn group<'a>(rows: &'a [Value], key: &str) -> HashMap<String, Vec<&'a Value>> {
    let mut map: HashMap<String, Vec<&Value>> = HashMap::new();
    for r in rows {
        if let Some(k) = r.get(key).and_then(|v| v.as_str()) {
            map.entry(k.to_string()).or_default().push(r);
        }
    }
    map
}

fn group_i64<'a>(rows: &'a [Value], key: &str) -> HashMap<i64, Vec<&'a Value>> {
    let mut map: HashMap<i64, Vec<&Value>> = HashMap::new();
    for r in rows {
        if let Some(k) = r.get(key).and_then(|v| v.as_i64()) {
            map.entry(k).or_default().push(r);
        }
    }
    map
}

fn s(row: &Value, key: &str) -> String {
    row.get(key).and_then(|v| v.as_str()).unwrap_or_default().to_string()
}

fn opt_s(row: &Value, key: &str) -> Value {
    match row.get(key).and_then(|v| v.as_str()) {
        Some(x) => Value::from(x),
        None => Value::Null,
    }
}

/* ── Shared world assembly ───────────────────────────────────────────────── */

struct WorldData {
    plans: Vec<Value>,
    items: Vec<Value>,
    places: Vec<Value>,
    schedule: Value,
}

async fn world_rows(app: &App, world_id: &str) -> Result<WorldData, ApiError> {
    let supa = &app.supa;
    let wf = format!("eq.{world_id}");

    let plans = supa.select("world_plans", &[("select", "*"), ("world_id", wf.as_str()), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let metas = supa.select("world_plan_meta", &[("select", "plan_id,meta_key,value")])
        .await.map_err(|_| generic())?;
    // plan meta rows reference world_plans.id; filter by plan ids of this world.
    let plan_ids: std::collections::HashSet<i64> = plans.iter()
        .filter_map(|p| p.get("id").and_then(|v| v.as_i64())).collect();
    let metas: Vec<Value> = metas.into_iter()
        .filter(|m| m.get("plan_id").and_then(|v| v.as_i64()).map(|id| plan_ids.contains(&id)).unwrap_or(false))
        .collect();

    let items = supa.select("world_items", &[("select", "*"), ("world_id", wf.as_str()), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let places = supa.select("world_places", &[("select", "*"), ("world_id", wf.as_str()), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let place_feats = supa.select("world_place_features", &[("select", "place_id,feature_key,sort_order")])
        .await.map_err(|_| generic())?;

    let slots = supa.select("world_schedule_slots", &[("select", "*"), ("world_id", wf.as_str()), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let kinds = supa.select("world_schedule_kinds", &[("select", "code,label_key,sort_order"), ("world_id", wf.as_str()), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let cells = supa.select("world_schedule_cells", &[("select", "slot_id,day_index,cell_code", )])
        .await.map_err(|_| generic())?;
    // cells carry no world column — filter by this world's slot ids.
    let slot_ids: std::collections::HashSet<i64> = slots.iter()
        .filter_map(|x| x.get("id").and_then(|v| v.as_i64())).collect();
    let cells: Vec<Value> = cells.into_iter()
        .filter(|c| c.get("slot_id").and_then(|v| v.as_i64()).map(|id| slot_ids.contains(&id)).unwrap_or(false))
        .collect();

    let meta_by_plan = group_i64(&metas, "plan_id");
    let feat_by_place = group_i64(&place_feats, "place_id");
    let cells_by_slot = group_i64(&cells, "slot_id");

    let plans_json: Vec<Value> = plans.iter().map(|p| {
        let id = p.get("id").and_then(|v| v.as_i64()).unwrap_or_default();
        let meta = meta_by_plan.get(&id).map(|list| {
            let mut v: Vec<Value> = list.iter().map(|m| json!([s(m, "meta_key"), m.get("value")])).collect();
            v.sort_by_key(|x| 0); // already in insertion order
            Value::from(v)
        }).unwrap_or(json!([]));
        json!({
            "id": s(p, "slug"),
            "nameKey": s(p, "name_key"),
            "descKey": s(p, "desc_key"),
            "image": s(p, "image_url"),
            "level": s(p, "level"),
            "featured": p.get("featured").and_then(|v| v.as_bool()).unwrap_or(false),
            "meta": meta,
        })
    }).collect();

    let items_json: Vec<Value> = items.iter().map(|it| json!({
        "id": s(it, "slug"),
        "nameKey": s(it, "name_key"),
        "targetKey": s(it, "target_key"),
        "icon": s(it, "icon"),
        "level": s(it, "level"),
    })).collect();

    let places_json: Vec<Value> = places.iter().map(|p| {
        let id = p.get("id").and_then(|v| v.as_i64()).unwrap_or_default();
        let feats = feat_by_place.get(&id).map(|list| {
            let v: Vec<Value> = list.iter().map(|f| Value::from(s(f, "feature_key"))).collect();
            Value::from(v)
        }).unwrap_or(json!([]));
        json!({
            "id": s(p, "slug"),
            "nameKey": s(p, "name_key"),
            "descKey": s(p, "desc_key"),
            "image": s(p, "image_url"),
            "rating": num(p.get("rating").unwrap_or(&Value::Null)),
            "featureKeys": feats,
        })
    }).collect();

    let mut cell_keys = Map::new();
    for k in &kinds {
        cell_keys.insert(s(k, "code"), Value::from(s(k, "label_key")));
    }
    let slots_json: Vec<Value> = slots.iter().map(|slot| {
        let id = slot.get("id").and_then(|v| v.as_i64()).unwrap_or_default();
        let mut day_cells: Vec<(i64, String)> = cells_by_slot.get(&id)
            .map(|list| list.iter().filter_map(|c| {
                let d = c.get("day_index").and_then(|v| v.as_i64())?;
                Some((d, s(c, "cell_code")))
            }).collect())
            .unwrap_or_default();
        day_cells.sort_by_key(|(d, _)| *d);
        let cells_v: Vec<Value> = day_cells.into_iter().map(|(_, code)| Value::from(code)).collect();
        json!({
            "time": s(slot, "time"),
            "labelKey": s(slot, "label_key"),
            "cells": cells_v,
        })
    }).collect();

    Ok(WorldData {
        plans: plans_json,
        items: items_json,
        places: places_json,
        schedule: json!({ "slots": slots_json, "cellKeys": Value::Object(cell_keys) }),
    })
}

/* ── GET /api/content/worlds ─────────────────────────────────────────────── */

pub async fn worlds(State(app): State<App>) -> Result<Response, ApiError> {
    if let Some(v) = app.cache.get("content:worlds").await {
        return ok_json((*v).clone());
    }

    let supa = &app.supa;
    let world_list = supa.select("worlds", &[("select", "*"), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let cando = supa.select("world_cando", &[("select", "world_id,icon,title_key,desc_key,sort_order")])
        .await.map_err(|_| generic())?;
    let cando_by_world = group(&cando, "world_id");

    let mut worlds_map = Map::new();
    for w in &world_list {
        let id = s(w, "id");
        let data = world_rows(&app, &id).await?;
        let canDo: Vec<Value> = cando_by_world.get(&id).map(|list| {
            list.iter().map(|c| json!({
                "icon": s(c, "icon"),
                "titleKey": s(c, "title_key"),
                "descKey": s(c, "desc_key"),
            })).collect()
        }).unwrap_or_default();

        worlds_map.insert(id.clone(), json!({
            "slug": id,
            "ns": s(w, "ns"),
            "ids": { "plans": s(w, "anchor_plans"), "items": s(w, "anchor_items"), "places": s(w, "anchor_places") },
            "prefix": { "items": s(w, "prefix_items"), "places": s(w, "prefix_places") },
            "hero": {
                "images": w.get("hero_images").cloned().unwrap_or(json!([])),
                "positions": w.get("hero_positions").cloned().unwrap_or(json!([])),
                "stats": w.get("hero_stats").cloned().unwrap_or(json!([])),
            },
            "plans": data.plans,
            "items": data.items,
            "canDo": canDo,
            "schedule": data.schedule,
            "initials": w.get("initials").cloned().unwrap_or(json!([])),
            "places": data.places,
        }));
    }

    // Landing frames: the banner still-life + each world's lead photo.
    let mut frames = vec![json!({ "src": "/img/banner.png", "pos": "center" })];
    for w in &world_list {
        let images = w.get("hero_images").and_then(|v| v.as_array());
        let positions = w.get("hero_positions").and_then(|v| v.as_array());
        if let (Some(images), Some(positions)) = (images, positions) {
            if let (Some(img), Some(pos)) = (images.first(), positions.first()) {
                frames.push(json!({ "src": img, "pos": pos }));
            }
        }
    }

    let out = json!({ "worlds": Value::Object(worlds_map), "landingFrames": frames });
    app.cache.put("content:worlds", out.clone()).await;
    ok_json(out)
}

fn ok_json(v: Value) -> Result<Response, ApiError> {
    Ok((StatusCode::OK, Json(v)).into_response())
}

/* ── GET /api/content/gym ────────────────────────────────────────────────── */

pub async fn gym(State(app): State<App>) -> Result<Response, ApiError> {
    if let Some(v) = app.cache.get("content:gym").await {
        return ok_json((*v).clone());
    }
    let supa = &app.supa;

    let world = world_rows(&app, "gym").await?;

    let places = supa.select("gym_places", &[("select", "*"), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let feats = supa.select("gym_place_features", &[("select", "gym_place_id,feature_key,sort_order")])
        .await.map_err(|_| generic())?;
    let equipment = supa.select("gym_place_equipment", &[("select", "gym_place_id,equipment_code,sort_order")])
        .await.map_err(|_| generic())?;
    let trainers = supa.select("gym_trainers", &[("select", "gym_place_id,name,spec_code,years,sort_order")])
        .await.map_err(|_| generic())?;

    let feat_by = group_i64(&feats, "gym_place_id");
    let eq_by = group_i64(&equipment, "gym_place_id");
    let tr_by = group_i64(&trainers, "gym_place_id");

    let places_json: Vec<Value> = places.iter().map(|p| {
        let id = p.get("id").and_then(|v| v.as_i64()).unwrap_or_default();
        let feats_v: Vec<Value> = feat_by.get(&id).map(|l| l.iter().map(|f| Value::from(s(f, "feature_key"))).collect()).unwrap_or_default();
        let mut eq: Vec<(i64, String)> = eq_by.get(&id).map(|l| l.iter().filter_map(|e| {
            Some((e.get("sort_order").and_then(|v| v.as_i64())?, s(e, "equipment_code")))
        }).collect()).unwrap_or_default();
        eq.sort_by_key(|(o, _)| *o);
        let mut tr: Vec<(i64, Value)> = tr_by.get(&id).map(|l| l.iter().filter_map(|t| {
            Some((t.get("sort_order").and_then(|v| v.as_i64())?, json!({
                "name": s(t, "name"), "spec": s(t, "spec_code"),
                "years": t.get("years").and_then(|v| v.as_i64()).unwrap_or(0),
            })))
        }).collect()).unwrap_or_default();
        tr.sort_by_key(|(o, _)| *o);
        json!({
            "id": s(p, "slug"),
            "ns": s(p, "ns"),
            "nameKey": s(p, "name_key"),
            "descKey": s(p, "desc_key"),
            "image": s(p, "image_url"),
            "rating": num(p.get("rating").unwrap_or(&Value::Null)),
            "featureKeys": feats_v,
            "address": s(p, "address"),
            "hours": s(p, "hours"),
            "dayPrice": num(p.get("day_price").unwrap_or(&Value::Null)),
            "equipment": eq.into_iter().map(|(_, code)| Value::from(code)).collect::<Vec<_>>(),
            "trainers": tr.into_iter().map(|(_, v)| v).collect::<Vec<_>>(),
        })
    }).collect();

    let stores = supa.select("gym_stores", &[("select", "*"), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let mut stores_map = Map::new();
    for st in &stores {
        stores_map.insert(s(st, "slug"), json!({
            "slug": s(st, "slug"), "name": s(st, "name"), "kind": s(st, "kind"), "url": s(st, "url"),
        }));
    }

    let products = supa.select("gym_products", &[("select", "*"), ("order", "category.asc,sort_order.asc")])
        .await.map_err(|_| generic())?;
    let offers = supa.select("gym_product_offers", &[("select", "product_id,store_slug,price,sort_order")])
        .await.map_err(|_| generic())?;
    let offers_by = group_i64(&offers, "product_id");
    let mut catalog = Map::new();
    for cat in ["equipment", "supplements", "accessories", "clothing"] {
        let items: Vec<Value> = products.iter().filter(|p| s(p, "category") == cat).map(|p| {
            let id = p.get("id").and_then(|v| v.as_i64()).unwrap_or_default();
            let mut at: Vec<(i64, Value)> = offers_by.get(&id).map(|l| l.iter().filter_map(|o| {
                Some((o.get("sort_order").and_then(|v| v.as_i64())?, json!({
                    "store": s(o, "store_slug"),
                    "price": num(o.get("price").unwrap_or(&Value::Null)),
                })))
            }).collect()).unwrap_or_default();
            at.sort_by_key(|(o, _)| *o);
            json!({
                "id": s(p, "slug"),
                "nameKey": s(p, "name_key"),
                "brand": s(p, "brand"),
                "icon": s(p, "icon"),
                "price": [num(p.get("price_min").unwrap_or(&Value::Null)), num(p.get("price_max").unwrap_or(&Value::Null))],
                "image": opt_s(p, "image_url"),
                "at": at.into_iter().map(|(_, v)| v).collect::<Vec<_>>(),
            })
        }).collect();
        catalog.insert(cat.to_string(), Value::from(items));
    }

    let exercises = supa.select("gym_exercises", &[("select", "code,name_key,target_key,guide_key,sort_order"), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let mut ex_map = Map::new();
    for ex in &exercises {
        ex_map.insert(s(ex, "code"), json!({
            "nameKey": s(ex, "name_key"), "targetKey": s(ex, "target_key"), "guideKey": s(ex, "guide_key"),
        }));
    }

    // Workouts: days joined to their gym plan slug.
    let gym_plans = supa.select("world_plans", &[("select", "id,slug", ), ("world_id", "eq.gym"), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let plan_slug_by_id: HashMap<i64, String> = gym_plans.iter()
        .filter_map(|p| Some((p.get("id")?.as_i64()?, s(p, "slug")))).collect();
    let days = supa.select("gym_workout_days", &[("select", "id,plan_id,day,sort_order")])
        .await.map_err(|_| generic())?;
    let wex = supa.select("gym_workout_exercises", &[("select", "day_id,exercise_code,sets,reps_type,reps_a,reps_b,rest_seconds,sort_order")])
        .await.map_err(|_| generic())?;
    let wex_by_day = group_i64(&wex, "day_id");

    let mut workouts = Map::new();
    for d in &days {
        let plan_id = d.get("plan_id").and_then(|v| v.as_i64()).unwrap_or_default();
        let Some(plan_slug) = plan_slug_by_id.get(&plan_id) else { continue };
        let day_id = d.get("id").and_then(|v| v.as_i64()).unwrap_or_default();
        let mut list: Vec<(i64, Value)> = wex_by_day.get(&day_id).map(|l| l.iter().filter_map(|e| {
            let reps = match e.get("reps_b").and_then(|v| v.as_i64()) {
                Some(b) => json!({ "t": s(e, "reps_type"), "a": e.get("reps_a"), "b": b }),
                None => json!({ "t": s(e, "reps_type"), "a": e.get("reps_a") }),
            };
            Some((e.get("sort_order").and_then(|v| v.as_i64())?, json!({
                "ex": s(e, "exercise_code"),
                "sets": e.get("sets"),
                "reps": reps,
                "rest": e.get("rest_seconds").and_then(|v| v.as_i64()).unwrap_or(0),
            })))
        }).collect()).unwrap_or_default();
        list.sort_by_key(|(o, _)| *o);
        let entry = json!({
            "day": d.get("day").and_then(|v| v.as_i64()).unwrap_or(1),
            "exercises": list.into_iter().map(|(_, v)| v).collect::<Vec<_>>(),
        });
        match workouts.get_mut(plan_slug) {
            Some(Value::Array(arr)) => arr.push(entry),
            _ => { workouts.insert(plan_slug.clone(), Value::Array(vec![entry])); }
        }
    }

    let progress = supa.select("gym_plan_progress", &[("select", "plan_id,week,total")])
        .await.map_err(|_| generic())?;
    let mut plan_weeks = Map::new();
    for p in &progress {
        let plan_id = p.get("plan_id").and_then(|v| v.as_i64()).unwrap_or_default();
        if let Some(slug) = plan_slug_by_id.get(&plan_id) {
            plan_weeks.insert(slug.clone(), json!({
                "week": p.get("week").and_then(|v| v.as_i64()).unwrap_or(1),
                "total": p.get("total").and_then(|v| v.as_i64()).unwrap_or(1),
            }));
        }
    }

    let out = json!({
        "plans": world.plans,
        "schedule": world.schedule,
        "places": places_json,
        "stores": Value::Object(stores_map),
        "catalog": Value::Object(catalog),
        "exercises": Value::Object(ex_map),
        "workouts": Value::Object(workouts),
        "planWeeks": Value::Object(plan_weeks),
    });
    app.cache.put("content:gym", out.clone()).await;
    ok_json(out)
}

/* ── GET /api/content/diet ───────────────────────────────────────────────── */

pub async fn diet(State(app): State<App>) -> Result<Response, ApiError> {
    if let Some(v) = app.cache.get("content:diet").await {
        return ok_json((*v).clone());
    }
    let supa = &app.supa;
    let world = world_rows(&app, "diet").await?;

    let recipes = supa.select("diet_recipes", &[("select", "slug,minutes,kcal")])
        .await.map_err(|_| generic())?;
    let ingredients = supa.select("diet_recipe_ingredients", &[("select", "recipe_slug,ingredient_key,sort_order")])
        .await.map_err(|_| generic())?;
    let ing_by = group(&ingredients, "recipe_slug");
    let mut recipe_details = Map::new();
    for r in &recipes {
        let slug = s(r, "slug");
        let mut ing: Vec<(i64, String)> = ing_by.get(&slug).map(|l| l.iter().filter_map(|i| {
            Some((i.get("sort_order").and_then(|v| v.as_i64())?, s(i, "ingredient_key")))
        }).collect()).unwrap_or_default();
        ing.sort_by_key(|(o, _)| *o);
        recipe_details.insert(slug.clone(), json!({
            "id": slug,
            "minutes": r.get("minutes"), "kcal": r.get("kcal"),
            "ingredients": ing.into_iter().map(|(_, k)| Value::from(k)).collect::<Vec<_>>(),
        }));
    }

    let place_rows = supa.select("world_places", &[("select", "id,slug", ), ("world_id", "eq.diet")])
        .await.map_err(|_| generic())?;
    let slug_by_place_id: HashMap<i64, String> = place_rows.iter()
        .filter_map(|p| Some((p.get("id")?.as_i64()?, s(p, "slug")))).collect();
    let details = supa.select("diet_place_details", &[("select", "place_id,address,hours,map_query")])
        .await.map_err(|_| generic())?;
    let mut venue_details = Map::new();
    for d in &details {
        let pid = d.get("place_id").and_then(|v| v.as_i64()).unwrap_or_default();
        if let Some(slug) = slug_by_place_id.get(&pid) {
            venue_details.insert(slug.clone(), json!({
                "id": slug,
                "address": s(d, "address"), "hours": s(d, "hours"), "mapQuery": s(d, "map_query"),
            }));
        }
    }

    let out = json!({
        "plans": world.plans,
        "recipes": world.items,
        "places": world.places,
        "recipeDetails": Value::Object(recipe_details),
        "venueDetails": Value::Object(venue_details),
    });
    app.cache.put("content:diet", out.clone()).await;
    ok_json(out)
}

/* ── GET /api/content/meditation ─────────────────────────────────────────── */

pub async fn meditation(State(app): State<App>) -> Result<Response, ApiError> {
    if let Some(v) = app.cache.get("content:meditation").await {
        return ok_json((*v).clone());
    }
    let supa = &app.supa;
    let world = world_rows(&app, "meditation").await?;

    let psy = supa.select("psychologists_v2", &[("select", "*"), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let psy_specs = supa.select("psychologist_specialties", &[("select", "psychologist_slug,specialty_code,sort_order")])
        .await.map_err(|_| generic())?;
    let psy_formats = supa.select("psychologist_formats", &[("select", "psychologist_slug,format,sort_order")])
        .await.map_err(|_| generic())?;
    let psy_langs = supa.select("psychologist_languages", &[("select", "psychologist_slug,lang,sort_order")])
        .await.map_err(|_| generic())?;
    let psy_avail = supa.select("psychologist_availability", &[("select", "psychologist_slug,day,from_hour,to_hour,sort_order")])
        .await.map_err(|_| generic())?;
    let psy_certs = supa.select("psychologist_certificates", &[("select", "psychologist_slug,cert_key,sort_order")])
        .await.map_err(|_| generic())?;

    let specs_by = group(&psy_specs, "psychologist_slug");
    let formats_by = group(&psy_formats, "psychologist_slug");
    let langs_by = group(&psy_langs, "psychologist_slug");
    let avail_by = group(&psy_avail, "psychologist_slug");
    let certs_by = group(&psy_certs, "psychologist_slug");

    fn sorted_codes<'a>(list: Option<&Vec<&'a Value>>, key: &str) -> Vec<Value> {
        let mut v: Vec<(i64, Value)> = list.map(|l| l.iter().filter_map(|r| {
            Some((r.get("sort_order").and_then(|x| x.as_i64()).unwrap_or(0), Value::from(s(r, key))))
        }).collect()).unwrap_or_default();
        v.sort_by_key(|(o, _)| *o);
        v.into_iter().map(|(_, x)| x).collect()
    }

    let psy_json: Vec<Value> = psy.iter().map(|p| {
        let slug = s(p, "slug");
        let mut avail: Vec<(i64, Value)> = avail_by.get(&slug).map(|l| l.iter().filter_map(|a| {
            Some((a.get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0), json!({
                "day": a.get("day"), "from": a.get("from_hour"), "to": a.get("to_hour"),
            })))
        }).collect()).unwrap_or_default();
        avail.sort_by_key(|(o, _)| *o);
        json!({
            "slug": slug,
            "nameKey": s(p, "name_key"),
            "titleKey": s(p, "title_key"),
            "bioKey": s(p, "bio_key"),
            "image": s(p, "image_url"),
            "rating": num(p.get("rating").unwrap_or(&Value::Null)),
            "price": num(p.get("price").unwrap_or(&Value::Null)),
            "specialties": sorted_codes(specs_by.get(&slug), "specialty_code"),
            "formats": sorted_codes(formats_by.get(&slug), "format"),
            "languages": sorted_codes(langs_by.get(&slug), "lang"),
            "availability": avail.into_iter().map(|(_, v)| v).collect::<Vec<_>>(),
            "initials": s(p, "initials"),
            "since": p.get("since_year").and_then(|v| v.as_i64()).unwrap_or(2000),
            "eduKey": s(p, "edu_key"),
            "certKeys": sorted_codes(certs_by.get(&slug), "cert_key"),
            "rulesKey": s(p, "rules_key"),
        })
    }).collect();

    let media = supa.select("media_resources", &[
        ("select", "*"),
        ("collection", "eq.practice"),
        ("order", "sort_order.asc"),
    ]).await.map_err(|_| generic())?;
    let tdb = supa.select("media_resources", &[
        ("select", "*"),
        ("collection", "eq.tdb"),
        ("order", "sort_order.asc"),
    ]).await.map_err(|_| generic())?;

    let media_json: Vec<Value> = media.iter().map(|m| json!({
        "id": s(m, "id"), "kind": s(m, "kind"),
        "titleKey": s(m, "title_key"), "descKey": s(m, "desc_key"),
        "minutes": m.get("minutes"), "src": s(m, "src"), "poster": s(m, "poster"),
    })).collect();
    let tdb_json: Vec<Value> = tdb.iter().map(|m| json!({
        "id": s(m, "id"), "kind": s(m, "kind"),
        "titleKey": s(m, "title_key"), "descKey": s(m, "desc_key"),
        "minutes": m.get("minutes"), "src": s(m, "src"), "poster": s(m, "poster"),
    })).collect();

    let quizzes = supa.select("quizzes", &[("select", "code,question_count", ), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let quizzes_json: Vec<Value> = quizzes.iter().map(|q| json!({
        "id": s(q, "code"), "questions": q.get("question_count"),
    })).collect();

    let mood_tags = supa.select("mood_tags", &[("select", "code", ), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let mood_json: Vec<Value> = mood_tags.iter().map(|m| Value::from(s(m, "code"))).collect();

    let quotes = supa.select("daily_quotes", &[("select", "msg_key", ), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let quotes_json: Vec<Value> = quotes.iter().map(|m| Value::from(s(m, "msg_key"))).collect();

    let prompts = supa.select("journal_prompts", &[("select", "msg_key", ), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let prompts_json: Vec<Value> = prompts.iter().map(|m| Value::from(s(m, "msg_key"))).collect();

    let out = json!({
        "plans": world.plans,
        "sessions": world.items,
        "mentors": world.places,
        "psychologists": psy_json,
        "media": media_json,
        "tdb": tdb_json,
        "quizzes": quizzes_json,
        "moodTags": mood_json,
        "quoteKeys": quotes_json,
        "promptKeys": prompts_json,
    });
    app.cache.put("content:meditation", out.clone()).await;
    ok_json(out)
}

/* ── GET /api/content/library ────────────────────────────────────────────── */

pub async fn library(State(app): State<App>) -> Result<Response, ApiError> {
    if let Some(v) = app.cache.get("content:library").await {
        return ok_json((*v).clone());
    }
    let supa = &app.supa;
    let world = world_rows(&app, "library").await?;

    let books = supa.select("library_books", &[("select", "slug,author,pages,minutes,blurb_key")])
        .await.map_err(|_| generic())?;
    let mut book_details = Map::new();
    for b in &books {
        let slug = s(b, "slug");
        book_details.insert(slug.clone(), json!({
            "id": slug, "author": s(b, "author"),
            "pages": b.get("pages"), "minutes": b.get("minutes"), "blurbKey": s(b, "blurb_key"),
        }));
    }

    let place_rows = supa.select("world_places", &[("select", "id,slug", ), ("world_id", "eq.library")])
        .await.map_err(|_| generic())?;
    let slug_by_place_id: HashMap<i64, String> = place_rows.iter()
        .filter_map(|p| Some((p.get("id")?.as_i64()?, s(p, "slug")))).collect();
    let details = supa.select("library_place_details", &[("select", "place_id,address,hours,map_query")])
        .await.map_err(|_| generic())?;
    let mut venue_details = Map::new();
    for d in &details {
        let pid = d.get("place_id").and_then(|v| v.as_i64()).unwrap_or_default();
        if let Some(slug) = slug_by_place_id.get(&pid) {
            venue_details.insert(slug.clone(), json!({
                "id": slug,
                "address": s(d, "address"), "hours": s(d, "hours"), "mapQuery": s(d, "map_query"),
            }));
        }
    }

    let out = json!({
        "collections": world.plans,
        "books": world.items,
        "places": world.places,
        "bookDetails": Value::Object(book_details),
        "venueDetails": Value::Object(venue_details),
    });
    app.cache.put("content:library", out.clone()).await;
    ok_json(out)
}

/* ── GET /api/content/subscription ───────────────────────────────────────── */

pub async fn subscription(State(app): State<App>) -> Result<Response, ApiError> {
    if let Some(v) = app.cache.get("content:subscription").await {
        return ok_json((*v).clone());
    }
    let supa = &app.supa;

    let features = supa.select("subscription_features", &[("select", "*"), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let tiers = supa.select("subscription_tiers", &[("select", "*"), ("order", "sort_order.asc")])
        .await.map_err(|_| generic())?;
    let tier_feats = supa.select("subscription_tier_features", &[("select", "tier_code,feature_code,sort_order")])
        .await.map_err(|_| generic())?;
    let tf_by = group(&tier_feats, "tier_code");

    let features_json: Vec<Value> = features.iter().map(|f| json!({
        "id": s(f, "code"), "nameKey": s(f, "name_key"), "price": num(f.get("price").unwrap_or(&Value::Null)),
    })).collect();
    let tiers_json: Vec<Value> = tiers.iter().map(|t| {
        let code = s(t, "code");
        let mut fl: Vec<(i64, Value)> = tf_by.get(&code).map(|l| l.iter().filter_map(|x| {
            Some((x.get("sort_order").and_then(|v| v.as_i64()).unwrap_or(0), Value::from(s(x, "feature_code"))))
        }).collect()).unwrap_or_default();
        fl.sort_by_key(|(o, _)| *o);
        json!({
            "id": code, "nameKey": s(t, "name_key"), "price": num(t.get("price").unwrap_or(&Value::Null)),
            "features": fl.into_iter().map(|(_, v)| v).collect::<Vec<_>>(),
        })
    }).collect();

    let out = json!({ "features": features_json, "tiers": tiers_json });
    app.cache.put("content:subscription", out.clone()).await;
    ok_json(out)
}

/* ── GET /api/i18n?locale=az|en|ru ───────────────────────────────────────── */

#[derive(serde::Deserialize)]
pub struct LocaleQuery {
    locale: Option<String>,
}

fn set_nested(root: &mut Map<String, Value>, path: &[&str], leaf: Value) {
    if path.is_empty() {
        return;
    }
    if path.len() == 1 {
        root.insert(path[0].to_string(), leaf);
        return;
    }
    let entry = root.entry(path[0].to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !entry.is_object() {
        *entry = Value::Object(Map::new());
    }
    if let Value::Object(m) = entry {
        set_nested(m, &path[1..], leaf);
    }
}

pub async fn i18n(State(app): State<App>, Query(q): Query<LocaleQuery>) -> Result<Response, ApiError> {
    let locale = match q.locale.as_deref() {
        Some("en") => "en",
        Some("ru") => "ru",
        _ => "az",
    };
    let cache_key = format!("i18n:{locale}");
    if let Some(v) = app.cache.get(&cache_key).await {
        return ok_json((*v).clone());
    }

    let select = format!("key,value_{locale}");
    // PostgREST caps responses at 1000 rows by default — paginate with a
    // deterministic key order until every i18n_messages row is fetched.
    let mut rows: Vec<Value> = Vec::new();
    let mut offset: i64 = 0;
    loop {
        let page = app.supa.select("i18n_messages", &[
            ("select", &select),
            ("order", "key.asc"),
            ("limit", "1000"),
            ("offset", &offset.to_string()),
        ]).await.map_err(|_| generic())?;
        let n = page.len();
        rows.extend(page);
        if n < 1000 { break; }
        offset += 1000;
    }

    let mut root = Map::new();
    for r in &rows {
        let Some(key) = r.get("key").and_then(|v| v.as_str()) else { continue };
        let Some(value) = r.get(&format!("value_{locale}")).and_then(|v| v.as_str()) else { continue };
        let parts: Vec<&str> = key.split('.').collect();
        set_nested(&mut root, &parts, Value::from(value));
    }

    let out = Value::Object(root);
    app.cache.put(&cache_key, out.clone()).await;
    ok_json(out)
}

/* ── health ──────────────────────────────────────────────────────────────── */

pub async fn health(State(app): State<App>) -> Result<Response, ApiError> {
    let _ = err; // keep import used when handlers change
    Ok((StatusCode::OK, Json(json!({
        "ok": true,
        "service": "prelife-api",
        "version": env!("CARGO_PKG_VERSION"),
        "uptimeSecs": app.started.elapsed().as_secs(),
    }))).into_response())
}
