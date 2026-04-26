'use server';

import { contact, contactInbox, withOrgTx } from '@mushu/db';
import { desc, eq } from 'drizzle-orm';

export interface RecentContact {
  id: string;
  name: string | null;
  igUsername: string | null;
  profilePicUrl: string | null;
}

export async function getRecentContacts(orgId: string, limit = 5): Promise<RecentContact[]> {
  // Joins contact (org-scoped) with contact_inbox to get an IG username for
  // display. Multiple inboxes per contact are possible — we take any.
  const rows = await withOrgTx(orgId, (tx) =>
    tx
      .select({
        id: contact.id,
        name: contact.name,
        profilePicUrl: contact.profilePicUrl,
        updatedAt: contact.updatedAt,
        igUsername: contactInbox.igUsername,
      })
      .from(contact)
      .leftJoin(contactInbox, eq(contactInbox.contactId, contact.id))
      .where(eq(contact.organizationId, orgId))
      .orderBy(desc(contact.updatedAt))
      .limit(limit),
  );

  // Dedup on contact.id (a contact may appear N times if it has N inboxes).
  const seen = new Set<string>();
  const out: RecentContact[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({
      id: r.id,
      name: r.name,
      igUsername: r.igUsername,
      profilePicUrl: r.profilePicUrl,
    });
    if (out.length >= limit) break;
  }
  return out;
}
