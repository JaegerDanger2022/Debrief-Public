"use client";

import { useEffect, useState, useCallback } from "react";
import {
  integrationsApi,
  IntegrationStatus,
  IntegrationSlug,
  NotionPage,
  TodoistProject,
  PinnedResource,
} from "@/lib/api/integrations";

type FlatItem = { id: string; label: string; indent?: boolean; prefix?: string };

const INTEGRATION_META: Record<IntegrationSlug, { label: string; description: string }> = {
  notion: {
    label: "Notion",
    description: "Route captured items into Notion pages and databases.",
  },
  todoist: {
    label: "Todoist",
    description: "Create tasks in Todoist projects from captured items.",
  },
};

// ─── Resource adder ───────────────────────────────────────────────────────────

function ResourceAdder({
  slug,
  pinnedIds,
  onAdd,
}: {
  slug: IntegrationSlug;
  pinnedIds: Set<string>;
  onAdd: (resource_id: string, label: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FlatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (slug === "notion") {
        const r = await integrationsApi.notionPages();
        setItems(
          r.data.map((p: NotionPage) => ({
            id: p.id,
            label: p.title,
            prefix: p.type === "database" ? "⊞" : "pg",
          }))
        );
      } else {
        const r = await integrationsApi.todoistProjects();
        const flat: FlatItem[] = [];
        for (const p of r.data as TodoistProject[]) {
          flat.push({ id: `project:${p.id}`, label: p.is_inbox ? "Inbox" : p.name, prefix: "▸" });
          for (const s of p.sections) {
            flat.push({ id: `section:${s.id}`, label: `${p.is_inbox ? "Inbox" : p.name} / ${s.name}`, indent: true, prefix: "≡" });
          }
        }
        setItems(flat);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setLoadError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // For Notion: open OAuth popup so user can grant more pages, then reload list
  const openNotionPicker = async () => {
    const res = await integrationsApi.connect("notion");
    const popup = window.open(res.data.auth_url, "debrief_oauth", "width=600,height=700");
    // Poll until popup closes, then reload pages
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        loadItems();
        setOpen(true);
      }
    }, 500);
  };

  const togglePicker = () => {
    if (!open) loadItems();
    setOpen((v) => !v);
  };

  // Extract real Todoist ID from composite key "project:<id>" or "section:<id>"
  const realId = (id: string) => id.includes(":") ? id.split(":")[1] : id;

  const pick = async (id: string, label: string) => {
    setAdding(id);
    await onAdd(realId(id), label);
    setAdding(null);
  };

  // Notion: two separate actions — grant pages (OAuth) and pin from list
  if (slug === "notion") {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={openNotionPicker}
            className="text-xs font-bold uppercase border border-brand-black/30 px-3 py-1.5 hover:border-brand-black hover:bg-brand-black hover:text-brand-white transition-colors"
          >
            + Grant pages in Notion
          </button>
          <button
            onClick={togglePicker}
            className="text-xs font-bold uppercase border border-brand-black/30 px-3 py-1.5 hover:border-brand-black hover:bg-brand-black hover:text-brand-white transition-colors"
          >
            {open ? "Close" : "Pin from granted pages"}
          </button>
        </div>

        {open && (
          <div className="border border-brand-black/15 bg-brand-white">
            {loading && (
              <p className="text-xs font-mono text-brand-black/40 px-3 py-2">Loading…</p>
            )}
            {!loading && loadError && (
              <p className="text-xs font-mono text-brand-accent px-3 py-2">{loadError}</p>
            )}
            {!loading && !loadError && items.length === 0 && (
              <p className="text-xs font-mono text-brand-black/40 px-3 py-2">
                No pages found. Use "Grant pages in Notion" to share pages with Debrief first.
              </p>
            )}
            {!loading && items.map((item) => {
              const pinned = pinnedIds.has(realId(item.id));
              return (
                <button
                  key={item.id}
                  onClick={() => !pinned && pick(item.id, item.label)}
                  disabled={pinned || adding === item.id}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-b border-brand-black/8 last:border-0 transition-colors ${
                    pinned ? "text-brand-black/30 cursor-default" : "hover:bg-brand-black/5 cursor-pointer"
                  }`}
                >
                  <span className="text-[10px] font-mono text-brand-black/40 w-5 shrink-0">
                    {(item as { id: string; label: string; prefix?: string }).prefix ?? "pg"}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {pinned && <span className="text-[10px] font-mono text-green-600">pinned</span>}
                  {adding === item.id && <span className="text-[10px] font-mono text-brand-black/40">adding…</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Todoist: project + section picker
  return (
    <div className="mt-3">
      <button
        onClick={togglePicker}
        className="text-xs font-bold uppercase border border-brand-black/30 px-3 py-1.5 hover:border-brand-black hover:bg-brand-black hover:text-brand-white transition-colors"
      >
        {open ? "Close" : "+ Add list"}
      </button>

      {open && (
        <div className="mt-2 border border-brand-black/15 bg-brand-white">
          {loading && (
            <p className="text-xs font-mono text-brand-black/40 px-3 py-2">Loading…</p>
          )}
          {!loading && loadError && (
            <p className="text-xs font-mono text-brand-accent px-3 py-2">{loadError}</p>
          )}
          {!loading && !loadError && items.length === 0 && (
            <p className="text-xs font-mono text-brand-black/40 px-3 py-2">No projects found.</p>
          )}
          {!loading && items.map((item) => {
            const pinned = pinnedIds.has(realId(item.id));
            return (
              <button
                key={item.id}
                onClick={() => !pinned && pick(item.id, item.label)}
                disabled={pinned || adding === item.id}
                className={`w-full text-left py-2 text-sm flex items-center gap-2 border-b border-brand-black/8 last:border-0 transition-colors ${
                  item.indent ? "pl-7" : "pl-3"
                } ${pinned ? "text-brand-black/30 cursor-default" : "hover:bg-brand-black/5 cursor-pointer"}`}
              >
                <span className="text-[10px] font-mono text-brand-black/40 w-4 shrink-0">{item.prefix}</span>
                <span className="flex-1">{item.label}</span>
                {pinned && <span className="text-[10px] font-mono text-green-600 pr-3">pinned</span>}
                {adding === item.id && <span className="text-[10px] font-mono text-brand-black/40 pr-3">adding…</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Integration card ─────────────────────────────────────────────────────────

function IntegrationCard({
  status,
  onConnect,
  onDisconnect,
  loading,
  resources,
  onAddResource,
  onRemoveResource,
}: {
  status: IntegrationStatus;
  onConnect: (slug: IntegrationSlug) => void;
  onDisconnect: (slug: IntegrationSlug) => void;
  loading: boolean;
  resources: PinnedResource[];
  onAddResource: (slug: IntegrationSlug, resource_id: string, label: string) => Promise<void>;
  onRemoveResource: (doc_id: string) => void;
}) {
  const meta = INTEGRATION_META[status.slug];
  const pinnedIds = new Set(resources.map((r) => r.resource_id));

  return (
    <div className="border-brutal border-brand-black p-5 shadow-brutal bg-brand-white">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-black uppercase text-lg">{meta.label}</span>
            {status.connected && (
              <span className="text-xs font-bold uppercase border border-green-600 text-green-700 px-2 py-0.5">
                Connected
              </span>
            )}
          </div>
          <p className="text-sm text-brand-black/70 mb-1">{meta.description}</p>
          {status.connected && status.account_label && (
            <p className="text-xs font-mono text-brand-black/50">{status.account_label}</p>
          )}
        </div>
        <div className="ml-6 shrink-0">
          {status.connected ? (
            <button
              onClick={() => onDisconnect(status.slug)}
              disabled={loading}
              className="border-2 border-brand-black px-4 py-2 text-sm font-bold uppercase hover:bg-brand-black hover:text-brand-white transition-colors disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => onConnect(status.slug)}
              disabled={loading}
              className="bg-brand-black text-brand-white px-4 py-2 text-sm font-bold uppercase shadow-brutal hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Pinned resources + adder */}
      {status.connected && (
        <div className="mt-4 border-t border-brand-black/10 pt-4">
          <p className="text-xs font-bold uppercase text-brand-black/50 mb-2">
            Saved resources
          </p>

          {resources.length === 0 && (
            <p className="text-xs font-mono text-brand-black/35 mb-2">
              No resources saved yet. Add pages or projects to use as quick-route targets.
            </p>
          )}

          <div className="flex flex-col gap-1 mb-1">
            {resources.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-3 py-2 border border-brand-black/15 bg-brand-black/2 group"
              >
                <span className="text-sm">{r.label}</span>
                <button
                  onClick={() => onRemoveResource(r.id)}
                  className="text-[10px] font-mono text-brand-black/30 hover:text-brand-accent opacity-0 group-hover:opacity-100 transition-opacity ml-3"
                >
                  remove
                </button>
              </div>
            ))}
          </div>

          <ResourceAdder
            slug={status.slug}
            pinnedIds={pinnedIds}
            onAdd={(resource_id, label) =>
              onAddResource(status.slug, resource_id, label)
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [intLoading, setIntLoading] = useState(false);
  const [intError, setIntError] = useState<string | null>(null);
  const [resources, setResources] = useState<PinnedResource[]>([]);

  const fetchIntegrations = useCallback(() => {
    integrationsApi
      .list()
      .then((r) => setIntegrations(r.data))
      .catch(() => setIntError("Failed to load integrations."));
  }, []);

  const fetchResources = useCallback(() => {
    integrationsApi
      .listResources()
      .then((r) => setResources(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchIntegrations();
    fetchResources();
  }, [fetchIntegrations, fetchResources]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "debrief_oauth_success") {
        fetchIntegrations();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [fetchIntegrations]);

  async function handleConnect(slug: IntegrationSlug) {
    setIntLoading(true);
    try {
      const res = await integrationsApi.connect(slug);
      window.open(res.data.auth_url, "debrief_oauth", "width=600,height=700");
    } catch {
      setIntError(`Failed to start ${INTEGRATION_META[slug].label} OAuth.`);
    } finally {
      setIntLoading(false);
    }
  }

  async function handleDisconnect(slug: IntegrationSlug) {
    setIntLoading(true);
    try {
      await integrationsApi.disconnect(slug);
      setIntegrations((prev) =>
        prev.map((i) =>
          i.slug === slug ? { ...i, connected: false, account_label: null } : i
        )
      );
    } catch {
      setIntError(`Failed to disconnect ${INTEGRATION_META[slug].label}.`);
    } finally {
      setIntLoading(false);
    }
  }

  async function handleAddResource(slug: IntegrationSlug, resource_id: string, label: string) {
    try {
      const res = await integrationsApi.addResource(slug, resource_id, label);
      setResources((prev) => [...prev, res.data]);
    } catch {
      setIntError(`Failed to add resource.`);
    }
  }

  function handleRemoveResource(doc_id: string) {
    setResources((prev) => prev.filter((r) => r.id !== doc_id));
    integrationsApi.removeResource(doc_id).catch(() => {
      setIntError("Failed to remove resource.");
      fetchResources();
    });
  }

  const allSlugs: IntegrationSlug[] = ["notion", "todoist"];
  const displayStatuses: IntegrationStatus[] = allSlugs.map(
    (slug) =>
      integrations.find((i) => i.slug === slug) ?? {
        slug,
        connected: false,
        account_label: null,
        default_resource_id: null,
      }
  );

  return (
    <div>
      <h1 className="text-4xl font-black uppercase mb-8">Settings</h1>

      {/* Integrations */}
      <section className="mb-6">
        <h2 className="font-bold uppercase mb-1">Integrations</h2>
        <p className="text-sm text-brand-black/60 mb-4">
          Connect apps for autonomous routing. Add saved resources to use as quick-route targets in the extension.
        </p>
        {intError && (
          <p className="text-sm text-brand-accent font-bold mb-3">{intError}</p>
        )}
        <div className="flex flex-col gap-4">
          {displayStatuses.map((status) => (
            <IntegrationCard
              key={status.slug}
              status={status}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              loading={intLoading}
              resources={resources.filter((r) => r.slug === status.slug)}
              onAddResource={handleAddResource}
              onRemoveResource={handleRemoveResource}
            />
          ))}
        </div>
      </section>

      {/* Subscription */}
      <section className="border-brutal border-brand-black p-6 shadow-brutal mb-6">
        <h2 className="font-bold uppercase mb-2">Subscription</h2>
        <p className="text-sm mb-4">Debrief — $7/month</p>
        <button className="border-2 border-brand-black px-6 py-2 font-bold uppercase hover:bg-brand-black hover:text-brand-white transition-colors">
          Manage Subscription
        </button>
      </section>

      {/* Danger Zone */}
      <section className="border-brutal border-brand-accent p-6 shadow-brutal">
        <h2 className="font-bold uppercase mb-2 text-brand-accent">Danger Zone</h2>
        <p className="text-sm mb-4">
          Permanently delete all your sessions, insights, and vocal baseline. This cannot be undone.
        </p>
        <button className="bg-brand-accent text-white px-6 py-2 font-bold uppercase shadow-brutal">
          Forget Me
        </button>
      </section>
    </div>
  );
}
