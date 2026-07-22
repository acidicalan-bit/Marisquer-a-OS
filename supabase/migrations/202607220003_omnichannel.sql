-- Bandeja omnicanal para WhatsApp Business, Instagram y Facebook.

insert into public.permissions (organization_id, code, description)
select organization.id, 'inbox.manage', 'Administrar canales y conversaciones de redes'
from public.organizations organization
on conflict (organization_id, code) do update set description = excluded.description;

insert into public.role_permissions (organization_id, role_id, permission_id)
select role.organization_id, role.id, permission.id
from public.roles role
join public.permissions permission on permission.organization_id = role.organization_id
where role.code in ('administrator', 'manager') and permission.code = 'inbox.manage'
on conflict do nothing;

create table public.integration_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  channel_type text not null check (channel_type in ('whatsapp', 'instagram', 'facebook')),
  display_name text not null,
  external_account_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'error')),
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, channel_type)
);

create table public.social_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  channel_id uuid not null references public.integration_channels(id) on delete cascade,
  external_conversation_id text not null,
  contact_name text,
  contact_handle text,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'spam')),
  assigned_to uuid references public.user_profiles(id),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, external_conversation_id)
);

create table public.social_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  branch_id uuid not null references public.branches(id),
  channel_id uuid not null references public.integration_channels(id) on delete cascade,
  conversation_id uuid not null references public.social_conversations(id) on delete cascade,
  external_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text',
  body text,
  media_url text,
  status text not null default 'received' check (status in ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  ai_suggested boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  sent_by uuid references public.user_profiles(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (channel_id, external_message_id)
);

create trigger set_integration_channels_updated_at before update on public.integration_channels
for each row execute function public.set_updated_at();
create trigger set_social_conversations_updated_at before update on public.social_conversations
for each row execute function public.set_updated_at();

create index social_conversations_inbox_idx on public.social_conversations(branch_id, status, last_message_at desc);
create index social_messages_conversation_idx on public.social_messages(conversation_id, occurred_at);

do $$
declare table_name text;
begin
  foreach table_name in array array['integration_channels', 'social_conversations', 'social_messages'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''inbox.manage'')) with check (organization_id = public.current_organization_id() and (branch_id = public.current_branch_id() or public.has_permission(''branches.all'')) and public.has_permission(''inbox.manage''))',
      table_name || '_manage', table_name
    );
  end loop;
end $$;

alter publication supabase_realtime add table public.social_conversations, public.social_messages;
