-- Use the member-facing status labels requested by the profile form.
update app.lookup_marital_statuses
set name = 'Single'
where code = 'never_married';

update app.lookup_marital_statuses
set name = 'Widowed'
where code = 'widowed';
