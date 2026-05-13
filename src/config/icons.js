// Central icon catalog. Names follow the Iconify `set:name` convention.
// Vendor logos use the `logos` set; conceptual icons use Material Design (`mdi`).

export const ICONS = {
  // Pipeline node concepts
  producer: 'mdi:application-export',
  consumer: 'mdi:application-import',
  sourceDb: 'mdi:database-edit-outline',
  db: 'mdi:database-outline',
  dlq: 'mdi:skull-outline',
  inbox: 'mdi:inbox-arrow-down-outline',
  relayPolling: 'mdi:database-sync-outline',
  relayCdc: 'mdi:lightning-bolt-outline',

  // Scenarios (filled variants — render bolder at small sizes in the sidebar)
  atMostOnce: 'mdi:rocket-launch',
  atLeastOnce: 'mdi:repeat',
  exactlyOnce: 'mdi:shield-check',
  scenarioDlq: 'mdi:skull',
  scenarioOutbox: 'mdi:package-variant-closed',
  scenarioInbox: 'mdi:inbox-arrow-down',

  // Patterns / states
  idempotency: 'mdi:shield-check-outline',
  message: 'mdi:email-outline',
  poison: 'mdi:skull-crossbones-outline',
  retry: 'mdi:reload',
  duplicate: 'mdi:content-copy',
  ack: 'mdi:check',
  lost: 'mdi:cloud-off-outline',
  query: 'mdi:magnify',

  // UI affordances
  log: 'mdi:format-list-bulleted-square',
  github: 'mdi:github',
  reset: 'mdi:refresh',
  chaos: 'mdi:weather-tornado',
  stress: 'mdi:lightning-bolt',
  network: 'mdi:wifi-strength-alert-outline',
  ackFail: 'mdi:email-alert-outline',
  crash: 'mdi:alert-circle-outline',
  consumerDown: 'mdi:power-plug-off-outline',
  consumerOverload: 'mdi:gauge-full',
  dbCommitFail: 'mdi:database-alert-outline',
  txAbort: 'mdi:bomb-outline',
}
