import type { Account } from '../../domain/models/account';
import { readJsonStore, updateJsonStore } from './json_store';

type SavedAccount = Account & { id: string };
interface HostAccounts {
  accounts: SavedAccount[];
  activeId?: string;
}
type AccountStore = Record<string, HostAccounts>;

function accountsFromJson(value: SavedAccount[] = []): SavedAccount[] {
  try {
    return value
      .map((account) => ({ ...account, cookie: account.cookie ?? '' }))
      .filter((account) => account.id != null && account.cookie.length > 0);
  } catch {
    return [];
  }
}

export async function readAllAccounts(baseUrl: string): Promise<SavedAccount[]> {
  const store = await readJsonStore<AccountStore>('accounts.json');
  return accountsFromJson(store[new URL(baseUrl).hostname]?.accounts);
}

export async function readAccount(baseUrl: string): Promise<SavedAccount | undefined> {
  const store = await readJsonStore<AccountStore>('accounts.json');
  const saved = store[new URL(baseUrl).hostname];
  const accounts = accountsFromJson(saved?.accounts);
  if (!accounts.length) {
    return undefined;
  }
  if (saved?.activeId === undefined) {
    await activateAccount(baseUrl, accounts[0].id);
    return accounts[0];
  }
  return accounts.find((account) => account.id === saved.activeId);
}

export function writeAccount(baseUrl: string, account: SavedAccount): Promise<void> {
  const host = new URL(baseUrl).hostname;
  return updateJsonStore<AccountStore>('accounts.json', (store) => ({
    ...store,
    [host]: {
      accounts: [
        account,
        ...accountsFromJson(store[host]?.accounts).filter((item) => item.id !== account.id),
      ],
      activeId: account.id,
    },
  }));
}

export function activateAccount(baseUrl: string, accountId: string): Promise<void> {
  const host = new URL(baseUrl).hostname;
  return updateJsonStore<AccountStore>('accounts.json', (store) => ({
    ...store,
    [host]: { accounts: store[host]?.accounts ?? [], activeId: accountId },
  }));
}

export function removeAccount(baseUrl: string, accountId: string): Promise<void> {
  const host = new URL(baseUrl).hostname;
  return updateJsonStore<AccountStore>('accounts.json', (store) => ({
    ...store,
    [host]: {
      accounts: accountsFromJson(store[host]?.accounts).filter(
        (account) => account.id !== accountId,
      ),
      activeId: store[host]?.activeId === accountId ? undefined : store[host]?.activeId,
    },
  }));
}
