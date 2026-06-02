-- Nearby new-question push notifications
-- ---------------------------------------
-- Yeni bir soru olusunca, sorunun konumuna yakin (varsayilan 2 km) ve son
-- konumu taze olan kullanicilara aninda push gonderir. Sunucu tarafi:
--   questions INSERT  -> Database Webhook -> send-push Edge Function
--     -> users_near_question(q_id, radius_m) ile yakin token'lari bul -> Expo Push
--
-- Throttle: ayni kullaniciya saatte en fazla 1 "yakin soru" bildirimi.
-- Supabase SQL Editor'da calistir.

-- 1) Kullanicinin son bilinen konumu + throttle damgasi
alter table profiles add column if not exists last_geom geography(point);
alter table profiles add column if not exists last_location_at timestamptz;
alter table profiles add column if not exists last_notified_nearby_at timestamptz;

create index if not exists profiles_last_geom_idx on profiles using gist (last_geom);

-- 2) Istemci konumunu yazar (RLS update policy "update profiles" using(true) gerekli)
create or replace function update_user_location(p_id uuid, p_lat float, p_lng float)
returns void as $$
  update profiles
     set last_geom         = st_makepoint(p_lng, p_lat)::geography,
         last_location_at  = now()
   where id = p_id;
$$ language sql;

-- 3) Sorunun yakinindaki uygun kullanicilari dondur + throttle damgasini at.
--    Tek cagrida hem eligible kullanicilari secer hem last_notified_nearby_at'i
--    gunceller (yaris kosulu / cifte bildirim olmasin diye atomik).
create or replace function users_near_question(q_id uuid, radius_m float default 2000)
returns table (user_id uuid, push_token text) as $$
declare
  q_geom   geography;
  q_author uuid;
begin
  select geom, author_id into q_geom, q_author from questions where id = q_id;
  if q_geom is null then
    return;
  end if;

  return query
  with eligible as (
    select p.id, p.push_token
    from profiles p
    where p.id <> q_author
      and p.push_token is not null
      and p.push_token like 'ExponentPushToken%'
      and p.last_geom is not null
      and p.last_location_at > now() - interval '7 days'
      and st_dwithin(p.last_geom, q_geom, radius_m)
      and (p.last_notified_nearby_at is null
           or p.last_notified_nearby_at < now() - interval '1 hour')
  ),
  stamped as (
    update profiles p
       set last_notified_nearby_at = now()
      from eligible e
     where p.id = e.id
    returning p.id as uid, e.push_token as tok
  )
  select s.uid, s.tok from stamped s;
end;
$$ language plpgsql;

-- 4) Tek soruyu lat/lng acilmis halde dondur (bildirim deep-link'i icin).
--    questions_nearby ile ayni sutun semasi.
create or replace function question_by_id(q_id uuid)
returns table (
  id uuid,
  author_id uuid,
  body text,
  type text,
  options jsonb,
  geom geography,
  answer_count int,
  created_at timestamptz,
  lat float,
  lng float
) as $$
  select
    q.id, q.author_id, q.body, q.type, q.options, q.geom,
    q.answer_count, q.created_at,
    ST_Y(q.geom::geometry) as lat,
    ST_X(q.geom::geometry) as lng
  from questions q
  where q.id = q_id;
$$ language sql stable;

-- 5) Push token tekilligi: bir token'i sahibine ata, diger profillerden temizle.
--    Ayni cihazda yeni anonim profil acilinca eski profil ayni token'i tutmasin
--    (yoksa bildirim yanlis profile gidiyormus gibi gorunur).
create or replace function claim_push_token(p_id uuid, p_token text)
returns void as $$
  update profiles set push_token = null where push_token = p_token and id <> p_id;
  update profiles set push_token = p_token where id = p_id;
$$ language sql;
