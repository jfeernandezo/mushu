-- Granular permissions: roles are identity, permission groups are the only
-- source of access rules. Implements the architecture rule:
--
--   - User -> permission_group  (direct, M:N within an org)
--   - Role -> permission_group  (template; role X auto-grants groups Y/Z)
--   - Plan -> permission_group  (org's subscription unlocks feature groups)
--
-- A permission resolves true if it lives in ANY group reached via those
-- three paths. See packages/db/src/schema/permissions.ts and
-- apps/web/src/lib/permissions.ts for the runtime resolver.

-- 1) Catalog tables --------------------------------------------------------

CREATE TABLE "permission" (
  "code" text PRIMARY KEY,
  "description" text NOT NULL,
  "scope" text NOT NULL,                          -- 'workspace' | 'feature' | 'system'
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "permission_group" (
  "code" text PRIMARY KEY,
  "description" text NOT NULL,
  "is_system" boolean NOT NULL DEFAULT false,    -- true = managed by us, can't be deleted via UI
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "permission_group_permission" (
  "group_code" text NOT NULL REFERENCES "permission_group"("code") ON DELETE cascade,
  "permission_code" text NOT NULL REFERENCES "permission"("code") ON DELETE cascade,
  PRIMARY KEY ("group_code", "permission_code")
);

CREATE TABLE "role_permission_group" (
  "role_code" text NOT NULL,                      -- 'owner' | 'admin' | 'editor' | 'viewer'
  "group_code" text NOT NULL REFERENCES "permission_group"("code") ON DELETE cascade,
  PRIMARY KEY ("role_code", "group_code")
);

-- Tenant-scoped: the organization a member belongs to. Denormalized so RLS
-- policies can scope without joining through `member`.
CREATE TABLE "member_permission_group" (
  "member_id" text NOT NULL REFERENCES "member"("id") ON DELETE cascade,
  "group_code" text NOT NULL REFERENCES "permission_group"("code") ON DELETE cascade,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("member_id", "group_code")
);
CREATE INDEX "member_permission_group_org_idx" ON "member_permission_group" ("organization_id");
CREATE INDEX "member_permission_group_member_idx" ON "member_permission_group" ("member_id");

-- 2) Seed: permissions catalog --------------------------------------------

INSERT INTO "permission" ("code", "description", "scope") VALUES
  -- Workspace administration
  ('workspace.settings.manage', 'Editar configurações do workspace', 'workspace'),
  ('workspace.delete', 'Deletar o workspace', 'workspace'),
  ('workspace.export_full_data', 'Exportar dados completos do workspace (LGPD portabilidade)', 'workspace'),
  ('billing.manage', 'Ver e alterar plano + método de pagamento', 'workspace'),

  -- Member management
  ('member.invite', 'Convidar novos membros', 'workspace'),
  ('member.remove', 'Remover membros', 'workspace'),
  ('member.role.assign', 'Alterar role de outros membros', 'workspace'),

  -- Flow lifecycle
  ('flow.create', 'Criar novos fluxos', 'workspace'),
  ('flow.edit', 'Editar fluxos (rascunho)', 'workspace'),
  ('flow.publish', 'Publicar/despublicar fluxos', 'workspace'),
  ('flow.delete', 'Deletar fluxos', 'workspace'),

  -- Contacts and inbox
  ('contact.view', 'Ver lista de contatos', 'workspace'),
  ('contact.edit', 'Editar contatos (tags, custom fields)', 'workspace'),
  ('inbox.view', 'Ver inbox de conversas', 'workspace'),
  ('inbox.reply', 'Responder mensagens manualmente', 'workspace'),

  -- Analytics
  ('analytics.view', 'Ver analytics e métricas', 'workspace'),

  -- Instagram integration
  ('instagram.connect', 'Conectar nova conta Instagram', 'workspace'),
  ('instagram.disconnect', 'Desconectar conta Instagram', 'workspace'),

  -- Plan-unlocked features
  ('feature.ai_step', 'Usar bloco de IA nos fluxos', 'feature'),
  ('feature.white_label', 'Remover branding Mushu das mensagens', 'feature'),
  ('feature.custom_subdomain', 'Sub-domínio próprio (bot.suaempresa.com.br)', 'feature'),
  ('feature.priority_support', 'Suporte prioritário com SLA', 'feature');

-- 3) Seed: workspace permission groups (templates per role) ---------------

INSERT INTO "permission_group" ("code", "description", "is_system") VALUES
  ('workspace_owner_group', 'Permissões totais de proprietário do workspace', true),
  ('workspace_admin_group', 'Permissões administrativas (sem billing nem deletar workspace)', true),
  ('workspace_editor_group', 'Criar/editar/publicar fluxos, ver e responder inbox', true),
  ('workspace_viewer_group', 'Somente-leitura: ver contatos, inbox e analytics', true),
  -- Plan feature groups
  ('plan_free_features', 'Features incluídas no plano Free (nenhuma feature paga)', true),
  ('plan_pro_features', 'Features incluídas no plano Pro', true),
  ('plan_agency_features', 'Features incluídas no plano Agency (inclui tudo do Pro)', true);

-- 4) Seed: group -> permission mappings -----------------------------------

-- Owner: every workspace permission
INSERT INTO "permission_group_permission" ("group_code", "permission_code")
  SELECT 'workspace_owner_group', "code" FROM "permission" WHERE "scope" = 'workspace';

-- Admin: workspace permissions EXCEPT billing.manage and workspace.delete
INSERT INTO "permission_group_permission" ("group_code", "permission_code")
  SELECT 'workspace_admin_group', "code" FROM "permission"
   WHERE "scope" = 'workspace'
     AND "code" NOT IN ('billing.manage', 'workspace.delete');

-- Editor: content lifecycle + inbox + analytics
INSERT INTO "permission_group_permission" ("group_code", "permission_code") VALUES
  ('workspace_editor_group', 'flow.create'),
  ('workspace_editor_group', 'flow.edit'),
  ('workspace_editor_group', 'flow.publish'),
  ('workspace_editor_group', 'flow.delete'),
  ('workspace_editor_group', 'contact.view'),
  ('workspace_editor_group', 'contact.edit'),
  ('workspace_editor_group', 'inbox.view'),
  ('workspace_editor_group', 'inbox.reply'),
  ('workspace_editor_group', 'analytics.view');

-- Viewer: read-only
INSERT INTO "permission_group_permission" ("group_code", "permission_code") VALUES
  ('workspace_viewer_group', 'contact.view'),
  ('workspace_viewer_group', 'inbox.view'),
  ('workspace_viewer_group', 'analytics.view');

-- Plan features
-- Pro: AI step, white-label, priority support
INSERT INTO "permission_group_permission" ("group_code", "permission_code") VALUES
  ('plan_pro_features', 'feature.ai_step'),
  ('plan_pro_features', 'feature.white_label'),
  ('plan_pro_features', 'feature.priority_support');

-- Agency: everything Pro has + custom subdomain
INSERT INTO "permission_group_permission" ("group_code", "permission_code") VALUES
  ('plan_agency_features', 'feature.ai_step'),
  ('plan_agency_features', 'feature.white_label'),
  ('plan_agency_features', 'feature.priority_support'),
  ('plan_agency_features', 'feature.custom_subdomain');

-- 5) Seed: role -> group mapping (the templates) --------------------------

INSERT INTO "role_permission_group" ("role_code", "group_code") VALUES
  ('owner', 'workspace_owner_group'),
  ('admin', 'workspace_admin_group'),
  ('editor', 'workspace_editor_group'),
  ('viewer', 'workspace_viewer_group');

-- 6) Backfill existing members --------------------------------------------
--
-- Existing 'owner' members keep their full permissions via the owner group.
-- Existing 'member' members (Better Auth's default role) had unrestricted
-- access in the previous code (no permission checks existed) — migrating
-- them to 'editor' preserves their ability to create/edit/publish flows
-- without granting billing/destruction. Owners can downgrade to 'viewer'
-- afterwards via the new /settings/members UI.

-- Bulk-grant owner_group to every existing 'owner' member.
INSERT INTO "member_permission_group" ("member_id", "group_code", "organization_id")
  SELECT "id", 'workspace_owner_group', "organization_id"
    FROM "member"
   WHERE "role" = 'owner'
  ON CONFLICT DO NOTHING;

-- Migrate role string 'member' -> 'editor' AND grant editor_group.
-- (Order matters: update role first so future signups inheriting old code
--  paths don't see a stale value, then grant the matching group.)
UPDATE "member" SET "role" = 'editor' WHERE "role" = 'member';

INSERT INTO "member_permission_group" ("member_id", "group_code", "organization_id")
  SELECT "id", 'workspace_editor_group', "organization_id"
    FROM "member"
   WHERE "role" = 'editor'
  ON CONFLICT DO NOTHING;

-- 7) Row Level Security on member_permission_group ------------------------
--
-- The catalog tables (permission, permission_group, *_permission, role_*)
-- are global and read by all tenants — no RLS. Only the join table that
-- carries org context gets isolated.

ALTER TABLE "member_permission_group" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "member_permission_group"
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
