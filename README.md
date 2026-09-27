# AMBOOLA — Tokyo Open World

A browser driving game: take Porsche GT cars and SUVs, plus the whole Tesla lineup, through an open-world, Tokyo-inspired city covered in neon signs and Porsche billboards.

Everything is in one file, `index.html`: the city, the cars, the physics and the sound. No build step and no install.

## How to play

**Option 1 — just open it:** download `index.html` and double-click it. Chrome, Edge, Firefox and Safari all work.
An internet connection is needed the first time, because Three.js and the fonts load from a CDN.

**Option 2 — GitHub Pages:** in the repo go to *Settings → Pages*, choose *Deploy from a branch*, pick the branch and `/ (root)`,
then open the URL it gives you.

**Option 3 — local server:** `npx http-server .` and open `http://localhost:8080`.

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | Throttle |
| `S` / `↓` | Brake, then hold to reverse |
| `A` `D` / `←` `→` | Steer |
| `Space` | Handbrake (drift) |
| `C` | Camera: chase / far chase / hood / bumper |
| `M` | Automatic ↔ manual gearbox |
| `Q` / `E` | Shift down / up (manual) |
| `T` | Time of day: day / sunset / night |
| `R` | Put the car back on the road |
| `P` / `Esc` | Pause, change car, sound on/off |
| `H` | Show controls |

Gamepads work too: RT/LT for throttle and brake, the left stick steers, A is the handbrake, Y changes camera, LB/RB shift, and Start pauses. On phones and tablets, touch buttons appear on screen.

## Cars

**GT:** 911 GT3 RS · 911 GT3 · 911 GT3 Touring · 911 S/T · 911 GT2 RS · 911 Turbo S · 718 Cayman GT4 RS · 718 Spyder RS · 911 Dakar
**Hypercar:** 918 Spyder
**Electric:** Taycan Turbo GT
**SUV:** Cayenne Turbo GT · Cayenne Turbo E-Hybrid · Macan Turbo Electric
**Tesla:** Roadster (next-gen) · Roadster (2008) · Model S Plaid · Model 3 Performance · Model X Plaid · Model Y Performance · Cybertruck Cyberbeast

The Teslas have their own body shapes: glass roofs, smooth grille-less noses, and a flat-panel Cybertruck with a full-width light bar. They also get extra paints: Pearl White, Ultra Red, Stealth Grey, Quicksilver, Deep Blue, and brushed Stainless Steel for the Cybertruck. The next-gen Roadster uses Tesla's announced prototype figures (0–100 km/h in 1.9 s, 400 km/h).

Each car's physics is built from its real published figures: power, weight, redline, top speed, drivetrain and gear count. From those the game works out a torque curve, gear ratios and drag. For example, the GT3 RS reaches 100 km/h in about 3.2 s. The cars also have their own gearboxes (PDK, manual or single-speed EV), rev limiters, traction limits, downforce, brake distances, drifting and body roll. There are 20 paint colours.

## The world

- A 1.6 × 1.6 km city grid with left-hand traffic, as in Japan. Taxis, kei cars, vans and trucks drive around, stop for you and turn at junctions.
- A scramble crossing with giant video screens that cycle through the ads, plus rooftop and wall billboards.
- Vertical neon signs, vending machines, street lamps and cherry-blossom parks.
- A Tokyo-Tower-style landmark, a temple with a pagoda and torii gates, and an elevated expressway (Shuto) with its own traffic.
- A harbour district by the sea, and Mt. Fuji on the horizon.
- The Amboola GT Center showroom, where you start.
- **30 Amboola boards** to smash, **6 speed traps**, and **skill chains** for drifting, near misses and high speed.

## Graphics

Three.js with physically based materials: clear-coat car paint and reflective glass lit by an environment map. It adds dynamic sun shadows, ACES tone mapping, bloom, SMAA anti-aliasing, fog and three times of day with lit windows at night. You can pick Ultra, High or Low graphics in the garage. Low is meant for laptops and phones.

## Sound

There are no audio files; all sound is generated live with the Web Audio API.
- **Combustion engines** are built from individual cylinder firing pulses passed through exhaust resonances. The pulse layers are cross-faded by RPM, so a flat-six, a V8 and the 918's high-revving V8 each sound different.
- On top of that: throttle-dependent tone, a rev-limiter stutter, crackles when you lift off, shift cuts, and turbo whistle with blow-off valve on the turbo cars.
- **Porsche electric cars** have motor and inverter whine plus a low synthesized drive sound.
- **Teslas** are almost silent, like the real cars. You hear a clean motor and gear whine that climbs with speed, a regen whine when you lift off, and the low pedestrian-warning hum below 30 km/h.
- **Around the car:** tyre squeal, road rumble, wind noise, crash sounds and board smashes.

---
*Fan-made game. Not affiliated with or endorsed by Porsche AG or Tesla, Inc. Model names are used only to identify the cars.*
