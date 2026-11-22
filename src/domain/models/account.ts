export interface Account {
  cookie: string;
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  csrfToken?: string;
  joinedLabel?: string;
  subscriberCount?: number;
  videoCount?: number;
}
