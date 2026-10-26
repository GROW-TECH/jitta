# Complete Prompt to Fine-Tune Rapido-like Location Behavior (v2)

Copy and paste this entire prompt to your AI coding agent (Cursor, Claude, GitHub Copilot Agent, Aider, OpenCode, etc.) to apply the final tweaks.

```text
You are an expert React + TypeScript + Google Maps Places/Geocoding engineer.

CONTEXT: The user already tried fixing RapidoLocationSearch.tsx earlier. The current code has:
- radius changed to 10000m
- types: ['geocode','establishment']
- distance sorting after enrichment
- improved GPS reverse-geocode name using address_components

But it still doesn't feel "exact like Rapido". Fix the remaining gaps with minimal, targeted changes.

TASK: Apply minimal tweaks so:
1) Pickup/search feels more "near me" like Rapido (push nearest results to top)
2) Current location name feels cleaner/closer to Rapido
3) Don't break existing UI/logic

FILE TO EDIT: redtaxi/src/components/common/RapidoLocationSearch.tsx

DO NOT EDIT OTHER FILES.

CHANGES REQUIRED:

## A) TIGHTEN AUTOCOMPLETE BIAS (handleQueryChange)

In handleQueryChange(), when building request (around lines ~62–72):
- Change radius from 10000 to 6000
- Add request.strictBounds = true
- Keep location, input, componentRestrictions, types as-is

Reason: 6km with strictBounds makes it strongly "near me". Rapido feels tighter than 10km.

```ts
const request: any = {
  input: text,
  componentRestrictions: { country: 'in' },
  types: ['geocode', 'establishment'],
};

if (currentLocation?.lat && currentLocation?.lng) {
  request.location = new g.LatLng(currentLocation.lat, currentLocation.lng);
  request.radius = 6000; // tighter, closer to Rapido
  request.strictBounds = true; // constrain to near user
}
```

## B) ENRICH MORE SUGGESTIONS (enrichSuggestionsWithDetails)

Currently enriches only top 6. Enrich top 8 so distance-sort can surface the truly closest.

In enrichSuggestionsWithDetails(), around line ~122:
- Change items.slice(0,6) to items.slice(0,8)

```ts
const promises = items.slice(0, 8).map((item) => {
```

Reason: Google returns ~5–10 predictions. Nearest might be at #7–#8. Sorting only 6 misses it.

## C) (OPTIONAL BUT RECOMMENDED) CLEANER GPS NAME (handleUseCurrentLocation)

After building mainTitle from address_components (around ~250–259), avoid showing very broad "just locality" as the name. Rapido often shows "Your current location" in that case.

After computing:
```ts
const prem=get('premise'), subp=get('subpremise'), sn=get('street_number'), rt=get('route'), neigh=get('neighborhood'), subl=get('sublocality')||get('sublocality_level_1'), loc=get('locality');
...
let mainTitle = parts.length ? parts.join(', ') : (best.formatted_address||'').split(',')[0]||'Current Location';
const onlyLocality = parts.length === 1 && loc && parts[0] === loc && !subl && !neigh && !rt && !prem && !subp && !sn;
if (onlyLocality) mainTitle = 'Your current location';
```

Use mainTitle in onSelectLocation. Keep full best.formatted_address as address.

## VERIFICATION

After changes:
- Typing "mullai" near Salem: nearest Mullai entries should move higher
- "Use Current Location": on street-level GPS gives road/premise-like name; if very broad (just town/locality) shows "Your current location"
- Distances still shown
- No TypeScript errors
- UI unchanged

CONSTRAINTS: Minimal edits only. Don't refactor. Don't change types unless necessary.
```