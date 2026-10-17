begin;
select plan(5);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'avatar@test.dev');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);

select lives_ok($$select set_avatar('data:image/jpeg;base64,AAAA')$$, 'a person sets their photo');
select is((select avatar from profiles where user_id = '00000000-0000-0000-0000-0000000000a7'), 'data:image/jpeg;base64,AAAA', 'it is stored on their profile');
select throws_ok($$select set_avatar('data:text/html;base64,AAAA')$$, '23514', null, 'only JPEG images are accepted');
select throws_ok($$select set_avatar('data:image/jpeg;base64,' || repeat('A', 100000))$$, '23514', null, 'a huge image is refused');
select lives_ok($$select set_avatar(null)$$, 'the photo can be removed');

select * from finish();
rollback;
