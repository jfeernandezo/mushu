CREATE TABLE "flow_step_event" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "flow_id" text NOT NULL REFERENCES "flow"("id") ON DELETE CASCADE,
  "execution_id" text NOT NULL REFERENCES "flow_execution"("id") ON DELETE CASCADE,
  "node_id" text NOT NULL,
  "node_type" text NOT NULL,
  "outcome" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "flow_step_event_flow_created_idx" ON "flow_step_event" ("flow_id", "created_at");
CREATE INDEX "flow_step_event_org_idx" ON "flow_step_event" ("organization_id");
CREATE UNIQUE INDEX "flow_step_event_step_unique" ON "flow_step_event" ("execution_id", "node_id") WHERE outcome <> 'click';
CREATE TABLE "tracked_link" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "execution_id" text NOT NULL REFERENCES "flow_execution"("id") ON DELETE CASCADE,
  "node_id" text NOT NULL,
  "url" text NOT NULL
);
CREATE INDEX "tracked_link_org_idx" ON "tracked_link" ("organization_id");
CREATE INDEX "tracked_link_execution_idx" ON "tracked_link" ("execution_id");
ALTER TABLE "flow_step_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "flow_step_event"
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
ALTER TABLE "tracked_link" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tracked_link"
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
