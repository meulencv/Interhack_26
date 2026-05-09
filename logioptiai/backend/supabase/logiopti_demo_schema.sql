-- LogiOpti AI demo schema for Supabase
-- Execute this file once in the Supabase SQL editor.
-- Demo mode: RLS is disabled and anon/authenticated roles can read/write.
-- Do not use this security model for production credentials or real customer data.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  role text not null check (role in ('host_controller', 'driver', 'warehouse')),
  display_name text not null,
  demo_pin text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_code text not null unique,
  template text not null check (template in ('van_3', 'truck_6', 'truck_8')),
  license_plate text,
  pallet_capacity numeric(8,3) not null,
  zce_capacity numeric(10,3) not null,
  volume_capacity_m3 numeric(10,3),
  status text not null default 'available' check (status in ('available', 'assigned', 'en_route', 'maintenance')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  driver_code text not null unique,
  full_name text not null,
  phone text,
  default_vehicle_id uuid references public.vehicles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  planning_date date not null,
  objective text not null default 'balanced',
  osrm_mode text not null default 'local-osrm',
  max_active_vehicles integer not null default 16,
  total_routes integer not null default 0,
  total_distance_km numeric(12,3) not null default 0,
  total_duration_minutes numeric(12,2) not null default 0,
  total_zce numeric(14,3) not null default 0,
  original_stop_count integer not null default 0,
  optimized_stop_count integer not null default 0,
  parking_stops_saved integer not null default 0,
  parking_cluster_radius_m integer not null default 50,
  scorecard jsonb not null default '{}'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  planning_run_id uuid not null references public.planning_runs(id) on delete cascade,
  route_code text not null,
  source_route_codes text[] not null default '{}',
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'loading', 'en_route', 'recalculating', 'completed', 'cancelled')),
  truck_type text not null check (truck_type in ('van_3', 'truck_6', 'truck_8')),
  route_label text,
  color text,
  distance_km numeric(12,3) not null default 0,
  duration_minutes numeric(12,2) not null default 0,
  pallet_load numeric(12,4) not null default 0,
  total_zce numeric(14,3) not null default 0,
  return_zce numeric(14,3) not null default 0,
  load_pct integer not null default 0,
  original_stop_count integer not null default 0,
  optimized_stop_count integer not null default 0,
  parking_stops_saved integer not null default 0,
  grouped_stop_count integer not null default 0,
  rationale text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (planning_run_id, route_code)
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  stop_index integer not null,
  stop_code text not null,
  parking_group_id text,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  address text,
  town text,
  zone text,
  client_ids text[] not null default '{}',
  client_names text[] not null default '{}',
  grouped_stop_count integer not null default 1,
  original_stop_ids text[] not null default '{}',
  original_client_count integer not null default 1,
  parking_optimization_reason text,
  arrival_time time,
  departure_time time,
  service_minutes integer not null default 0,
  window_start time,
  window_end time,
  status text not null default 'pending' check (status in ('pending', 'active', 'arrived', 'completed', 'failed', 'skipped')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, stop_index)
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  stop_id uuid not null references public.route_stops(id) on delete cascade,
  external_delivery_id text not null,
  client_id text,
  client_name text not null,
  status text not null default 'pending' check (status in ('pending', 'loaded', 'in_transit', 'delivered', 'partial', 'failed', 'cancelled')),
  total_quantity numeric(14,3) not null default 0,
  total_zce numeric(14,3) not null default 0,
  total_pallet_equivalent numeric(12,4) not null default 0,
  total_weight_kg numeric(12,2) not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, external_delivery_id)
);

create table if not exists public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  material_id text not null,
  material_description text not null,
  quantity numeric(14,3) not null,
  sale_unit text not null,
  statistical_boxes numeric(14,3) not null default 0,
  pallet_equivalent numeric(12,4) not null default 0,
  volume_m3 numeric(12,4) not null default 0,
  weight_kg numeric(12,2) not null default 0,
  stack_class text not null default 'mixed',
  returnable boolean not null default false,
  warehouse_location text,
  status text not null default 'pending' check (status in ('pending', 'loaded', 'delivered', 'returned', 'missing')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cargo_boxes (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  box_code text not null,
  slot_name text not null,
  position_label text not null,
  mode text not null default 'hybrid_reference',
  accessibility_rank integer not null,
  client_names text[] not null default '{}',
  stop_ids uuid[] not null default '{}',
  stop_indexes integer[] not null default '{}',
  total_quantity numeric(14,3) not null default 0,
  total_pallet_equivalent numeric(12,4) not null default 0,
  total_zce numeric(14,3) not null default 0,
  total_volume_m3 numeric(12,4) not null default 0,
  total_weight_kg numeric(12,2) not null default 0,
  returnable_quantity numeric(14,3) not null default 0,
  blocking_risk numeric(5,2) not null default 0,
  rationale text[] not null default '{}',
  status text not null default 'planned' check (status in ('planned', 'loaded', 'opened', 'completed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, box_code)
);

create table if not exists public.cargo_box_items (
  id uuid primary key default gen_random_uuid(),
  cargo_box_id uuid not null references public.cargo_boxes(id) on delete cascade,
  delivery_item_id uuid references public.delivery_items(id) on delete set null,
  stop_id uuid references public.route_stops(id) on delete set null,
  material_id text not null,
  material_description text not null,
  quantity numeric(14,3) not null,
  sale_unit text not null,
  statistical_boxes numeric(14,3) not null default 0,
  pallet_equivalent numeric(12,4) not null default 0,
  warehouse_location text,
  load_action text not null default 'deliver' check (load_action in ('deliver', 'return_pickup', 'buffer')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.loading_cycles (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  cycle_index integer not null,
  title text not null,
  summary text,
  status text not null default 'pending' check (status in ('pending', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, cycle_index)
);

create table if not exists public.loading_steps (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.loading_cycles(id) on delete cascade,
  step_index integer not null,
  cargo_box_id uuid references public.cargo_boxes(id) on delete set null,
  material_id text,
  material_description text,
  quantity numeric(14,3) not null default 0,
  sale_unit text,
  statistical_boxes numeric(14,3) not null default 0,
  warehouse_location text,
  instruction text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, step_index)
);

create table if not exists public.route_legs (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  leg_index integer not null,
  from_stop_id uuid references public.route_stops(id) on delete set null,
  to_stop_id uuid references public.route_stops(id) on delete set null,
  from_name text not null,
  to_name text not null,
  distance_km numeric(12,3) not null default 0,
  duration_minutes numeric(12,2) not null default 0,
  geometry jsonb not null default '[]'::jsonb,
  geometry_source text not null default 'osrm',
  created_at timestamptz not null default now(),
  unique (route_id, leg_index)
);

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('road_closure', 'delivery_delay', 'new_order', 'stop_completed', 'loading_issue', 'vehicle_issue', 'route_recalculated', 'note')),
  severity text not null default 'info' check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  route_id uuid references public.routes(id) on delete set null,
  stop_id uuid references public.route_stops(id) on delete set null,
  delivery_id uuid references public.deliveries(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  title text not null,
  description text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.route_versions (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  version_number integer not null,
  active boolean not null default false,
  geometry jsonb not null default '[]'::jsonb,
  stop_order uuid[] not null default '{}',
  summary text,
  changed_by_event_id uuid references public.operational_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (route_id, version_number)
);

create table if not exists public.route_recalculation_jobs (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.routes(id) on delete cascade,
  event_id uuid references public.operational_events(id) on delete set null,
  requested_by uuid references public.app_users(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'applied', 'failed', 'cancelled')),
  reason text not null,
  previous_route_version_id uuid references public.route_versions(id) on delete set null,
  applied_route_version_id uuid references public.route_versions(id) on delete set null,
  visual_delta jsonb not null default '{"mode":"demo_shift","meters":120,"pulse":true}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_actions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.drivers(id) on delete set null,
  route_id uuid references public.routes(id) on delete cascade,
  stop_id uuid references public.route_stops(id) on delete set null,
  delivery_id uuid references public.deliveries(id) on delete set null,
  action_type text not null check (action_type in ('start_route', 'arrive_stop', 'complete_delivery', 'fail_delivery', 'report_incident', 'complete_loading_step')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_routes_run on public.routes(planning_run_id);
create index if not exists idx_routes_driver on public.routes(driver_id);
create index if not exists idx_route_stops_route on public.route_stops(route_id, stop_index);
create index if not exists idx_deliveries_stop on public.deliveries(stop_id);
create index if not exists idx_delivery_items_delivery on public.delivery_items(delivery_id);
create index if not exists idx_cargo_boxes_route on public.cargo_boxes(route_id);
create index if not exists idx_events_route_status on public.operational_events(route_id, status, created_at desc);
create index if not exists idx_recalc_route_status on public.route_recalculation_jobs(route_id, status, created_at desc);

drop trigger if exists set_updated_at_app_users on public.app_users;
create trigger set_updated_at_app_users before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_vehicles on public.vehicles;
create trigger set_updated_at_vehicles before update on public.vehicles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_drivers on public.drivers;
create trigger set_updated_at_drivers before update on public.drivers
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_planning_runs on public.planning_runs;
create trigger set_updated_at_planning_runs before update on public.planning_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_routes on public.routes;
create trigger set_updated_at_routes before update on public.routes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_route_stops on public.route_stops;
create trigger set_updated_at_route_stops before update on public.route_stops
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_deliveries on public.deliveries;
create trigger set_updated_at_deliveries before update on public.deliveries
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_delivery_items on public.delivery_items;
create trigger set_updated_at_delivery_items before update on public.delivery_items
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_cargo_boxes on public.cargo_boxes;
create trigger set_updated_at_cargo_boxes before update on public.cargo_boxes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_loading_cycles on public.loading_cycles;
create trigger set_updated_at_loading_cycles before update on public.loading_cycles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_loading_steps on public.loading_steps;
create trigger set_updated_at_loading_steps before update on public.loading_steps
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_events on public.operational_events;
create trigger set_updated_at_events before update on public.operational_events
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_recalc on public.route_recalculation_jobs;
create trigger set_updated_at_recalc before update on public.route_recalculation_jobs
for each row execute function public.set_updated_at();

create or replace function public.enqueue_recalculation_for_event()
returns trigger
language plpgsql
as $$
begin
  if new.route_id is not null
     and new.event_type in ('road_closure', 'delivery_delay', 'new_order', 'vehicle_issue')
     and new.status = 'open' then
    update public.routes
       set status = 'recalculating'
     where id = new.route_id
       and status <> 'completed';

    insert into public.route_recalculation_jobs(route_id, event_id, requested_by, reason, visual_delta)
    values (
      new.route_id,
      new.id,
      new.created_by,
      new.title,
      jsonb_build_object(
        'mode', 'demo_route_update',
        'pulse', true,
        'meters', 120,
        'event_type', new.event_type,
        'created_at', new.created_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists enqueue_recalculation_for_event on public.operational_events;
create trigger enqueue_recalculation_for_event
after insert on public.operational_events
for each row execute function public.enqueue_recalculation_for_event();

create or replace view public.host_live_dashboard as
select
  pr.id as planning_run_id,
  pr.run_code,
  pr.planning_date,
  pr.max_active_vehicles,
  pr.total_routes,
  pr.total_distance_km,
  pr.total_zce,
  pr.original_stop_count,
  pr.optimized_stop_count,
  pr.parking_stops_saved,
  count(r.id) filter (where r.status in ('planned', 'loading', 'en_route', 'recalculating')) as active_routes,
  count(r.id) filter (where r.status = 'recalculating') as recalculating_routes,
  count(e.id) filter (where e.status = 'open') as open_events
from public.planning_runs pr
left join public.routes r on r.planning_run_id = pr.id
left join public.operational_events e on e.route_id = r.id
where pr.status = 'active'
group by pr.id;

create or replace view public.driver_current_route as
select
  d.driver_code,
  d.full_name,
  r.id as route_id,
  r.route_code,
  r.status,
  r.route_label,
  r.total_zce,
  r.parking_stops_saved,
  v.vehicle_code,
  v.template,
  jsonb_agg(
    jsonb_build_object(
      'stop_id', s.id,
      'stop_index', s.stop_index,
      'client_names', s.client_names,
      'town', s.town,
      'arrival_time', s.arrival_time,
      'status', s.status,
      'grouped_stop_count', s.grouped_stop_count,
      'parking_optimization_reason', s.parking_optimization_reason
    )
    order by s.stop_index
  ) filter (where s.id is not null) as stops
from public.drivers d
join public.routes r on r.driver_id = d.id
left join public.vehicles v on v.id = r.vehicle_id
left join public.route_stops s on s.route_id = r.id
where r.status in ('planned', 'loading', 'en_route', 'recalculating')
group by d.driver_code, d.full_name, r.id, v.vehicle_code, v.template;

create or replace view public.event_feed as
select
  e.id,
  e.event_type,
  e.severity,
  e.title,
  e.description,
  e.status,
  e.created_at,
  r.route_code,
  s.stop_index,
  s.client_names,
  e.payload
from public.operational_events e
left join public.routes r on r.id = e.route_id
left join public.route_stops s on s.id = e.stop_id
order by e.created_at desc;

insert into public.app_users(handle, role, display_name, demo_pin)
values
  ('host-controller', 'host_controller', 'Controlador LogiOpti', '0000'),
  ('driver-demo', 'driver', 'Conductor demo', '1111'),
  ('warehouse-demo', 'warehouse', 'Almacen demo', '2222')
on conflict (handle) do update
set role = excluded.role,
    display_name = excluded.display_name,
    demo_pin = excluded.demo_pin;

insert into public.vehicles(vehicle_code, template, license_plate, pallet_capacity, zce_capacity, volume_capacity_m3)
values
  ('DEMO-TRUCK-6', 'truck_6', 'DEMO-6P', 6, 1080, 42),
  ('DEMO-TRUCK-8', 'truck_8', 'DEMO-8P', 8, 1440, 56),
  ('DEMO-VAN-3', 'van_3', 'DEMO-3P', 3, 540, 18)
on conflict (vehicle_code) do update
set template = excluded.template,
    license_plate = excluded.license_plate,
    pallet_capacity = excluded.pallet_capacity,
    zce_capacity = excluded.zce_capacity,
    volume_capacity_m3 = excluded.volume_capacity_m3;

insert into public.drivers(user_id, driver_code, full_name, default_vehicle_id)
select u.id, 'DRIVER-DEMO', u.display_name, v.id
from public.app_users u
cross join public.vehicles v
where u.handle = 'driver-demo'
  and v.vehicle_code = 'DEMO-TRUCK-6'
on conflict (driver_code) do update
set user_id = excluded.user_id,
    full_name = excluded.full_name,
    default_vehicle_id = excluded.default_vehicle_id;

alter table public.app_users disable row level security;
alter table public.vehicles disable row level security;
alter table public.drivers disable row level security;
alter table public.planning_runs disable row level security;
alter table public.routes disable row level security;
alter table public.route_stops disable row level security;
alter table public.deliveries disable row level security;
alter table public.delivery_items disable row level security;
alter table public.cargo_boxes disable row level security;
alter table public.cargo_box_items disable row level security;
alter table public.loading_cycles disable row level security;
alter table public.loading_steps disable row level security;
alter table public.route_legs disable row level security;
alter table public.operational_events disable row level security;
alter table public.route_versions disable row level security;
alter table public.route_recalculation_jobs disable row level security;
alter table public.driver_actions disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.app_users,
  public.vehicles,
  public.drivers,
  public.planning_runs,
  public.routes,
  public.route_stops,
  public.deliveries,
  public.delivery_items,
  public.cargo_boxes,
  public.cargo_box_items,
  public.loading_cycles,
  public.loading_steps,
  public.route_legs,
  public.operational_events,
  public.route_versions,
  public.route_recalculation_jobs,
  public.driver_actions
to anon, authenticated;

grant select on
  public.host_live_dashboard,
  public.driver_current_route,
  public.event_feed
to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.operational_events'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.route_recalculation_jobs'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.routes'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.route_stops'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.deliveries'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.driver_actions'; exception when duplicate_object then null; end;
  end if;
end;
$$;

commit;
