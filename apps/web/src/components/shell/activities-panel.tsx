import { Activity, AlertCircle, MessageCircle, UserPlus, Workflow } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { colorFromString, initialsFromName } from '@/lib/utils';

interface NotificationItem {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}

interface ActivityItem {
  id: string;
  contactName: string;
  description: string;
  timeAgo: string;
}

interface ContactItem {
  id: string;
  name: string;
  igUsername: string;
}

interface ActivitiesPanelProps {
  notifications?: NotificationItem[];
  activities?: ActivityItem[];
  contacts?: ContactItem[];
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    icon: <AlertCircle className="h-4 w-4 text-[var(--color-mushu-amber)]" />,
    title: 'No Instagram account connected yet',
    subtitle: 'Connect one in Settings to start receiving events',
  },
];

const DEFAULT_ACTIVITIES: ActivityItem[] = [];
const DEFAULT_CONTACTS: ContactItem[] = [];

export function ActivitiesPanel({
  notifications = DEFAULT_NOTIFICATIONS,
  activities = DEFAULT_ACTIVITIES,
  contacts = DEFAULT_CONTACTS,
}: ActivitiesPanelProps) {
  return (
    <aside className="flex h-screen w-80 flex-col gap-6 overflow-y-auto border-l border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-5 py-6">
      <Section title="Notifications" icon={<AlertCircle className="h-3.5 w-3.5" />}>
        {notifications.length === 0 ? (
          <EmptyHint>You're all caught up.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3">
                <div className="mt-0.5">{n.icon}</div>
                <div className="flex-1 leading-tight">
                  <p className="text-sm text-[var(--color-mushu-ink)]">{n.title}</p>
                  <p className="text-xs text-[var(--color-mushu-faint)]">{n.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Separator />

      <Section title="Activities" icon={<Activity className="h-3.5 w-3.5" />}>
        {activities.length === 0 ? (
          <EmptyHint>No flow runs yet.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-3">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback
                    style={{ backgroundColor: colorFromString(a.contactName) }}
                    className="text-[10px] text-white"
                  >
                    {initialsFromName(a.contactName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 leading-tight">
                  <p className="text-sm text-[var(--color-mushu-ink)]">
                    <span className="font-medium">{a.contactName}</span>{' '}
                    <span className="text-[var(--color-mushu-mute)]">{a.description}</span>
                  </p>
                  <p className="text-xs text-[var(--color-mushu-faint)]">{a.timeAgo}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Separator />

      <Section title="Recent contacts" icon={<UserPlus className="h-3.5 w-3.5" />}>
        {contacts.length === 0 ? (
          <EmptyHint>No contacts yet — they'll appear here as people interact with your IG.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-3">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback
                    style={{ backgroundColor: colorFromString(c.name) }}
                    className="text-[10px] text-white"
                  >
                    {initialsFromName(c.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 leading-tight">
                  <p className="text-sm text-[var(--color-mushu-ink)]">{c.name}</p>
                  <p className="text-xs text-[var(--color-mushu-faint)]">@{c.igUsername}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </aside>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-1.5 text-[var(--color-mushu-mute)]">
        {icon}
        <h2 className="text-xs font-medium uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-[var(--color-mushu-faint)]">{children}</p>;
}

// Suppress unused imports referenced by future hooks.
void Workflow;
void MessageCircle;
