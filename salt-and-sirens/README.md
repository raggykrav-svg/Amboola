# Salt & Sirens

An original open-world crime game for the browser, set in the made-up harbor city of **Port Mareva**. Steal cars, outrun the police, do jobs for the people who run the city, and spend the money.

Everything is in one file, `index.html`: the city, the cars, the people, the sound effects and the radio music are all made in code. There are no downloads or image files and no build step. It does not use any code or assets from Amboola.

## How to play

- **Just open it:** double-click `index.html`. Chrome, Edge, Firefox and Safari all work. You need the internet the first time, because Three.js and the fonts load from a CDN.
- **GitHub Pages:** if Pages is turned on for this repo, the game is at `/salt-and-sirens/` on the Pages site.
- **Local server:** `npx http-server .` in this folder, then open `http://localhost:8080`.

The game saves in your browser: after every job, at the safehouse, and when you quit to the title screen.

## Controls

| Keyboard and mouse | | Gamepad | |
|---|---|---|---|
| W A S D | Move / drive | Left stick | Move / steer |
| Mouse | Look (click the game first) | Right stick | Look |
| Shift | Sprint | RT / LT | Gas and shoot / brake and aim |
| Space | Jump / handbrake (drift) | A | Jump / handbrake |
| E | Get in or out of a car, talk, shop | Y | Car, talk, shop |
| Left click | Shoot / punch | X | Reload |
| Right click | Aim | B or L3 | Sprint |
| R | Reload | LB / RB | Weapons |
| 1 2 3 4 / wheel | Pick a weapon | D-pad | Radio, siren, camera |
| H | Horn | View / Menu | Map / pause |
| T | Next radio station | | |
| G | Siren (in a police car) | | |
| C | Camera (near, far, hood) | | |
| M | Map | | |
| Esc / P | Pause | | |

On phones and tablets, touch controls turn on by themselves: the left thumb moves or steers, dragging on the right side looks around, and there are buttons for shooting, jumping, cars, gas, brake and drifting. Hold the phone sideways.

## Port Mareva

| District | What is there |
|---|---|
| Glasshouse | Downtown glass towers, Mareva Tower (the tallest), the Mint and the bank |
| Midtown | Offices and apartments, the hospital, Pelican Arms, the Mareva Bowl stadium |
| Old Quarter | Low colorful streets, Casa Azul (your safehouse), Dex's Garage, the marina |
| Coral Strand | Hotel row, the beach with the boardwalk, the pier and its Ferris wheel |
| Saltworks | Warehouses, Lola's chop shop, the courier depot, the container docks with cranes |
| Highpalms | Villas and Highpalms Park |
| Gull Cliffs | The north shore and the lighthouse |
| Pelican Key | An island with a private airstrip, over the arched bridge |

Day turns to night (one game hour is one real minute). At night the windows, street lights and car lights come on.

## Story

Seven jobs from three people:

1. **Off the Bus** (Dex): steal any car and bring it to his garage.
2. **Hot Parcel** (Dex): a timed delivery from the docks to Mareva Tower.
3. **Window Shopping** (Lola): steal the red Strata R from the showroom, lose the police, deliver it in one piece.
4. **Pier Lot Sprint** (Rook): a street race against three drivers.
5. **Shake the Tail** (Dex): pick Dex up at the bank, lose three levels of heat, drop him home.
6. **Armored Affair** (Lola): ram the armored truck until it stops, grab the cash, get away.
7. **The Mareva Mint** (Dex): the getaway van, the Mint, the alarm, and a run to the plane on Pelican Key.

The next job's contact has a red letter on the map (D, L or R). Walk into their marker and press E.

## Side jobs and extras

- **QuickGull Courier** (Q on the map): timed deliveries across town. You can also start one from the phone.
- **Lola's List**: Lola asks for a type of car. A cleaner car is worth more.
- **Rook's Races**: three routes after the story race, including one over the bridge.
- **6 stunt jumps**: ramps on the beach, in the park, at the docks and on the runway.
- **20 golden shells** hidden around the city. Find all of them for a big bonus.
- **Shops**: Pelican Arms (pistol, SMG, shotgun, ammo, body armor), Thread & Tide (outfits), Spray Bay (repair and repaint your car).
- **Radio**: four stations that make up their music as you drive (synth-pop, island bounce, lo-fi and house).

## The police

Crimes that a police officer sees, or that someone reports, give you **heat** (the five lights under the money). Higher heat brings more police cars; officers on foot shoot at level 3 and up; roadblocks appear at level 4; a helicopter joins at level 5.

To lose the police, get out of sight. The "Out of sight" bar fills while no officer can see you, and when it is full they give up. A new outfit at Thread & Tide clears low heat, and Dex can make it go away for money (Phone tab).

If they catch you, you pay a fine and start at MPD Central. If you get knocked out, you pay the hospital bill and wake up at Mareva General.

## Settings

In Settings you can change the graphics (Low, Medium, High), sound, radio and effects volume, look speed, invert look, and touch controls. Use **Low** on phones and older laptops.

## For developers

- One file: `index.html` with an import map for `three@0.169.0` from jsDelivr.
- The city is generated from a fixed seed, so it is the same every time.
- `window.SS` is a debugging handle (for example `SS.sim(1/60, 600)` runs ten seconds of game logic without drawing, `SS.drive('super')` puts you in a car, `SS.Heat.set(3)`).
