// Popular backcountry ski and snowboard areas in the US and Canada, with the
// spot you'd check conditions for (a pass, trailhead or bowl) and its
// elevation in feet. The avalanche forecast is looked up by position, so each
// one picks up the right avalanche center on its own.

export const BACKCOUNTRY = [
  { id: "berthoud-pass", name: "Berthoud Pass", state: "CO", lat: 39.798, lon: -105.777, elev: 11307, note: "Roadside laps off US 40 on both sides of the pass. Busy on powder days; park only in plowed lots." },
  { id: "loveland-pass", name: "Loveland Pass", state: "CO", lat: 39.663, lon: -105.879, elev: 11990, note: "US 6 above A-Basin. Hitchhiking laps are common; the pass closes in storms and hazmat traffic detours here when I-70's tunnel is closed." },
  { id: "vail-pass", name: "Vail Pass", state: "CO", lat: 39.531, lon: -106.217, elev: 10662, note: "Shared with snowmobiles. A recreation fee applies at the rest-area trailhead." },
  { id: "cameron-pass", name: "Cameron Pass", state: "CO", lat: 40.52, lon: -105.892, elev: 10276, note: "Northern Colorado's go-to on CO 14. Wind-loaded terrain off the Diamond Peaks." },
  { id: "red-mountain-pass", name: "Red Mountain Pass", state: "CO", lat: 37.898, lon: -107.712, elev: 11018, note: "US 550 between Ouray and Silverton. Big avalanche terrain right above the road." },
  { id: "wolf-creek-pass", name: "Wolf Creek Pass", state: "CO", lat: 37.483, lon: -106.802, elev: 10857, note: "Colorado's snowiest pass, beside Wolf Creek ski area on US 160." },
  { id: "rabbit-ears", name: "Rabbit Ears Pass", state: "CO", lat: 40.384, lon: -106.611, elev: 9426, note: "Gentle, tree-skiing terrain above Steamboat. Good for a low-danger day." },
  { id: "teton-pass", name: "Teton Pass", state: "WY", lat: 43.497, lon: -110.954, elev: 8431, note: "WY 22 between Jackson and Victor. Very busy; know the closures around Glory Bowl over the highway." },
  { id: "togwotee-pass", name: "Togwotee Pass", state: "WY", lat: 43.75, lon: -110.07, elev: 9658, note: "Deep, consistent snow on US 26/287. Shared with snowmobiles." },
  { id: "little-cottonwood", name: "Little Cottonwood Canyon", state: "UT", lat: 40.575, lon: -111.68, elev: 9000, note: "Grizzly Gulch, White Pine and more off UT 210. The road closes for avalanche control (interlodge) during storms." },
  { id: "big-cottonwood", name: "Big Cottonwood Canyon", state: "UT", lat: 40.622, lon: -111.648, elev: 9000, note: "Cardiff Fork, Mill D and Wasatch Crest terrain off UT 190." },
  { id: "snoqualmie-pass", name: "Snoqualmie Pass", state: "WA", lat: 47.424, lon: -121.413, elev: 3022, note: "I-90 east of Seattle. Low elevation, so rain line matters." },
  { id: "stevens-pass-bc", name: "Stevens Pass backcountry", state: "WA", lat: 47.746, lon: -121.089, elev: 4061, note: "Tours off US 2 beside the ski area. Heavy, maritime snow." },
  { id: "mt-baker-bc", name: "Mt. Baker (Heather Meadows)", state: "WA", lat: 48.846, lon: -121.692, elev: 5100, note: "World-record snowfall country. Huge terrain past the ski area boundary." },
  { id: "mt-hood-bc", name: "Mt. Hood above Timberline", state: "OR", lat: 45.338, lon: -121.711, elev: 7000, note: "Register at Timberline. Whiteouts come fast on the open upper mountain." },
  { id: "carson-pass", name: "Carson Pass", state: "CA", lat: 38.694, lon: -119.989, elev: 8574, note: "CA 88 near Kirkwood. Sno-Park permit needed for parking." },
  { id: "donner-summit", name: "Donner Summit", state: "CA", lat: 39.316, lon: -120.33, elev: 7056, note: "Easy access off I-80; Castle Peak and Andesite Ridge." },
  { id: "mammoth-lakes-basin", name: "Mammoth Lakes Basin", state: "CA", lat: 37.6, lon: -119.02, elev: 8900, note: "Big Eastern Sierra terrain above town. Wind slab is common." },
  { id: "galena-summit", name: "Galena Summit", state: "ID", lat: 43.874, lon: -114.713, elev: 8701, note: "ID 75 north of Sun Valley." },
  { id: "cooke-city", name: "Cooke City", state: "MT", lat: 45.02, lon: -109.93, elev: 7600, note: "Remote, deep snowpack outside Yellowstone's northeast gate. Mostly snowmobile access." },
  { id: "tuckerman-ravine", name: "Tuckerman Ravine", state: "NH", lat: 44.259, lon: -71.293, elev: 5000, note: "The classic spring bowl on Mount Washington. Weather on the summit can be extreme." },
  { id: "hatcher-pass", name: "Hatcher Pass", state: "AK", lat: 61.785, lon: -149.29, elev: 3886, note: "Talkeetna Mountains near Palmer." },
  { id: "turnagain-pass", name: "Turnagain Pass", state: "AK", lat: 60.786, lon: -149.18, elev: 988, note: "Seward Highway south of Girdwood. Motorized and non-motorized sides of the road." },
  { id: "rogers-pass", name: "Rogers Pass", state: "BC", lat: 51.301, lon: -117.52, elev: 4350, note: "Glacier National Park, Canada. A winter permit is required and some areas close for avalanche control." },
  { id: "kootenay-pass", name: "Kootenay Pass", state: "BC", lat: 49.06, lon: -117.04, elev: 5823, note: "BC Highway 3 between Creston and Salmo." },
  { id: "duffey-lake", name: "Duffey Lake Road", state: "BC", lat: 50.38, lon: -122.37, elev: 4100, note: "Highway 99 past Pemberton. Big alpine lines close to the road." },
];
