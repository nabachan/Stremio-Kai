/**
 * Kai config — standalone anime desktop fork of Stremio/stremio-web.
 */
const KAI_MEDIA_PROVIDER_MANIFEST_URL =
    (typeof localStorage !== 'undefined' && localStorage.getItem('kai-media-provider-manifest')) ||
    'http://127.0.0.1:8765/manifest.json';

const KAI_BOOTSTRAP_FLAG = 'kai-media-provider-bootstrapped-v1';

const KAI_FEATURES = {
    skipIntro: true,
    disableCloudSync: true,
    disableAddonsUi: true,
    soleLocalAddon: true,
};

module.exports = {
    KAI_MEDIA_PROVIDER_MANIFEST_URL,
    KAI_BOOTSTRAP_FLAG,
    KAI_FEATURES,
};
