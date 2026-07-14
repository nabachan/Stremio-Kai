// Kai — bootstrap sole local MediaProvider addon (stremio-web Phase 1 restart)

const React = require('react');
const { useCore } = require('stremio/core');
const {
    KAI_BOOTSTRAP_FLAG,
    KAI_FEATURES,
    KAI_MEDIA_PROVIDER_MANIFEST_URL,
} = require('./config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KaiBootstrap = () => {
    const core = useCore();
    const ran = React.useRef(false);

    React.useEffect(() => {
        if (!KAI_FEATURES.soleLocalAddon || ran.current) return;
        ran.current = true;

        let cancelled = false;

        (async () => {
            try {
                const res = await fetch(KAI_MEDIA_PROVIDER_MANIFEST_URL, {
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) {
                    throw new Error(`MediaProvider HTTP ${res.status} — start media-provider on :8765`);
                }
                const manifest = await res.json();
                if (cancelled) return;

                const kaiDescriptor = {
                    transportUrl: KAI_MEDIA_PROVIDER_MANIFEST_URL,
                    transportName: 'http',
                    manifest,
                    flags: {
                        official: false,
                        protected: true,
                    },
                };

                core.transport.dispatch({
                    action: 'Ctx',
                    args: {
                        action: 'InstallAddon',
                        args: kaiDescriptor,
                    },
                });

                core.transport.dispatch({
                    action: 'Load',
                    args: {
                        model: 'InstalledAddonsWithFilters',
                        args: {
                            request: { type: null },
                        },
                    },
                });

                await sleep(600);
                if (cancelled) return;

                const installed = await core.transport.getState('installed_addons');
                const catalog = installed?.catalog || [];

                for (const addon of catalog) {
                    const url = addon?.transportUrl || addon?.transport_url;
                    if (!url || url === KAI_MEDIA_PROVIDER_MANIFEST_URL) continue;
                    core.transport.dispatch({
                        action: 'Ctx',
                        args: {
                            action: 'UninstallAddon',
                            args: {
                                transportUrl: url,
                                transportName: 'http',
                                manifest: addon.manifest,
                                flags: { official: false, protected: false },
                            },
                        },
                    });
                }

                try {
                    localStorage.setItem(KAI_BOOTSTRAP_FLAG, new Date().toISOString());
                } catch {
                    /* ignore */
                }

                console.log(
                    '%c[Kai] MediaProvider bootstrapped — sole addon active',
                    'color: #ff4d2e; font-weight: bold',
                    KAI_MEDIA_PROVIDER_MANIFEST_URL,
                );
            } catch (err) {
                console.error('[Kai] bootstrap failed:', err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [core]);

    return null;
};

module.exports = KaiBootstrap;
