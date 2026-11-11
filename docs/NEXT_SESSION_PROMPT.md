# Paste this into the next session

Continue the VATSIM AI project in `VinciiAtreus/VATSim-AI`. Read `docs/HANDOVER.md` first, then verify current repo, PR and environment state.

The immediate task is to replace the inaccurate schematic WMKK map with actual chart-based airport geometry, including terminals, satellite, gates/stands, taxiways, holding positions and connected aircraft routes. Reference: https://navigraph.com/airport/WMKK/Kuala-Lumpur-Intl---Sepang and official CAAM airport/ground/parking charts. Do not invent details or change only the drawing while leaving incorrect movement paths.

I already added the requested domains to the environment settings. Check whether the newly selected environment has applied those settings before asking me again. The previous running instance still had an empty custom allowlist and returned a proxy CONNECT 403. No charts had actually been retrieved.

The project stays desktop-browser-only and hosted on its existing Vercel integration. Voice works for me in Edge; Vivaldi troubleshooting is finished. PR #4 was last open as a draft on `codex/consolidated-browser-release`, with latest application commit `f52408486eea4e735ce28a03f3613788de6b700a`; check if that has changed. Preserve all consolidated release features and existing records. Work autonomously toward a complete reviewable map/routing update, test it, and provide a preview/PR. Do not merge until I ask. Keep chart provenance and distinguish implemented geometry from professional/CAAM validation.
