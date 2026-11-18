import type { Profile, Property } from '../../../shared/property.ts';

export type RunKind = 'collect' | 'validate';
export type CommandKind = RunKind | 'worker';
export type RunState = 'succeeded' | 'partial' | 'failed';
export type EmailState = 'not_needed' | 'sent' | 'failed';

export type RunResult = {
  run_id: string | null;
  state: RunState | 'idle' | 'busy';
  summary: string;
};

export type Run = {
  run_id: string;
  token: number;
  kind: RunKind;
  profiles: Profile[];
};

export interface Store {
  activeRunId?(): Promise<string | null>;
  schedule?(): Promise<{ outcome: string; scheduled_at?: string }>;
  claim(kind: CommandKind): Promise<Run | null>;
  renew(run: Run): Promise<unknown>;
  save(
    run: Run,
    items: Property[],
    profile: string | null,
  ): Promise<Property[]>;
  source(
    run: Run,
    value: {
      source: string;
      profile_id: string | null;
      count: number;
      outcome: string;
      error_category: string | null;
    },
  ): Promise<unknown>;
  finish(run: Run, state: RunState, email: EmailState): Promise<unknown>;
  listings(): Promise<Property[]>;
  heartbeat(): Promise<unknown>;
}

export interface Provider {
  collect(): Promise<
    { properties: Property[]; outcome: string; error: string | null }
  >;
  verify(url: string): Promise<{ verification: string }>;
}

export type Dependencies = {
  schedule?: Store['schedule'];
  sleep?: (ms: number) => Promise<void>;
  store: Store;
  providers: (
    id: string,
    params: Profile['params'],
    signal?: AbortSignal,
  ) => Provider;
  sendEmail: (
    items: Property[],
  ) => Promise<{ success: boolean; error?: string }>;
};
