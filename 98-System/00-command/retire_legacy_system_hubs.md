<%*
// One-time reviewed cleanup; implementation refuses any legacy Hub whose content changed after audit.
await tp.user.retire_legacy_system_hubs(tp);
-%>
