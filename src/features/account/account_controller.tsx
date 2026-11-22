import { useMemo, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '../../app/settings_context';
import { resolvedBaseUrl } from '../../core/settings';
import type { Account } from '../../domain/models/account';
import * as store from '../../data/local/account_store';
import * as api from '../../data/han1me_repository';
import { queryClient } from '../../data/han1me_repository';
import { remoteLibrary } from '../../data/local/library_repository';

interface AccountState {
  ready?: boolean;
  account?: Account;
  accounts: Account[];
  saveCookie(cookie: string): Promise<void>;
  activate(account: Account): Promise<void>;
  remove(account: Account): Promise<void>;
  refresh(): Promise<void>;
  logout(): Promise<void>;
}
export const AccountContext = createContext<AccountState>({
  accounts: [],
  saveCookie: async () => {},
  activate: async () => {},
  remove: async () => {},
  refresh: async () => {},
  logout: async () => {},
});
export const useAccount = () => useContext(AccountContext);
const withoutClearance = (value: string) =>
  value
    .split(';')
    .filter((part) => part.trim().split('=')[0].toLowerCase() !== 'cf_clearance')
    .join(';')
    .trim();
export function AccountProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [loadedBase, setLoadedBase] = useState('');
  const [account, setAccount] = useState<Account>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const base = useMemo(() => resolvedBaseUrl(settings), [settings]);
  useEffect(() => {
    let active = true;
    async function load() {
      api.clearRequests();
      const saved = await store.readAccount(base);
      if (!active) {
        return;
      }
      setAccounts(await store.readAllAccounts(base));
      if (saved?.cookie) {
        const clean = { ...saved, cookie: withoutClearance(saved.cookie) };
        await window.electron.session.importCookies(base, clean.cookie);
        if (clean.cookie !== saved.cookie) {
          await store.writeAccount(base, clean);
        }
        if (!active) {
          return;
        }
        setAccount(clean);
        setLoadedBase(base);
        try {
          const profile = {
            ...(await queryClient.fetchQuery(api.account(base))),
            cookie: clean.cookie,
          };
          if (!active) {
            return;
          }
          setAccount(profile);
          await store.writeAccount(base, { ...profile, id: profile.id! });
          if (profile.id) {
            await queryClient.fetchQuery(remoteLibrary(base, profile.id));
          }
        } catch {}
        if (active) {
          setAccounts(await store.readAllAccounts(base));
        }
      } else {
        setAccount(undefined);
        setLoadedBase(base);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [base]);

  async function refreshAccounts() {
    setAccounts(await store.readAllAccounts(base));
  }

  async function saveCookie(cookie: string) {
    api.clearRequests();
    await window.electron.session.importCookies(base, cookie);
    const profile = {
      ...(await queryClient.fetchQuery(api.account(base))),
      cookie: withoutClearance(cookie),
    };
    setAccount(profile);
    await store.writeAccount(base, { ...profile, id: profile.id! });
    await refreshAccounts();
  }

  async function activate(value: Account) {
    if (!value.id) {
      return;
    }
    api.clearRequests();
    await window.electron.session.clearCookies(base);
    await window.electron.session.importCookies(base, value.cookie);
    await store.activateAccount(base, value.id);
    setAccount(value);
    await refreshAccounts();
  }

  async function remove(value: Account) {
    if (!value.id) {
      return;
    }
    await store.removeAccount(base, value.id);
    if (account?.id === value.id) {
      api.clearRequests();
      await window.electron.session.clearCookies(base);
      setAccount(undefined);
    }
    await refreshAccounts();
  }

  async function refresh() {
    if (!account) {
      return;
    }
    try {
      api.clearRequests();
      const next = { ...(await queryClient.fetchQuery(api.account(base))), cookie: account.cookie };
      setAccount(next);
      await store.writeAccount(base, { ...next, id: next.id! });
      try {
        if (next.id) {
          await queryClient.fetchQuery(remoteLibrary(base, next.id));
        }
      } catch {}
      await refreshAccounts();
    } catch {}
  }

  async function logout() {
    api.clearRequests();
    if (account) {
      await remove(account);
    } else {
      await window.electron.session.clearCookies(base);
    }
  }

  return (
    <AccountContext
      value={{
        ready: loadedBase === base,
        account,
        accounts,
        saveCookie,
        activate,
        remove,
        refresh,
        logout,
      }}
    >
      {children}
    </AccountContext>
  );
}
