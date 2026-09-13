import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';

/**
 * The studio is a single screen driven by signals rather than routes, so there is
 * no router here. Generated projects do get `provideRouter` — see the generator.
 */
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideZonelessChangeDetection()],
};
