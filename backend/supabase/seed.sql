insert into app.lookup_religions(code, name) values
  ('hindu', 'Hindu'), ('christian', 'Christian'), ('muslim', 'Muslim'), ('other', 'Other')
on conflict (code) do nothing;

do $$
declare
  v_sample record;
  v_id uuid;
  v_admin uuid := '00000000-0000-0000-0000-000000000001';
begin
  perform set_config('app.profile_moderation_rpc', 'on', true);
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
    email_change, email_change_token_current, phone_change, phone_change_token,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'seed-admin@example.local', crypt('LocalAdmin@12345', gen_salt('bf')), now(),
    '', '', '', '', '', '', '',
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Seed Admin","privacy_policy_accepted":true,"terms_accepted":true,"policy_version":"v1"}'::jsonb
  ) on conflict (id) do nothing;
  insert into app.user_roles(user_id, role) values (v_admin, 'admin') on conflict do nothing;
  update app.profiles set display_name = 'Seed Admin', status = 'approved', gender = 'other',
    date_of_birth = date '1980-01-01'
  where user_id = v_admin;

  -- Stable local-only identities make the sample accounts easy to inspect and
  -- keep repeated seed runs from creating another set of demo profiles.
  for v_sample in
    select * from (values
      ('seed-man-01@example.local', 'Arjun Kumar', 'male', date '1994-03-12', 'Chennai', 'Software Engineer', 'I enjoy building useful technology, reading and spending time with my family. I value kindness, honest communication and a balanced life.'),
      ('seed-man-02@example.local', 'Karthik Raj', 'male', date '1991-08-24', 'Coimbatore', 'Mechanical Engineer', 'I am a thoughtful and practical person who enjoys travel, music and learning new skills. I hope to build a supportive partnership rooted in respect.'),
      ('seed-man-03@example.local', 'Vijay Anand', 'male', date '1996-01-05', 'Madurai', 'Doctor', 'I work in healthcare and make time for friends, books and community service. Family, empathy and a positive outlook are important to me.'),
      ('seed-man-04@example.local', 'Sathish Balan', 'male', date '1993-06-18', 'Tiruchirappalli', 'Teacher', 'I find joy in teaching, gardening and exploring local food. I appreciate a simple, warm home and a partner who values open conversations.'),
      ('seed-man-05@example.local', 'Praveen Selvam', 'male', date '1998-11-02', 'Salem', 'Accountant', 'I am easygoing and close to my family. I enjoy badminton, cooking on weekends and making plans together with care and understanding.'),
      ('seed-woman-01@example.local', 'Ananya Devi', 'female', date '1995-02-16', 'Chennai', 'Architect', 'I love thoughtful design, classical music and discovering new places. I value mutual respect, a sense of humor and making decisions as a team.'),
      ('seed-woman-02@example.local', 'Meera Lakshmi', 'female', date '1992-07-09', 'Coimbatore', 'Chartered Accountant', 'I enjoy reading, volunteering and spending time outdoors. I hope for a caring partnership where both people encourage each other’s goals.'),
      ('seed-woman-03@example.local', 'Nandhini Priya', 'female', date '1997-04-27', 'Madurai', 'Pharmacist', 'I am cheerful, family-oriented and curious about the world. Cooking with my family and short weekend trips are among my favorite things.'),
      ('seed-woman-04@example.local', 'Divya Shree', 'female', date '1994-10-13', 'Tiruchirappalli', 'Product Designer', 'I work in design and enjoy art, music and long walks. I believe a strong relationship grows through trust, patience and shared laughter.'),
      ('seed-woman-05@example.local', 'Keerthana Rani', 'female', date '1999-05-21', 'Salem', 'Data Analyst', 'I like solving problems, trying new recipes and catching up with friends. I value kindness, family bonds and a partner who communicates openly.')
    ) as samples(email, display_name, gender, date_of_birth, city, occupation, about_me)
  loop
    v_id := md5(v_sample.email)::uuid;
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_token, recovery_token, email_change_token_new,
        email_change, email_change_token_current, phone_change, phone_change_token,
        created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
      ) values (
        v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        v_sample.email,
        crypt('LocalUser@12345', gen_salt('bf')), now(),
        '', '', '', '', '', '', '',
        now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'display_name', v_sample.display_name,
        'gender', v_sample.gender,
        'date_of_birth', v_sample.date_of_birth,
        'profile_for', 'self',
        'privacy_policy_accepted', true,
        'terms_accepted', true,
        'policy_version', 'v1'
      )
    ) on conflict (id) do nothing;
    update app.profiles set display_name = v_sample.display_name,
      status = 'approved',
      gender = v_sample.gender::app.gender,
      date_of_birth = v_sample.date_of_birth,
      profile_for = 'self',
      city = v_sample.city,
      state = 'Tamil Nadu',
      country = 'India',
      occupation = v_sample.occupation,
      about_me = v_sample.about_me
    where user_id = v_id;
  end loop;

  insert into app.cms_success_stories(title, story, is_published)
  values
    ('Seed Couple One', 'A local development success story.', true),
    ('Seed Couple Two', 'Another local development success story.', true);
end
$$;

insert into app.lookup_education(code, name) values
  ('be', 'B.E.'), ('btech', 'B.Tech'), ('me', 'M.E.'), ('mba', 'MBA'),
  ('mbbs', 'MBBS'), ('arts', 'Arts and Science'), ('other', 'Other')
on conflict (code) do nothing;

insert into app.lookup_rasis(code, name) values
  ('mesham','Mesham'), ('rishabam','Rishabam'), ('mithunam','Mithunam'),
  ('kadagam','Kadagam'), ('simmam','Simmam'), ('kanni','Kanni'),
  ('thulam','Thulam'), ('viruchigam','Viruchigam'), ('dhanusu','Dhanusu'),
  ('makaram','Makaram'), ('kumbam','Kumbam'), ('meenam','Meenam')
on conflict (code) do nothing;

insert into app.lookup_nakshatras(code, name) values
  ('ashwini','Ashwini'), ('bharani','Bharani'), ('krittika','Krittika'),
  ('rohini','Rohini'), ('mirugaseerisham','Mirugaseerisham'), ('thiruvathirai','Thiruvathirai'),
  ('punarpoosam','Punarpoosam'), ('poosam','Poosam'), ('ayilyam','Ayilyam'),
  ('magam','Magam'), ('pooram','Pooram'), ('uthiram','Uthiram'),
  ('hastham','Hastham'), ('chithirai','Chithirai'), ('swathi','Swathi'),
  ('visakam','Visakam'), ('anusham','Anusham'), ('kettai','Kettai'),
  ('moolam','Moolam'), ('pooradam','Pooradam'), ('uthradam','Uthradam'),
  ('thiruvonam','Thiruvonam'), ('avittam','Avittam'), ('sathayam','Sathayam'),
  ('poorattathi','Poorattathi'), ('uthrattathi','Uthrattathi'), ('revathi','Revathi')
on conflict (code) do nothing;

insert into app.lookup_marital_statuses(code, name) values
  ('never_married','Single'), ('divorced','Divorced'),
  ('widowed','Widowed'), ('separated','Separated')
on conflict (code) do update set name = excluded.name;

insert into app.lookup_diets(code, name) values
  ('vegetarian','Vegetarian'), ('non_vegetarian','Non-vegetarian'), ('vegan','Vegan')
on conflict (code) do nothing;
