import type { SavedSearch, ScrapedListing } from '../../../shared/property.ts';

export type JobKind = 'collect' | 'validate';
export type CommandKind = JobKind | 'worker';
export type JobState = 'succeeded' | 'partial' | 'failed';
export type EmailState = 'not_needed' | 'sent' | 'failed';

export type JobResult = {
  job_id: string | null;
  state: JobState | 'idle' | 'busy';
  summary: string;
};

export type CrawlJob = {
  job_id: string;
  token: number;
  kind: JobKind;
  searches: SavedSearch[];
};

export interface Store {
  activeJobId?(): Promise<string | null>;
  schedule?(): Promise<{ outcome: string; scheduled_at?: string }>;
  claim(kind: CommandKind): Promise<CrawlJob | null>;
  renew(run: CrawlJob): Promise<unknown>;
  save(
    run: CrawlJob,
    items: ScrapedListing[],
    profile: string | null,
  ): Promise<ScrapedListing[]>;
  source(
    run: CrawlJob,
    value: {
      source: string;
      search_id: string | null;
      count: number;
      outcome: string;
      error_category: string | null;
    },
  ): Promise<unknown>;
  finish(
    run: CrawlJob,
    state: JobState,
    email: EmailState,
    error?: string,
  ): Promise<unknown>;
  listings(): Promise<ScrapedListing[]>;
  heartbeat(): Promise<unknown>;
}

export interface Provider {
  collect(): Promise<
    { properties: ScrapedListing[]; outcome: string; error: string | null }
  >;
  verify(url: string): Promise<{ last_check_result: string }>;
}

export type Dependencies = {
  schedule?: Store['schedule'];
  sleep?: (ms: number) => Promise<void>;
  store: Store;
  providers: (
    id: string,
    params: SavedSearch['params'],
    signal?: AbortSignal,
  ) => Provider;
  sendEmail: (
    items: ScrapedListing[],
  ) => Promise<{ success: boolean; error?: string }>;
};
