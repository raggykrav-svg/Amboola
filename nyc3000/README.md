# NYC 3000: Last Stand

A neon open-world shooter set in New York City in the year 3000. It runs in a desktop browser with nothing to install. Fight rogue drones in Times Square, jack cars, fly hover cars through the sky lanes, and get away from the NYPD.

The people, cars, landmark skyscrapers and rooftop props are modelled in [Blender](https://www.blender.org) by Python scripts in [`blender/`](blender/), so every model can be rebuilt from code.

![Title screen](screenshots/01-title.jpg)

| Main menu | On foot |
|---|---|
| ![Main menu](screenshots/02-menu.jpg) | ![Shooting on foot](screenshots/03-onfoot-shooting.jpg) |
| **Driving a stolen car** | **Flying a hover car** |
| ![Driving](screenshots/05-driving.jpg) | ![Flying](screenshots/04-flying.jpg) |
| **People and cars (Blender models)** | **The skyline with the Blender towers** |
| ![People and cars](screenshots/06-new-models.jpg) | ![Buildings](screenshots/07-buildings.jpg) |
| **Robbing a shop** | **Inside a flat** |
| ![Robbing a shop](screenshots/08-shop-robbery.jpg) | ![Inside a flat](screenshots/09-flat.jpg) |
| **Pause-menu shop** | **Street race challenge** |
| ![Shop](screenshots/11-shop.jpg) | ![Street race](screenshots/12-race.jpg) |
| **Cyberpsycho fight** | **A ramen bar (one of 10 kinds of room)** |
| ![Cyberpsycho](screenshots/13-cyberpsycho.jpg) | ![Ramen bar](screenshots/14-ramen-bar.jpg) |
| **The new skyline: corporate towers and megabuildings** | **The elevated highway** |
| ![Skyline](screenshots/16-skyline.jpg) | ![Highway](screenshots/17-highway.jpg) |
| **A giant hologram dancing in a megabuilding courtyard** | **A night market street** |
| ![Hologram](screenshots/18-hologram.jpg) | ![Night market](screenshots/19-market.jpg) |
| **Scanner (hold Q) on a bounty** | **Spotted! The bounty runs for his car** |
| ![Scanner](screenshots/21-scanner.jpg) | ![Spotted](screenshots/22-spotted.jpg) |
| **Doors slide open as you walk up** | **A gun shop** |
| ![Sliding door](screenshots/23-sliding-door.jpg) | ![Gun shop](screenshots/24-gun-shop.jpg) |
| **Nine cars in the shop** | **New building styles: stone, setbacks, round towers** |
| ![New cars](screenshots/25-new-cars.jpg) | ![Building styles](screenshots/28-building-styles.jpg) |
| **A hotel lobby** | **The lift: pick a floor** |
| ![Hotel lobby](screenshots/26-hotel-lobby.jpg) | ![Hotel lift](screenshots/27-hotel-lift.jpg) |
| **A hotel room (floors 1–6)** | **A king suite (floors 7–10)** |
| ![Hotel room](screenshots/29-hotel-room.jpg) | ![King suite](screenshots/30-king-suite.jpg) |
| **The map (Tab), Cyberpunk-style** | **GPS arrows on the road** |
| ![Map](screenshots/31-map.jpg) | ![GPS on the road](screenshots/32-gps-road.jpg) |
| **Flying: the line goes straight there** | **A cyber clinic** |
| ![GPS while flying](screenshots/33-gps-flying.jpg) | ![Cyber clinic](screenshots/34-cyber-clinic.jpg) |
| **Implants (CYBERWARE)** | **Hacking an ATM** |
| ![Cyberware](screenshots/35-cyberware.jpg) | ![ATM hack](screenshots/36-atm-hack.jpg) |
| **A fist fight** | **Riding a motorbike** |
| ![Fist fight](screenshots/37-fist-fight.jpg) | ![Motorbike](screenshots/38-motorbike.jpg) |
| **Boss fight: the giant mech TITAN-0** | **The ending: you saved NYC 3000!** |
| ![Boss mech](screenshots/40-boss-mech.jpg) | ![Ending](screenshots/41-ending.jpg) |
| **Story mission: the sky chase** | **A street race against 3 rivals** |
| ![Sky chase](screenshots/42-sky-chase.jpg) | ![Race rivals](screenshots/43-race-rivals.jpg) |
| **The grappling hook** | **Daytime** |
| ![Grappling hook](screenshots/44-grappling-hook.jpg) | ![Daytime](screenshots/45-daytime.jpg) |
| **Sunset** | **Surprise event: a meteor** |
| ![Sunset](screenshots/46-sunset.jpg) | ![Meteor](screenshots/47-meteor.jpg) |
| **Surprise event: the neon parade** | **Sparky, your robot dog** |
| ![Parade](screenshots/48-parade.jpg) | ![Robot dog](screenshots/49-robot-dog.jpg) |
| **Your own apartment** | **Car and gun upgrades** |
| ![Apartment](screenshots/50-apartment.jpg) | ![Upgrades](screenshots/51-upgrades.jpg) |
| **Home & pets shop** | **Medals** |
| ![Home and pets](screenshots/52-home-and-pets.jpg) | ![Medals](screenshots/53-medals.jpg) |
| **Graphics before…** | **…and after (reflections, light beams, film look)** |
| ![Before](screenshots/54-graphics-before.jpg) | ![After](screenshots/55-graphics-after.jpg) |
| **Wet streets at night** | **Wet streets in the day** |
| ![Wet street](screenshots/56-wet-street.jpg) | ![Wet street, day](screenshots/57-wet-street-day.jpg) |

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
cd nyc3000
npm install
npm run dev
```

Then open the address it prints (http://localhost:5173).

**Static build** (any web host or folder works, because all paths are relative):

```bash
npm run build      # writes dist/
npm run preview    # serves dist/ on http://localhost:4173
```

Upload the `dist/` folder anywhere (GitHub Pages, Netlify, itch.io) to share it.

## How to play

1. The title screen opens first. Press **Enter** or click **PRESS START**.
2. In the main menu, pick **NEW GAME**. **CONTINUE** loads your save; it's greyed out until you have one.
3. Click in the game window to grab the mouse (pointer lock). Press **Esc** to pause.

### Controls

| On foot | |
|---|---|
| W A S D | move |
| Mouse | look and aim |
| Left click | shoot |
| Right click (hold) | zoom aim |
| Shift | sprint |
| Space | jump |
| R | reload |
| 1 / 2 / 3 or mouse wheel | plasma rifle / pulse pistol / scatter cannon |
| 4 / 5 / 6 | VOLT SMG / RAIL SNIPER / PLASMA LAUNCHER (once you buy them) |
| F | jack the nearest car (the driver gets thrown out and runs away) |
| E | go into a shop or a flat, leave it, or sleep in a flat's bed |
| Right click (hold) on a shop clerk | rob the shop |
| B / H | buy ammo / a medkit at a shop counter |
| E at a challenge marker | start a street race, sky race, delivery or search |
| E behind an enemy who hasn't seen you | quiet takedown (knock-out) |
| Q (hold) | scanner: names over people, who's a gang member, slows time |
| Tab | the big map: click a place, SET DESTINATION, follow the arrows |
| V | slow motion (with the TIME DILATOR implant) |
| G | grappling hook: shoot it at a building to fly there (aim near the top to land on the roof) |
| Shift + W next to a wall, in the air | wall-run (Space jumps off the wall) |

| In a car | |
|---|---|
| W / S | gas / brake and reverse |
| A / D | steer |
| Space | handbrake (ground cars) |
| Space / Shift | fly up / down (flying cars) |
| Left click | plasma cannon (hover cars) |
| Shift (cars, bikes) / N (flying cars) | nitro boost (once you buy NITRO in UPGRADES) |
| Mouse | look around (the camera swings back by itself) |
| F | get out (flying cars land by themselves first) |

**Esc** pauses (Resume, Shop, Map, Challenges, Skills & Medals, Options, Save, Controls, Quit to menu). **M** mutes the sound.

### Missions

1. Destroy the rogue drones over Times Square.
2. Steal a car: walk up to one and press **F**.
3. Steal a flying car at **Hover Pad 06** (the orange light beam).
4. Fly through the **SKYLANE A5** gate.
5. Then **the story** starts (see below). When you've finished it, drone waves keep coming in free roam.

### The story: Overlord Zero and the giant mech

**OVERLORD ZERO** and his robot gang, the **CHROME CROWN** (orange headbands), have taken over the city. **JUNO**, a hacker, calls you for help. The story box in the top left always says what to do, and the orange beam and the compass show where.

1. **THE SIGNAL**: smash the Chrome Crown's jammer tower (shoot it; its guards fight back).
2. **DATA HEIST**: grab Zero's data chip, then get it to Juno's hideout in the west while drones chase you.
3. **FREE THE ENGINEER**: find Dr. Tess Volta, talk to her (**E**) and take her to the hideout (she rides in your car).
4. **SKY CHASE**: you get a flying car. Chase Zero's courier through the sky and shoot it down, then pick up the power core.
5. **TOWER TOP**: reach the roof of Zero's tower (fly up or use the grappling hook) and destroy his drones.
6. **BOSS: TITAN-0**: a 19 m giant mech stomps around Times Square. It has a gatling gun, rockets that follow you (shoot them down or run) and, once it's damaged, a **stomp**: jump over the shockwave ring! Shoot the glowing **blue core** on its chest for double damage, and triple once its chest armour breaks open.

When TITAN-0 falls, Zero gives up, fireworks go off over Times Square and you get **$10,000**, 1000 XP and the MECH BREAKER medal. If you get knocked out, the mission starts again. The story saves itself after every mission.

### Races

Street races, sky races and a motorbike race (**NEON BIKE DASH**) are challenges. There's no clock any more: you race against **3 rivals** and have to come **first** (the box shows your position). Second, third and fourth still pay a little. Some races win you a **car**: CROSSTOWN DASH gives the LUMEN GT, NEON BIKE DASH the NEON CHOPPER, and the new **TOWER TOP GRAND PRIX** sky race (210 m up) the NYPD SKY CRUISER. Prize cars go to your garage (SHOP → CARS → DELIVER).

### Grappling hook and wall-running

Press **G** to shoot the grappling hook where you aim. It pulls you there. Aim near the top of a building (up to 30 m above where it hits) and it pulls you up onto the roof. If it hits a wall, you hang there: press **G** again to hook higher, or **Space** to jump off. While you fly on the rope, **Space** lets go with a jump.

**Wall-running**: jump next to a wall while sprinting forward (**Shift + W**) and you run along it. **Space** jumps off; you can jump from wall to wall.

### Day and night

A full day takes 20 minutes, and the clock is under the district name. In the day the sky is blue, the sun casts the shadows and the neon is dim. At sunset and sunrise the sky turns orange and pink. At night the neon glows brightest, and sometimes there are fireworks. **Options → Time of day** can keep it always day or always night. A new game starts at sunset.

### Surprise events

Every minute or two (during free roam, after the first steps), something happens nearby. You can go there (the box and the compass show it) or ignore it:
- **ARMORED TRUCK ROBBERY**: beat the robbers and the cash bags are yours.
- **METEOR STRIKE**: a meteor crashes into the street; grab the glowing space crystal.
- **GANG WAR**: two gangs shoot at each other; when you come close they turn on you. Stop them both.
- **NEON PARADE**: dancers and balloon floats march down the street. Walk along with them for 20 seconds to join the party.
- **FIREWORKS SHOW** (at night): watch it in Times Square.

### Levels, skills and medals

Everything gives **XP**: challenges, beating bad guys, story missions, events, golden robots, neon tags, ATM hacks. Each level gives a **skill point** (the XP bar and level are under your money). Spend points in the pause menu under **SKILLS & MEDALS**. Each skill goes up to rank 3:
- **RUNNER**: run faster. **TOUGH AS STEEL**: take less damage. **SHARPSHOOTER**: guns hit harder. **BRAWLER**: harder punches.
- **SPEED DEMON**: faster cars and bikes. **GRAPPLER**: longer, faster grappling hook. **LUCKY**: more cash from everything.

There are **22 medals** for cool things, like driving faster than 200 km/h, flying higher than 300 m, winning every race, wall-running, staying out until midnight or seeing the sun come up. **20 golden robot statues** are hidden around the city (they glow gold: look on low rooftops, in side streets and near the highway). Each one is worth $250 and XP.

### Sparky, your robot dog

Adopt **SPARKY** in the shop (**HOME & PETS**, $800). He follows you everywhere and hops in your car with you. He runs at bad guys who are fighting you and bites them, and he fetches ammo, health and cash lying nearby and drops them at your feet. He's the green dot on the minimap.

### Your own apartment

Buy the **penthouse** in **HOME & PETS** ($3,000). It's the flat door closest to where you start (a gold house icon on the map and the minimap). Inside: a city view, a hot tub, a bar and a bed (sleep to save). Then buy things to put in it: a neon sign, lava lamps, a **trophy case** (it fills with a gold cup for each medal), hologram fish, a jukebox, an aquarium, an **arcade machine**, a gaming setup and a giant golden robot. Up to four of your own cars wait in your **garage** on the street outside.

### Upgrades

**SHOP → UPGRADES**: **ENGINE TUNE** (faster), **ARMOR PLATING** (tougher), **NITRO BOOST** (Shift, or N in a flying car, with a NITRO bar), **NEON UNDERGLOW** in six colours, a **PAINT JOB** for all your own cars, and for every gun you own: more **DAMAGE** and a **BIG MAGAZINE**.

### Shops, flats and money

![Shop and flat doors](screenshots/10-doors.jpg)

Every building has 5 street doors: 2 shops and 3 flats (brick walk-ups have 1 shop and 4 flats, Times Square buildings 3 shops and 2 flats). Shop doors glow green with the shop's name above them, and shops show as green dots on the minimap. Flat doors are metal with a warm light, a lamp and an intercom. Walk up to a door and press **E** to go in.

- **Every door is different inside.** A shop's sign decides what's behind it: ramen bars (KAIJU RAMEN, NOODLE BOTS), diners (QUANTUM BURGER, PLASMA PIZZA, CYBER DELI), cyber bars with a dance floor and a disco ball (NEURAL LINK BAR, CHROME DOLLS, HOTEL 3000), arcades (ARCADE 9, 24/7 HOLOSHOW), banks with a vault (HOLO-BANK, NEO WALL ST) and corner marts (the rest). Flats are studios, glass-walled penthouses with a hot tub and a piano, gamer dens full of RGB lights, or brick lofts. Every door also gets its own lighting mood.
- **Shops:** hold **right click** to aim your gun at the clerk. They put their hands up, and if you keep aiming the robbery bar fills, then they drop a bag of money ($150–$500) on the counter. Walk up to the counter to grab it. The alarm goes off and you get 2 wanted stars, and that shop has nothing left for 4 minutes. You can also pay at the counter: **B** for ammo ($100), **H** for a medkit ($150). **Banks** pay $700–$1,500 but give you 3 stars, and they don't sell anything.
- **Flats:** each flat has a TV, a kitchen, a sofa and a bed. Most flats hide one stash (cash, ammo or a medkit) that you can find once. Press **E** at the bed to sleep: it heals you, clears your wanted level and saves the game.
- Your money is shown in the top right. You start with $200, and it's kept in your save.

### Activities (like the side activities in Cyberpunk 2077)

Our own versions, with made-up names:

- **Cyber clinics** (CHROME CLINIC, CYBER DOC; white dots on the minimap, a green cross inside). Go in and press **E** at the counter to see the **CYBERWARE** page. Implants give you powers:
  - **LEAP SPRINGS** $1,200: jump again in mid-air (double jump)
  - **CAT FEET** $900: enemies notice you half as fast (sneaking)
  - **HAWK EYES** $1,000: every bad guy nearby is on your minimap, and the scanner reaches further
  - **TITAN SKIN** $1,500 (Street Cred 1): you take a third less damage
  - **BIO REGEN** $1,800 (Street Cred 1): your health heals slowly by itself
  - **TIME DILATOR** $2,500 (Street Cred 2): press **V** for 5 seconds of slow motion (recharges in 20)
- **Hacking ATMs**: about 75 ATMs stand next to shops. Press **E** for the **CODE HACK** puzzle: a 5×5 grid of codes. Start in the top row, then pick in the column of your last pick, then the row, and so on. Your picks go into a 6-slot buffer; make the target sequences to win $150 and $450. The clock (25 s) starts with your first pick. Each ATM can be hacked once.
- **Neon tags**: 24 glowing robot-face graffiti tags are hidden on walls around the city. Walk up to one to collect it: $50 each, plus bonuses at 8, 16 and all 24. They're saved.
- **Street food**: at the night-market stalls (RAMEN, TACOS, SUSHI, BAO…) press **E** to eat for $15 and get 40 health back.
- **Fist fights** (orange squares): FIGHT NIGHT AT THE DOCKS and ROOFTOP RUMBLE. No guns in the ring: **left click** throws punches, left and right. Beat each fighter in turn; if your health gets too low you're knocked down (you don't die) and can try again.
- **Shooting galleries** (light-green squares): NEON RANGE and SKY TARGETS. Hologram targets pop up all around you for 40 seconds; hit enough to win, and every extra hit pays a bonus.

Your implants and neon tags are saved with the game.

### The map and the GPS

Press **Tab** (or **MAP** in the pause menu) for the big map. It's drawn like the map in Cyberpunk 2077: a dark screen with red-outlined buildings that **stand up as 3D blocks** (the taller the building, the taller the block, and the corporate towers glow brighter), faint red streets, yellow highways, scanlines, and the **district names** written big across the city: **TIMES SQUARE**, **MIDTOWN SPIRES**, **NEON MARKET**, **HARBOR SIDE**, **NORTH YARDS** and **SOUTH BAY** (our own districts). The district you're in is shown in the corner of the map and under the minimap, and a message pops up when you walk into a new one.

Every kind of place has its own icon: a crosshair for **gun shops**, a green cross for **cyber clinics**, **H** for hotels, a bag for shops, a bowl for street food, **$** for ATMs you can hack, smiley faces for the neon tags you've found, a car for your own cars, and a coloured diamond with the job's picture for each **challenge**. Zoom in to see the small places (shops, food, ATMs). **Hover the mouse over an icon** to see its name. The **SHOW ON MAP** checkboxes on the right hide or show each kind.

![Zoomed-in map with a hover tooltip](screenshots/39-map-zoom.jpg)

Scroll to zoom and drag to move it. **Click a place** and the side panel asks *Where do you want to go?* and names what you picked (a shop, a hotel, a challenge, or just a map marker); press **SET DESTINATION**. There are also quick buttons for the nearest shop, gun shop, hotel or challenge.

Like in Cyberpunk 2077, a line of glowing yellow **arrows is painted on the roads** all the way there (it takes the streets with the fewest turns and avoids the highway ramps), and it's also drawn on the minimap. If you leave the route it finds a new one. **When you fly**, the line goes **straight through the air** to the spot instead. A yellow beam marks the destination, and you get *YOU HAVE ARRIVED* when you're there. **TRACK** on a challenge sets the GPS to it too.

### Hotels

Many tall buildings have a **hotel** door (HOTEL 3000, GRAND NEON HOTEL, SKYLINE HOTEL, HOTEL AURORA, THE MIDTOWN, HOTEL LUNA): the gold dots on the minimap. Inside is a lobby with a receptionist, couches, chandeliers and two lifts at the back. Walk up to a lift and press **E**: a panel with floors **1–10** pops up. Click a floor (or press 1–9, 0 for 10) and you ride up to your hotel room. Floors 1–6 have **hotel rooms** with two made beds (white duvets, a red runner, a padded headboard), nightstands with lamps, pictures over the beds, a TV on a dresser with a glowing minibar, a desk by a curtained window, a wardrobe, a suitcase on a rack and the bathroom door. Floors 7–10 have **king suites** with a huge bed, a bench at its foot, and a white sofa with flowers by a wide window. Sleep in the bed to save, and look around for a hidden stash. Leave the room and the lift takes you back down to the lobby.

### Doors, gun shops and cars

- **Doors slide open** like in Cyberpunk 2077: walk up to a door and its two panels slide into the frame, with a green light. Just keep walking to go in (or press **E**). The door inside the room opens the same way when you leave. A red light means locked: shops you robbed lock you out for a few minutes.
- **Gun shops** (PLASMA ARMS, IRON & NEON GUNS) are the orange dots on the minimap. Inside there are racks of guns, a glass counter and a shooting range. Press **E** at the counter to look at the guns (the shop's GUNS & GEAR page opens), or **B** / **H** for ammo and medkits.
- **Motorbikes:** the sporty **VOLT BIKE** (up to 245 km/h) and the long, low **NEON CHOPPER**, both modelled in Blender. Walk up and press **F** to ride: you stay on the bike in a riding pose (crouched on the sport bike, sitting back on the chopper), it leans into turns and the camera sits closer. Two are parked right next to the start, and you can buy them in the shop ($700 and $1,200).
- **More cars:** the LUMEN GT supercar, the little PIXEL MINI and the METRO VAN (modelled in Blender like the rest), driving in traffic, parked near the start and for sale in the shop. There's also more traffic.

### The shop (pause menu)

Press **Esc** and pick **SHOP** to spend your money. Every card shows the real 3D model.

- **Cars:** PIXEL MINI $300, METRO VAN $1,100, LUMEN GT $4,200, NEO-SEDAN $400, VOLT RUNNER $900, SKY TAXI $1,500, HOVER SPORTS CAR $2,500, NYPD INTERCEPTOR $3,500 and NYPD SKY CRUISER $5,000. A car you buy is parked right next to you (or outside the door if you're indoors), and you keep it: press **DELIVER** any time to get it brought to you again for free. Driving your own police car doesn't get you in trouble.
- **Guns:** VOLT SMG $600 (fast), RAIL SNIPER $1,500 (huge damage, zooms in when you aim) and PLASMA LAUNCHER $3,000 (explosive shots). They go on keys 4, 5 and 6.
- **Gear:** ammo packs and medkits.
- The best cars and guns are locked until you have enough **Street Cred**, which you earn from challenges.

### Challenges

Like the gigs and NCPD jobs in Cyberpunk 2077, there are 26 challenges around the city. They're the coloured squares on the minimap. Open **CHALLENGES** in the pause menu to see them all and **TRACK** one to get a marker on your compass and a light beam in the sky.

- **Street races** (yellow): press **E** at the marker, a car is brought to you, then drive through every glowing ring before the timer runs out.
- **Sky races** (cyan): the same, in a flying car, with rings high above the streets.
- **Gang hideouts** (red): the gang hangs around without knowing you're there. Sneak up behind them for quiet takedowns, or open fire. Take them all down. Gang members are marked with red diamonds, and fighting them doesn't make you wanted.
- **Cyberpsychos** (pink): one huge enemy with a big health bar and a shotgun.
- **Deliveries** (green): press **E** to grab the package and get it to the green beam in time.
- **Drone nests** (orange): shoot down every drone.
- **Find someone** (purple): press **E** at the marker, then search the purple circle (hold **Q** to scan people; the objective box shows a photo). Rescue Dr. Maya Ortiz from her kidnappers and take her to Liberty Med Center, find Lily's lost robot dog Bolt and bring him home, or chase down the informant Glitch on foot and grab him (don't shoot him!). The people you rescue follow you and even hop into your car.
- **Bounties** (white): a wanted bad guy (Razor Rook, Nova & Vex, Mama Kilowatt) with bodyguards. Knock them out quietly from behind for a $300 bonus, or fight. When some bosses see you, they run for their car and try to get away: shoot or ram the getaway car until they jump out.
- **Crimes in progress** (blue): robbers holding up a delivery driver, a driver or a shop owner. Stop them, and be careful not to hit the victim.

#### Enemies notice you, like in Cyberpunk 2077

Bad guys don't just attack the moment you show up. They stand around, chat and keep watch.
- If they **see you** a meter fills up over their head (**?**), faster when you're close or running. When it's full they shout and attack (**!**). The middle of the screen warns you when someone is noticing you.
- If they **hear gunshots** close by, they start shooting back straight away. Shots further away make them come and look. Every gun has its own noise: the sniper and launcher are the loudest.
- Bullets flying past them, getting hit, or seeing a friend go down also puts them in a fight, and they shout to the rest of their gang.
- If you get out of sight for a while they search for you, and after a bit they give up ("Must have been nothing").
- **Street gangs** (Chrome Skulls, Neon Vipers, Data Rats, Volt Kings, with glowing headbands) hang out on street corners. They leave you alone, unless you shoot near them, point a gun at them or hit them.

Each challenge pays $500–$1,800 plus Street Cred. Street Cred levels (shown under your money) unlock the locked items in the shop. Your money, cars, guns, Street Cred and finished challenges are all saved.

### The city

The buildings come in many more shapes and styles now, like the real Manhattan from the air: **pale limestone, tan and brown stone** towers with rows of windows, **golden and blue glass** towers, **"wedding cake" towers** that step back as they rise, **round towers** with stone ledges, and **machine rooms** on the flat roofs.

Downtown looks like Night City now (made-up brands, not copied from the game):
- **Four corporate towers** 330–400 m tall (LIBERTY CORP, HELIX DYNAMICS, AURELION, KAIROS SYSTEMS) with glowing logos, a halo ring, twin towers joined by skybridges and one with a huge overhanging head. Giant hologram **whales** swim around two of them.
- **Seven megabuildings** that fill a whole block: concrete slab towers full of balconies, joined by skybridges, with neon decks and their own name (MEGABLOCK 01…). Hologram **dancers**, a waving robot **cat** and a spinning soda can stand on them.
- **Stacked towers** made of shifted boxes that hang out over the sidewalk, **night markets** with food stalls and lanterns, and **cables** strung across the streets.
- **Two elevated highways** (SKYWAY 8 and SKYWAY 2) on concrete pillars with their own traffic. Drive up the ramps at the edges of the city, or land a flying car on them.
- **Ads:** about 50 animated screens on buildings and rooftops, all made-up and kid-friendly (ZAP COLA, ROBO PUP, MOON TRIPS…).

### Wanted level

You get wanted stars for stealing cars, shooting people, and fighting the police. Police cars chase you, cyber-cops jump out and shoot, and at 2+ stars flying police cruisers join in (at 3+ police drones too). Stay out of sight of the police and the stars fade one by one ("EVADING…"). If you die, you respawn at Liberty Med Center with your stars cleared.

Health: your **shield** soaks up most damage and recharges a few seconds after you stop getting hit. Orange crates are ammo, green crates are health.

## Options

All graphics settings change live, even from the pause menu, and they're saved in the browser.

| Setting | What it does |
|---|---|
| Quality preset | **Low** (for weak laptops), **Medium**, **High**. Changing anything below switches to Custom. |
| Resolution scale | Renders at 40–100% of the screen's pixels. This is the biggest speed boost. |
| Shadows | On or off. |
| Neon glow (bloom) | The glow around neon lights. Turn it off for more speed. |
| Wet street reflections | The rainy streets mirror the neon signs, billboards, lamps and cars, with ripples while it rains (puddles are sharp, damp asphalt is blurry). It draws the city a second time at half size, so it's on in **High** only; turn it on in Medium if your graphics card is fast. |
| Extra effects | A film look (colour grading, a vignette, a little lens fringing and film grain), smooth edges (multisampling) and soft light beams under the street lamps at night. Needs Neon glow on. On in Medium and High. |
| View distance | 250–1200 m. Fog and distance culling follow it. |
| Rain | Off, light, medium or storm. |
| Time of day | Day + night (a day lasts 20 minutes), always day or always night. |
| Traffic & crowds | How many cars and people. |
| Frame rate cap | VSync, 60 or 30 FPS. |
| Show FPS counter | Top right. |
| Mouse sensitivity, Invert Y, Volume | Controls and sound. |

**Low** uses 60% resolution with no shadows, no bloom, no reflections or extra effects, 380 m view, light rain and fewer cars and people. On every preset the ground has glossy puddles, and there are stars in the night sky. The game picks Low by itself on machines with 4 or fewer CPU cores or 4 GB or less of memory.

## Using your own concept art for the title and menu

The title screen (a dark armored Statue of Liberty with red laser eyes) and the rooftop main menu are drawn live in 3D. To use painted backgrounds instead, put the images in `public/` with these names:

- `public/title-bg.jpg`: the title screen. The HTML title text then hides, and the clickable, blinking **PRESS START** stays on top.
- `public/menu-bg.jpg`: the main menu. The buttons stay on top.

Rebuild or reload, and the game uses them automatically.

## The Blender models

`blender/` holds the Python scripts that model everything in Blender, and `public/models/` holds what they export (`cars.glb`, `people.glb`, `buildings.glb`). The exported files are committed, so the game runs without Blender. To change a model, edit its script and rebuild ([Blender](https://www.blender.org/download/) 4.2 or newer; tested with 4.5 LTS):

```bash
cd nyc3000
blender -b --factory-startup -P blender/build.py -- all
```

`npm run models` does the same if `blender` is on your PATH. Build one group with `-- cars`, `-- people`, `-- buildings` or `-- interiors`. Add `--preview some/folder` to also render Cycles preview images of the models. If `blender` isn't on your PATH, use its full path, for example `/Applications/Blender.app/Contents/MacOS/Blender` on a Mac.

- `blender/cars.py`: six vehicles. Ground cars have lofted bodies: smooth cross-sections along a side profile with real wheel arches, a greenhouse split into glass, roof and pillars, door seams, lathed tyres and rims with neon rings, headlights, a full-width tail light, mirrors and underglow. The muscle car has a hood scoop, racing stripes, a spoiler and quad exhausts. The police car has white doors, a light bar and a push bar. Hover cars have a bubble canopy, thruster pods on pylons, tail fins and glowing hover pads. The sky taxi has a checker stripe, a roof sign and four hover pods.
- `blender/people.py`: the soldier, the NYPD cyber-cop and 12 pedestrians. Bodies are metaballs, one smooth piece per item of clothing (top, trousers or skirt, skin, shoes, hair, hood), plus hard-surface armour, helmets with visors, caps, headphones, bags and neon umbrellas. They're skinned to the game's 17-bone skeleton in an A-pose, so the walk and run cycle and the gun-holding arm IK still drive them.
- `blender/buildings.py`: six landmark skyscrapers (an art-deco spire with a sunburst crown, a twisting glass tower, a round tower with a floating halo ring, a stepped Empire-style tower with a mast, a glass-pyramid tower and a slim tower with a sloped crown) and rooftop props (wooden water towers, one kind with neon, AC units and satellite dishes). Tower facades are UV-mapped for the game's window textures, and their collision boxes are exported too.
- `blender/interiors.py`: 10 rooms. The shops are a corner mart, a ramen bar with red lanterns and steaming pots, a diner with booths, a jukebox and a pizza oven, a cyber bar with a dance floor and a DJ booth, a marble bank with teller windows and a vault, and an arcade with rows of cabinets and a claw machine. The flats are a studio, a penthouse with glass walls, a hot tub and a grand piano, a gamer den, and a brick loft with a factory window and Edison bulbs. The lighting is baked into the vertex colours with ray-traced shadows, so the game draws the rooms cheaply.
- `blender/lib.py`: shared helpers: part building, lofts and lathes, ambient occlusion baked into vertex colours with ray casts, sharp edges by angle, GLB export and preview renders.
- Every car and person also gets a lighter far-away version (level of detail), so the game stays as fast as before.

## How it's made

- [three.js](https://threejs.org), [Vite](https://vitejs.dev) and [Blender](https://www.blender.org). Every model, texture and sound is generated by code: models by the Blender scripts above, canvas-drawn neon signs and windows, and Web Audio synths. There are no downloaded art or sound files. The fonts (Orbitron, Rajdhani) are SIL Open Font License, bundled through Fontsource.
- `src/megacity.js`: the Night-City-style buildings (megabuildings, corporate towers, stacked towers, night markets, cables). `src/highway.js`: the elevated highways, their ramps and their traffic. `src/ads.js`: ad screens (one shared texture and shader) and the holograms.
- `src/activities.js`: cyberware implants, the ATM code hack, neon tags and street food.
- `src/mapscreen.js`: the big map. `src/gps.js`: the route along the roads (a search over the street crossings) and the arrow lines.
- `src/ai.js`: the enemy brain (calm, searching, fighting; hearing, sight, squads, takedowns), street gangs and the people you rescue or chase.
- `src/shop.js`: the pause-menu SHOP (with 3D pictures rendered from the real models) and the CHALLENGES board. `src/challenges.js`: the challenges, Street Cred and their markers.
- `src/interiors.js`: builds the shop and flat rooms far outside the city. Going through a street door moves you into the right room, and the police wait outside the door.
- `src/assets.js`: loads the Blender GLB files at start-up and flattens each model into one or two meshes with vertex colours, a neon glow flag and per-vertex shininess. If a file is missing, the game falls back to its built-in code models.
- `src/city.js`: a 10×10-block Manhattan grid built from a fixed seed, so saves always load into the same city. Buildings are merged into 2×2-block chunks to keep draw calls low, with collision boxes in a spatial hash. Every building gets 5 street doors (shops and flats). The Blender towers stand on podiums with shop fronts, among code-built glass towers, octagonal towers, art-deco crowns, brick walk-ups with fire escapes, helipads and glowing skybridges.
- `src/game.js`: player, weapons, plasma bolts, pedestrians, traffic on a road graph, sky-lane flying traffic, police AI, missions, save data.
- `src/people.js`: the 17-bone skeleton (knees, elbows, hands), the walk and run cycle and the two-bone arm IK that puts the hands on the gun. It also has the code-built fallback people.
- `src/cars.js`: vehicle stats, sirens, NYPD and TAXI decals, and the code-built fallback cars.
- `src/models.js`: guns, drones, pickups. `src/parts.js`: the shared part builder and a material where neon parts glow in the same draw call as the body.
- `src/title.js`: the title-screen statue scene. `src/hud.js`: HUD, minimap and compass. `src/settings.js`: options and presets.
- Anti-glitch measures:
  - signs and billboards float 0.35–0.75 m off walls, and floor glow decals use polygon offset, so there's no z-fighting;
  - the shadow camera snaps to shadow-map texels, so shadows don't shimmer;
  - the ground is a hard floor at y = 0 for everything;
  - the camera is pushed out of walls and lamp posts.
- `window.nyc` is a debug handle. For example, `nyc.sim(5)` advances the game 5 seconds without rendering, which is handy for automated tests.
