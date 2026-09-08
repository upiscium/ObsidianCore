# Core Promotion E2E Probe

This temporary file exists only to verify the production Core → Live Vault promotion path.

Expected lifecycle:

1. merge this PR into `ObsidianCore/main`;
2. run the promotion service manually;
3. verify this exact file appears in the Nextcloud Live Vault;
4. allow the normal snapshot/publication loop to converge;
5. remove this probe in a follow-up PR.
