// Completes the pending action (lib/pending-action.ts) once the visitor is
// signed in. Started once per page from ClerkIsland. Runs after an OAuth
// redirect (Clerk loads with a user) and after an in-place email sign-in
// (Clerk's listener fires).

import { collectionsApi } from './collections-api';
import { dropExpiredPendingAction, takePendingAction, type PendingAction } from './pending-action';
import { COLLECTIONS_CHANGED_EVENT, myComponentsUrl, saveComponent, whenSavesSettled, type CollectionsChangedDetail } from './save-component';
import { showToast } from './toast';

let started = false;
let running = false;

export function startPendingActionResume(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  dropExpiredPendingAction();

  const tryRun = () => {
    const clerk = (window as any).Clerk;
    if (running || !clerk?.loaded || !clerk.user) return;
    const action = takePendingAction();
    if (!action) return;
    running = true;
    run(clerk, action).finally(() => { running = false; });
  };

  const wait = setInterval(() => {
    const clerk = (window as any).Clerk;
    if (!clerk?.loaded) return;
    clearInterval(wait);
    tryRun();
    clerk.addListener?.(() => tryRun());
  }, 300);
}

async function run(clerk: any, action: PendingAction): Promise<void> {
  if (action.kind === 'open-link') return openLink(action);

  const item = { type: action.type, path: action.path, name: action.name, category: action.category };
  try {
    const token = await clerk.session?.getToken();
    if (!token) throw new Error('No session token');
    const { status, collection } = await saveComponent(collectionsApi, token, item);
    window.dispatchEvent(new CustomEvent<CollectionsChangedDetail>(COLLECTIONS_CHANGED_EVENT, {
      detail: { type: item.type, path: item.path, collectionId: collection.id },
    }));
    if (status === 'first') {
      await whenSavesSettled();
      window.location.assign(myComponentsUrl(collection.id));
      return;
    }
    showToast({
      message: status === 'already' ? `${action.name} is already in "${collection.name}".` : `Saved ${action.name} to "${collection.name}".`,
      action: { label: 'My components', href: myComponentsUrl(collection.id) },
    });
  } catch (err) {
    console.error('Failed to resume save after sign-in:', err);
    showToast({ message: `Couldn't save ${action.name}. Click Save again to retry.` });
  }
}

function openLink(action: Extract<PendingAction, { kind: 'open-link' }>): void {
  // Open a blank tab first so the external page never gets window.opener.
  // Browsers block this without a click (always after an OAuth redirect), so
  // the toast keeps a one-click button.
  let opened: Window | null = null;
  try {
    opened = window.open('', '_blank');
    if (opened) {
      opened.opener = null;
      opened.location.href = action.url;
    }
  } catch {
    opened = null;
  }
  if (opened) return;
  const what = action.source === 'job' ? 'job' : 'course';
  showToast({
    message: `You're signed in. ${action.title}`,
    action: { label: `Open ${what}`, href: action.url, external: true },
    duration: 0,
  });
}
