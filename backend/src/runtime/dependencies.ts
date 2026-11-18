import type { Dependencies } from '../property/ports.ts';
import { propertyStore } from '../property/persistence/supabase-property-store.ts';
import { sendNewPropertiesEmail } from '../property/notifications/send-property-email.ts';
import { createProvider } from '../property/providers/registry.ts';

export function createDependencies(
  config: { scheduleEnabled: boolean },
): Dependencies {
  const store = propertyStore();
  return {
    store,
    schedule: config.scheduleEnabled ? store.schedule : undefined,
    sendEmail: sendNewPropertiesEmail,
    providers: createProvider,
  };
}
