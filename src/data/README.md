# `world.json` — the offline country boundaries

`world.json` is generated, not hand-edited. To rebuild it:

```
node scripts/build-world-data.mjs
```

It is committed rather than fetched at build time so that a checkout builds
without network access, and so the exact bytes shipped to users are reviewable
in the same diff as the code that reads them.

## What uses it

[`src/lib/geo.ts`](../lib/geo.ts), to name the country a photo's GPS
coordinates fall in and to draw the locator map in the metadata panel. It is
loaded lazily, on the first geotagged photo somebody opens — a visitor who
never opens one never downloads it.

It exists at all because the alternative is a request. A reverse-geocode
lookup, or a single map tile, would send the photo's location to somebody
else's server, which is the exact disclosure the metadata panel is there to
warn about. See the header of `geo.ts`, and
[`PRIVACY.md`](../../PRIVACY.md).

## Where it comes from

Natural Earth's 1:50m admin-0 countries, as packaged by
[`world-atlas`](https://github.com/topojson/world-atlas) (a devDependency —
only the file generated from it ships).

Natural Earth is in the **public domain**; `world-atlas` is ISC-licensed. No
attribution is required in the app, and none is claimed here beyond saying
where the shapes came from.

## Two choices worth knowing about

**1:50m, not 1:110m.** The coarser set is a sixth of the size and would be
tempting, but it has no Monaco, no Malta and no Singapore — it answers
"France", "nothing" and "Malaysia" for them. A privacy tool that is
confidently wrong about which country somebody is in is worse than one that
prints coordinates and says nothing.

**Antarctica is dropped.** Its ring is a sizeable share of the file and it has
no residents to identify. A geotagged photo from there falls back to the world
view, like any other point that matches no country.

Both are pinned by `scripts/geo.test.mjs`, which records what regenerating from
1:110m breaks.
