# Complete Prompt to Fix Rapido-like Location Behavior

Copy and paste this entire prompt to your AI coding agent (Cursor, Claude, GitHub Copilot Agent, Aider, OpenCode, etc.) to apply the fixes to your codebase.

```text
You are an expert React + TypeScript + Google Maps Places/Geocoding engineer.

TASK: Fix two location UX issues in the "RapidoLocationSearch" component so it behaves closer to Rapido.

CODEBASE: C:\Users\Admin\Downloads\jitadriverslatest (Rapido-like taxi app)
PRIMARY FILE: redtaxi/src/components/common/RapidoLocationSearch.tsx
RELATED: redtaxi/src/utils/googleMapsLoader.ts (read-only reference)

ISSUES TO FIX:

1) "Use Current Location" shows imprecise name
   - Currently takes results[0] from geocoder and does formatted.split(',')[0]
   - Need to pick the MOST PRECISE address_components (street_address > premise > subpremise > route > neighborhood > sublocality* > locality)
   - Build a concise human name (door/street + area) not just first comma token
   - Keep full formatted_address as address field

2) Search results not "exact like Rapido" (feels less local)
   - Autocomplete uses location bias radius 50000m (50km) – too broad
   - Suggestions keep Google's relevance order even though distances are computed
   - Need tighter "near me" bias + distance-aware ordering

REQUIREMENTS (DO NOT BREAK EXISTING LOGIC):

- Keep using Google Places AutocompleteService + PlacesService + Geocoder (libraries already loaded: places, geometry)
- Keep enableHighAccuracy: true, timeout: 15000, maximumAge: 0 for getCurrentPosition
- Keep country restriction { country: 'in' }
- Keep existing UI (classes, icons, structure) - minimal visual changes
- Keep distanceKm display as-is
- Keep favorites logic unchanged
- Handle cases where lat/lng missing gracefully
- TypeScript safe, no new deps

CHANGES REQUIRED:

A) handleUseCurrentLocation() - Better GPS label (around ~190-216)
   - After geocode OK, scan results to find best by type priority:
     ['street_address','premise','subpremise','route','neighborhood','sublocality_level_3','sublocality_level_2','sublocality_level_1','sublocality','locality']
   - If any result is street_address or route, prefer it
   - Extract address_components: street_number, route, premise, subpremise, neighborhood, sublocality, locality
   - Build mainTitle: combine in sensible order (premise, subpremise, streetNum+route OR route OR neigh OR subloc OR loc)
   - If empty, fallback to formatted.split(',')[0] || 'Current Location'
   - Use this mainTitle + full formatted as address

B) handleQueryChange() - Tighter bias (around ~50-107)
   - request.radius: change from 50000 to 10000 (10km)
   - Add types: ['geocode','establishment'] to request
   - Keep location + componentRestrictions as is
   - Optionally add request.strictBounds = true if you want stricter, but don't break if Google omits results (test logic fine either way)

C) enrichSuggestionsWithDetails() - Sort by distance (around ~110-157)
   - After Promise.all(enriched) resolves, sort enriched array by distance ascending
   - Parse distanceKm string to number (e.g. "4.2 km" -> 4.2). Treat missing/NaN as 999
   - Keep original relative order only if equal? not needed
   - Call setSuggestions(sorted)

IMPLEMENTATION DETAILS:

For GPS naming:
```ts
const typePriority = ['street_address','premise','subpremise','route','neighborhood','sublocality_level_3','sublocality_level_2','sublocality_level_1','sublocality','locality'];
let best = results[0];
for (const r of results) {
  const t = r.types||[];
  if (typePriority.some(x=>t.includes(x))) { best=r; break; }
}
const streetAddr = results.find(r=>(r.types||[]).includes('street_address')) || results.find(r=>(r.types||[]).includes('route'));
if (streetAddr) best = streetAddr;
// build name from best.address_components
const get = (k:string)=> (best.address_components||[]).find((c:any)=>c.types.includes(k))?.long_name;
const parts:string[]=[];
const prem=get('premise'), subp=get('subpremise'), sn=get('street_number'), rt=get('route'), neigh=get('neighborhood'), subl=get('sublocality')||get('sublocality_level_1'), loc=get('locality');
if (prem) parts.push(prem);
if (subp) parts.push(subp);
if (sn&&rt) parts.push(sn+' '+rt); else if (rt) parts.push(rt); else if (neigh) parts.push(neigh); else if (subl) parts.push(subl); else if (loc) parts.push(loc);
const mainTitle = parts.length? parts.join(', '): (best.formatted_address||'').split(',')[0]||'Current Location';
```

For sorting:
```ts
const sorted = [...enriched].sort((a,b)=>{
  const da = parseFloat((a.distanceKm||'').replace(/[^0-9.]/g,'')) || 999;
  const db = parseFloat((b.distanceKm||'').replace(/[^0-9.]/g,'')) || 999;
  return da-db;
});
setSuggestions(sorted);
```

For autocomplete request:
```ts
const request: any = {
  input: text,
  componentRestrictions: { country: 'in' },
  types: ['geocode','establishment'],
};
if (currentLocation?.lat && currentLocation?.lng) {
  request.location = new g.LatLng(currentLocation.lat, currentLocation.lng);
  request.radius = 10000;
  // request.strictBounds = true; // optional
}
```

VERIFICATION (mentally/check after edit):
- Typing "mullai" near Salem should surface nearest Mullai entries earlier (distance-sorted + tighter bias)
- Tapping "Use Current Location" should show a more street-level name (e.g. "123 ABC Road, Area") instead of just locality
- No TypeScript errors, UI unchanged
- Distances still shown

EDIT ONLY THE SPECIFIED SECTIONS. DO NOT REFACTOR WHOLE FILE.
Make minimal, targeted changes.

NOW APPLY THESE CHANGES TO redtaxi/src/components/common/RapidoLocationSearch.tsx
```