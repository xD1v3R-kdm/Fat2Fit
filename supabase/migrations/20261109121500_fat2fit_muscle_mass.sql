-- Fat2Fit 0.5.1: support measured skeletal muscle mass (kg) alongside body circumferences.
alter table public.body_measurements add column if not exists muscle_mass_kg numeric(6,2)
 check (muscle_mass_kg is null or muscle_mass_kg between 1 and 300);
alter table public.body_measurements drop constraint if exists body_measurements_has_value;
alter table public.body_measurements
 add constraint body_measurements_has_value
 check (num_nonnulls(weight_kg,waist_cm,chest_cm,biceps_cm,thigh_cm,hips_cm,muscle_mass_kg)>0);
