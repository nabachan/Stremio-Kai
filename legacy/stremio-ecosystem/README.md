# Legacy Stremio ecosystem configs

These files configured **remote Stremio addons** (AIOStreams, Cinemeta share packs, Debrid templates).

They are archived here as part of **Phase 1** decoupling:

- No Stremio account login required for the new media engine
- No remote addon install list loaded by default
- Stream resolution moves to `media-provider/` (`MediaProviderManager`)

Do **not** re-import these into a production Kai standalone build unless you intentionally re-enable the Stremio addon pipeline.
