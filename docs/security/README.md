# Shadow Garden Security Records

> **Status:** Historical compatibility records  
> **Canonical completed roadmap:** [`../archive/SECURITY_ROADMAP.md`](../archive/SECURITY_ROADMAP.md)  
> **Current audit:** [`../audits/POST_V2_10_AUDIT.md`](../audits/POST_V2_10_AUDIT.md)

Security & Anti-Abuse Milestones 1–9 are complete. Files in this directory preserve completed milestone records and older links; they are not active roadmap tasks.

Canonical archived copies of the milestone records are indexed under [`../archive/README.md`](../archive/README.md).

Current engineering may audit these security boundaries for clarity, maintainability, and regression coverage, but it must preserve the accepted invariants unless a separately reviewed security correction is required:

- private Backblaze B2 storage;
- signed EPUB/media authorization and protected Range delivery;
- opaque public book/cover identities;
- Turnstile/Garden Pass and signed Keeper sessions;
- server-side cooldowns and abuse controls;
- crawler/indexing policy;
- public catalog redaction;
- recovery and last-recoverable-state protections.

A post-v2.10 audit finding does not reopen the completed security roadmap. Any proposed security-sensitive refactor must demonstrate a correctness or maintainability benefit and pass the permanent service plus real-browser regression gates.
