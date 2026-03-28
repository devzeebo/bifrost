'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@base-ui/react/button';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Input } from '@base-ui/react/input';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { navigate } from '@/lib/router';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { api } from '../../lib/api';
import type { RealmListEntry, RealmStatus } from '../../types/realm';

export { Page };

function Page() {
  const [realms, setRealms] = useState<RealmListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showSuspended, setShowSuspended] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRealmName, setNewRealmName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { isAuthenticated, realms: sessionRealmIds, realmNames, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const toFallbackRealms = useCallback((): RealmListEntry[] => {
    const visibleRealmIds = sessionRealmIds.filter((realmId) => realmId !== '_admin');

    return visibleRealmIds.map((realmId) => ({
      id: realmId,
      name: realmNames[realmId] ?? realmId,
      status: 'active',
      created_at: new Date(0).toISOString(),
    }));
  }, [realmNames, sessionRealmIds]);

  const normalizeRealms = useCallback(
    (rawData: unknown): RealmListEntry[] => {
      if (!Array.isArray(rawData)) {
        return [];
      }

      return rawData
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }

          const rawEntry = entry as {
            id?: string;
            realm_id?: string;
            name?: string;
            status?: string;
            created_at?: string;
          };

          const id = rawEntry.id ?? rawEntry.realm_id;
          if (!id) {
            return null;
          }

          const status: RealmStatus = rawEntry.status === 'suspended' ? 'inactive' : 'active';

          return {
            id,
            name: rawEntry.name ?? realmNames[id] ?? id,
            status,
            created_at: rawEntry.created_at ?? new Date(0).toISOString(),
          };
        })
        .filter((entry): entry is RealmListEntry => entry !== null);
    },
    [realmNames]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchRealms = async () => {
      try {
        const data = await api.getRealms(true);
        const normalized = normalizeRealms(data);
        setRealms(normalized.length > 0 ? normalized : toFallbackRealms());
      } catch {
        const fallbackRealms = toFallbackRealms();
        setRealms(fallbackRealms);
        if (fallbackRealms.length === 0) {
          showToast('Error', 'Failed to load realms', 'error');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchRealms();
  }, [authLoading, isAuthenticated, normalizeRealms, showToast, toFallbackRealms]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: RealmStatus) => {
    const colors: Record<RealmStatus, string> = {
      active: 'var(--color-green)',
      inactive: 'var(--color-border)',
    };
    return colors[status];
  };

  const filteredRealms = realms.filter((realm) => {
    // Hide suspended realms unless explicitly shown
    if (!showSuspended && realm.status === 'inactive') {
      return false;
    }

    // Apply status filter
    if (statusFilter === 'all') {
      return true;
    }
    return statusFilter === 'active' ? realm.status === 'active' : realm.status !== 'active';
  });

  const handleCreateRealm = async () => {
    const realmName = newRealmName.trim();
    if (!realmName || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const created = await api.createRealm({ name: realmName });
      setIsCreateDialogOpen(false);
      setNewRealmName('');
      showToast('Success', `Realm ${realmName} created`, 'success');
      navigate(`/realms/${created.id}`);
    } catch {
      showToast('Error', 'Failed to create realm', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div
          className="px-8 py-4 text-lg font-bold uppercase tracking-wider"
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '2px solid var(--color-border)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  if (realms.length === 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-6">
        <div
          className="p-8 text-center max-w-md"
          style={{
            backgroundColor: 'var(--color-bg)',
            border: '2px solid var(--color-border)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight">No Realms Found</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            You don't have access to any realms yet. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      <div className="flex justify-between items-center mb-6">
        <ToggleGroup
          value={[statusFilter]}
          onValueChange={(values) => {
            const nextFilter = values[0];
            if (nextFilter === 'all' || nextFilter === 'active' || nextFilter === 'inactive') {
              setStatusFilter(nextFilter);
            }
          }}
          className="flex flex-wrap gap-2"
        >
          {[
            { label: 'All', value: 'all' as const },
            { label: 'Active', value: 'active' as const },
            { label: 'Inactive', value: 'inactive' as const },
          ].map((filter) => (
            <Toggle
              key={filter.value}
              value={filter.value}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150"
              style={{
                backgroundColor:
                  statusFilter === filter.value ? 'var(--color-green)' : 'var(--color-bg)',
                border: '2px solid var(--color-border)',
                color: statusFilter === filter.value ? 'white' : 'var(--color-text)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              {filter.label}
            </Toggle>
          ))}
        </ToggleGroup>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer">
            <Toggle
              pressed={showSuspended}
              onPressedChange={setShowSuspended}
              className="w-4 h-4"
              style={{
                backgroundColor: showSuspended ? 'var(--color-green)' : 'var(--color-bg)',
                border: '2px solid var(--color-border)',
              }}
            />
            Show Suspended Realms
          </label>

          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150"
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '2px solid var(--color-border)',
              color: 'var(--color-text)',
              boxShadow: 'var(--shadow-soft)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-green)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = 'var(--shadow-soft-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg)';
              e.currentTarget.style.color = 'var(--color-text)';
              e.currentTarget.style.boxShadow = 'var(--shadow-soft)';
            }}
          >
            +
          </Button>
        </div>
      </div>

      <BaseDialog.Root open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <BaseDialog.Popup
              className="w-full max-w-md p-6"
              style={{
                backgroundColor: 'var(--color-bg)',
                border: '2px solid var(--color-border)',
                boxShadow: 'var(--shadow-soft)',
              }}
              aria-labelledby="create-realm-title"
              aria-describedby="create-realm-description"
            >
              <div className="space-y-4">
                <div>
                  <BaseDialog.Title
                    id="create-realm-title"
                    className="text-xl font-bold uppercase tracking-wide"
                  >
                    Create Realm
                  </BaseDialog.Title>
                  <BaseDialog.Description
                    id="create-realm-description"
                    className="mt-2 text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Enter a realm name to create a new realm.
                  </BaseDialog.Description>
                </div>

                <div>
                  <label
                    htmlFor="new-realm-name"
                    className="text-xs uppercase tracking-wider block mb-2 font-bold"
                  >
                    Realm Name
                  </label>
                  <Input
                    id="new-realm-name"
                    value={newRealmName}
                    onChange={(e) => setNewRealmName(e.target.value)}
                    placeholder="Engineering"
                    className="w-full px-3 py-2 text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '2px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <BaseDialog.Close
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      border: '2px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    Cancel
                  </BaseDialog.Close>
                  <Button
                    type="button"
                    onClick={handleCreateRealm}
                    disabled={newRealmName.trim().length === 0 || isCreating}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: 'var(--color-green)',
                      border: '2px solid var(--color-border)',
                      color: 'white',
                    }}
                  >
                    {isCreating ? 'Creating...' : 'Create Realm'}
                  </Button>
                </div>
              </div>
            </BaseDialog.Popup>
          </BaseDialog.Viewport>
        </BaseDialog.Portal>
      </BaseDialog.Root>

      {/* Realms Table */}
      <div
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '2px solid var(--color-border)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        {/* Table Header */}
        <div
          className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider"
          style={{
            borderBottom: '2px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <div className="col-span-2">ID</div>
          <div className="col-span-6">Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Created</div>
        </div>

        {/* Table Body */}
        {filteredRealms.length === 0 ? (
          <div
            className="px-4 py-12 text-center text-sm uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            No realms match this filter.
          </div>
        ) : (
          <div>
            {filteredRealms.map((realm) => (
              <button
                type="button"
                key={realm.id}
                className="grid grid-cols-12 gap-4 px-4 py-4 items-center cursor-pointer transition-all duration-150 hover:translate-x-[2px]"
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)',
                  width: '100%',
                  textAlign: 'left',
                }}
                onClick={() => navigate(`/realms/${realm.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                  e.currentTarget.style.borderLeftWidth = '4px';
                  e.currentTarget.style.borderLeftColor = 'var(--color-green)';
                  e.currentTarget.style.borderLeftStyle = 'solid';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg)';
                  e.currentTarget.style.borderLeftWidth = '0px';
                }}
              >
                <div className="col-span-2">
                  <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {realm.id.slice(0, 8)}
                  </span>
                </div>
                <div className="col-span-6">
                  <span className="font-medium truncate block">{realm.name}</span>
                </div>
                <div className="col-span-2">
                  <span
                    className="text-xs uppercase tracking-wider px-2 py-1 font-semibold"
                    style={{
                      color: getStatusColor(realm.status),
                      border: `1px solid ${getStatusColor(realm.status)}`,
                    }}
                  >
                    {realm.status}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {formatDate(realm.created_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
