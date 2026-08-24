# Shadow Garden — Site Voice

Shadow Garden should sound like one place from the public shelves to Garden Keeper: a quiet moonlit library cultivated as a living garden.

## Core voice

- **Atmospheric, not theatrical.** Use garden, shadow, moonlight, paths, shelves, roots, gates, seeds, and growth as recurring imagery.
- **Clear before clever.** Buttons, security failures, destructive actions, limits, and recovery instructions must remain immediately understandable.
- **Restrained.** One strong image is better than several metaphors in the same sentence.
- **Calm.** The site should feel private, curated, and deliberate rather than spooky or melodramatic.

## Areas

- **Main Library — The Moonlit Garden:** shelves, paths, moonlight, cultivation, new growth.
- **Adult Library — The Forbidden Sanctuary / Night Garden:** secluded or restricted wing, gates, night, mature works. Never euphemize the legal-age warning.
- **Reader:** pages, reading trails, paths, bookmarks pressed between pages, completed volumes resting at the end of a path.
- **Garden Keeper:** tending shelves, planting volumes, roots/health, private vault, Keeper's gate/key, catalog snapshots as stepping stones back.
- **Security:** Garden Pass, gate, Keeper's gate. Keep technical facts such as cooldowns, Turnstile behavior, raw-IP handling, and irreversible actions explicit.

## Destructive actions

Theme may frame the action, but the consequence must be literal:

- Moving a series/volume to **Trash** says that it is recoverable and files remain in private storage.
- **Purge** says which stored files may be deleted and always includes **This cannot be undone.**
- Backup deletion says only the selected snapshot is removed.
- Read Again says progress resets to page 1, Finished is removed, and bookmarks are preserved.

## Implementation

`src/assets/js/site-flavor.js` is the shared copy layer for existing static and dynamically generated UI. It also refines known native confirmation/alert messages without altering application behavior. Major bespoke dialogs should still carry their final wording directly in their source.
