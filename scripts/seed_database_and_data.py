import json
import re

topics_tuples = [
    (1, 'How does GPS know exactly where you are?', ['Technology', 'Computer Science', 'Physics', 'Mathematics', 'Space & Cosmos'], 'navigation', 'satellite', 'spokes', 'Twenty-four atomic clocks orbiting twelve thousand miles above Earth calculate your position down to inches using the speed of light.'),
    (2, 'How does the internet actually move information across the world?', ['Technology', 'Computer Science', 'Engineering', 'Geography'], 'networking', 'network', 'grid', 'Thick glass fibers stretching across dark ocean floors carry pulses of light carrying every email, stream, and transaction.'),
    (3, 'What actually happens when you type a website address and press Enter?', ['Computer Science', 'Technology', 'Networking'], 'browser', 'globe', 'matrix', 'In milliseconds, your computer questions global root servers, establishes encrypted cryptographic handshakes, and reassembles fragmented packets.'),
    (4, 'How does a computer turn billions of tiny switches into software?', ['Computer Science', 'Technology', 'Physics', 'Mathematics'], 'processor', 'cpu', 'waves', 'Microscopic silicon gates flicker between charged and uncharged, translating raw electrical current into logic, math, and thought.'),
    (5, 'How does a search engine find something among billions of webpages?', ['Computer Science', 'Mathematics', 'Technology'], 'algorithm', 'search', 'grid', 'Spider crawlers map the entire web into multidimensional mathematical graphs, scoring relevance before your fingers leave the keyboard.'),
    (6, 'How does an algorithm decide the fastest route between two places?', ['Computer Science', 'Mathematics', 'Geography', 'Transportation'], 'route', 'map-pin', 'spokes', 'Graph theory reduces continents to vertices and edges, pruning millions of dead ends in microseconds using Dijkstra heuristics.'),
    (7, 'How does a QR code store so much information in such a small space?', ['Computer Science', 'Mathematics', 'Technology'], 'barcode', 'qr-code', 'matrix', 'Two-dimensional Reed-Solomon mathematics embed error-correcting geometry that remains readable even when torn or smudged.'),
    (8, 'How does encryption keep two people’s messages private?', ['Computer Science', 'Mathematics', 'Technology', 'Cryptography'], 'cryptography', 'lock', 'orbit', 'Trapdoor prime numbers create one-way mathematical locks that would take all supercomputers combined billions of years to crack.'),
    (9, 'How does a recommendation algorithm figure out what you might like?', ['Computer Science', 'Mathematics', 'Psychology', 'Technology'], 'recommendation', 'sparkles', 'waves', 'High-dimensional matrix factorization maps your unconscious tastes against millions of overlapping behavioral twins.'),
    (10, 'How can artificial intelligence learn without being explicitly told every answer?', ['Computer Science', 'Mathematics', 'Neuroscience', 'Technology'], 'machine learning', 'brain', 'orbit', 'Gradient descent iteratively nudges millions of artificial synaptic weights downhill until noise crystallizes into recognition.'),
    (11, 'How does an AI model turn a sentence into numbers?', ['Computer Science', 'Mathematics', 'Linguistics', 'AI'], 'embeddings', 'binary', 'matrix', 'Words are projected into thousands of semantic dimensions where relationships like king minus man plus woman equal queen.'),
    (12, 'How does a computer recognize a face?', ['Computer Science', 'Mathematics', 'Neuroscience', 'Technology'], 'vision', 'scan-face', 'grid', 'Convolutional layers break light into edges, textures, and spatial ratios, creating a unique mathematical fingerprint of every visage.'),
    (13, 'How does Shazam recognize a song from a few seconds of sound?', ['Computer Science', 'Mathematics', 'Music', 'Technology'], 'acoustic', 'waveform', 'waves', 'Audio is transformed into a spectrogram fingerprint, matching peak frequency constellations against millions of catalog tracks.'),
    (14, 'How does a database find one piece of information among billions?', ['Computer Science', 'Mathematics', 'Technology'], 'database', 'database', 'grid', 'Balanced B-trees and hash indexes divide search spaces exponentially, locating a solitary byte in four disk seeks.'),
    (15, 'Why are some problems incredibly difficult for computers to solve?', ['Computer Science', 'Mathematics', 'Philosophy'], 'complexity', 'infinity', 'orbit', 'The P versus NP boundary separates problems that can be solved quickly from those whose answers can only be verified in a lifetime.'),
    (16, 'How does a computer generate a number that seems random?', ['Computer Science', 'Mathematics', 'Physics'], 'randomness', 'dice-5', 'matrix', 'Deterministic algorithms harvest atmospheric thermal jitter, radioactive decay, or keystroke timing to escape mathematical predictability.'),
    (17, 'How does a video game create a believable world in real time?', ['Computer Science', 'Mathematics', 'Physics', 'Technology', 'Art & Culture'], 'graphics', 'box', 'spokes', 'Matrix algebra rasterizes millions of textured polygons sixty times a second while ray tracing simulates individual photons.'),
    (18, 'How does a self-driving car understand what is happening around it?', ['Computer Science', 'AI', 'Engineering', 'Physics', 'Mathematics'], 'autonomous', 'radar', 'spokes', 'LiDAR point clouds, ultrasonic pulses, and neural vision networks fuse into a 360-degree real-time predictive spatial model.'),
    (19, 'How does a computer understand human language?', ['Computer Science', 'AI', 'Linguistics', 'Neuroscience'], 'language', 'message-square-code', 'waves', 'Attention mechanisms weigh every word against every other word in context, capturing sarcasm, idioms, and subtext.'),
    (20, 'How does the same internet work on a phone, a submarine cable, and a satellite?', ['Computer Science', 'Engineering', 'Physics', 'Geography', 'Space & Cosmos'], 'telecom', 'radio-tower', 'grid', 'The abstraction of the IP protocol wraps packets in light, copper voltage, and radio waves without altering the data inside.'),
    (21, 'How do scientists know what stars are made of when they cannot touch them?', ['Space & Cosmos', 'Physics', 'Chemistry', 'Astronomy'], 'spectroscopy', 'telescope', 'spectrum', 'Fraunhofer absorption lines in starlight act as elemental barcodes, revealing hydrogen, helium, and iron across light years.'),
    (22, 'How can we see something that happened billions of years ago?', ['Space & Cosmos', 'Physics', 'History'], 'cosmology', 'hourglass', 'orbit', 'Because light has a finite cosmic speed limit, looking into deep space is physically looking backward into primordial time.'),
    (23, 'How do we know the universe is expanding?', ['Space & Cosmos', 'Physics', 'Mathematics'], 'expansion', 'maximize-2', 'spokes', 'Distant galactic light stretches into redder wavelengths, proving that space itself is stretching in every direction simultaneously.'),
    (24, 'How does a black hole bend light?', ['Space & Cosmos', 'Physics', 'Mathematics'], 'relativity', 'circle-dot', 'orbit', 'Extreme mass warps the geometric fabric of spacetime so severely that light follows curved geodesics around the event horizon.'),
    (25, 'What would happen if the Sun suddenly disappeared?', ['Space & Cosmos', 'Physics', 'Earth Science'], 'solar', 'sun', 'spokes', 'For eight minutes and twenty seconds, Earth would bask in normal daylight and orbit normally before hurtling into freezing darkness.'),
    (26, 'Why doesn\'t the Moon fall into Earth?', ['Space & Cosmos', 'Physics', 'Mathematics'], 'orbital', 'moon', 'orbit', 'The Moon is perpetually falling toward Earth, but its forward tangential velocity causes it to constantly miss the horizon.'),
    (27, 'How can a rocket accelerate in the vacuum of space?', ['Space & Cosmos', 'Physics', 'Engineering'], 'propulsion', 'rocket', 'spokes', 'Rockets do not push against atmospheric air; they accelerate by expelling high-velocity combustion mass out of their nozzles.'),
    (28, 'How does a spacecraft find its way to another planet?', ['Space & Cosmos', 'Physics', 'Mathematics', 'Engineering'], 'astrodynamics', 'compass', 'orbit', 'Hohmann transfer orbits use gravitational slingshots and orbital mechanics to meet moving planetary targets millions of miles away.'),
    (29, 'Why does time slow down when something moves extremely fast?', ['Physics', 'Space & Cosmos', 'Mathematics', 'Philosophy'], 'time dilation', 'clock', 'waves', 'Because the speed of light must remain invariant for all observers, space contracts and time dilates to preserve cosmic symmetry.'),
    (30, 'How can gravity affect the passage of time?', ['Physics', 'Space & Cosmos', 'Mathematics', 'Philosophy'], 'gravitational time', 'timer', 'orbit', 'The deeper you sit inside a gravitational well, the slower the ticks of time pass relative to an observer in open space.'),
    (31, 'What is actually happening inside a quantum computer?', ['Computer Science', 'Physics', 'Mathematics', 'Technology'], 'quantum computing', 'atom', 'matrix', 'Superconducting qubits exploit superposition and entanglement to evaluate vast combinatorial landscapes all at once.'),
    (32, 'How can something be in two quantum states at once?', ['Physics', 'Mathematics', 'Philosophy', 'Technology'], 'superposition', 'layers', 'waves', 'Until a measurement forces wave-function collapse, subatomic particles exist as probability distributions across all potential states.'),
    (33, 'How does quantum tunnelling let particles pass through barriers?', ['Physics', 'Mathematics', 'Technology'], 'tunnelling', 'shield', 'grid', 'Wave-particle duality allows a particle’s probability wave to leak through an impenetrable barrier and materialize on the other side.'),
    (34, 'Why does the universe contain more matter than antimatter?', ['Physics', 'Space & Cosmos', 'Mathematics'], 'baryon', 'scale', 'orbit', 'A subtle violation of CP symmetry in the first fractions of a second spared one matter particle out of every billion from annihilation.'),
    (35, 'How do we know dark matter exists if we cannot see it?', ['Space & Cosmos', 'Physics', 'Mathematics'], 'dark matter', 'eye-off', 'orbit', 'Galactic rotation curves and gravitational lensing reveal invisible scaffolding possessing eighty-five percent of cosmic mass.'),
    (36, 'How does your brain turn electrical signals into thoughts?', ['Neuroscience', 'Biology', 'Physics', 'Psychology'], 'synapse', 'brain', 'waves', 'Billions of ionic action potentials ripple across neural lattices, binding sensory fragments into continuous conscious experience.'),
    (37, 'How does one microscopic cell become an entire human?', ['Biology', 'Neuroscience', 'Genetics', 'Medicine'], 'embryogenesis', 'git-commit', 'spokes', 'Morphogen chemical gradients switch regulatory genes on and off, folding a single blastocyst into complex organ systems.'),
    (38, 'How does DNA contain instructions for building a human?', ['Biology', 'Genetics', 'Chemistry', 'Medicine'], 'genetics', 'dna', 'matrix', 'Four nucleotide letters fold into triplets, coding for twenty amino acids that fold into the nanomachinery of living tissue.'),
    (39, 'How does your immune system recognize something it has never encountered before?', ['Biology', 'Medicine', 'Genetics', 'Neuroscience'], 'immunology', 'shield-check', 'spokes', 'V(D)J genetic recombination randomly shuffles antibody receptor genes into trillions of configurations before pathogens arrive.'),
    (40, 'Why can some animals regenerate limbs while humans cannot?', ['Biology', 'Genetics', 'Medicine', 'Evolution'], 'regeneration', 'refresh-cw', 'spokes', 'Axolotls unlock blastema stem cells to rebuild bones and nerves, while mammals seal wounds quickly with dense scar tissue.'),
    (41, 'Why does your brain sometimes create memories of things that never happened?', ['Neuroscience', 'Biology', 'Psychology'], 'confabulation', 'ghost', 'waves', 'Memory is reconstructive rather than recorded; each recall rewrites neural pathways with present context and expectations.'),
    (42, 'Why does music trigger memories so strongly?', ['Neuroscience', 'Psychology', 'Music', 'Biology'], 'auditory memory', 'music', 'waves', 'Auditory cortices maintain direct, unmediated superhighways into the limbic system, preserving emotions frozen in melody.'),
    (43, 'Why does your brain make you feel like you\'re falling when you\'re falling asleep?', ['Neuroscience', 'Biology', 'Psychology'], 'hypnic jerk', 'activity', 'waves', 'As motor control switches over to sleep paralysis, the brain misinterprets rapid muscle relaxation as a dangerous physical tumble.'),
    (44, 'Why do humans dream?', ['Neuroscience', 'Biology', 'Philosophy', 'Psychology'], 'dreams', 'sparkles', 'orbit', 'Rapid Eye Movement sleep runs neurochemical simulations to consolidate memories, defuse emotional trauma, and test threat scenarios.'),
    (45, 'Why does time seem to move faster as we get older?', ['Psychology', 'Neuroscience', 'Mathematics', 'Philosophy'], 'perception of time', 'clock', 'waves', 'Proportional theory and decreasing cognitive novelty mean each year represents a smaller percentage of your lived autobiographical timeline.'),
    (46, 'Why can\'t you tickle yourself?', ['Neuroscience', 'Biology', 'Psychology'], 'sensory gating', 'hand', 'grid', 'The cerebellum calculates an internal efference copy of your own movements, muting expected tactile sensations before they reach consciousness.'),
    (47, 'How does your brain decide what deserves your attention?', ['Neuroscience', 'Computer Science', 'Psychology'], 'attention', 'target', 'spokes', 'The thalamus and prefrontal cortex act as selective filters, suppressing ninety-nine percent of sensory input to spotlight survival priorities.'),
    (48, 'Why do humans see patterns that aren\'t really there?', ['Psychology', 'Mathematics', 'Neuroscience', 'Philosophy'], 'pareidolia', 'eye', 'matrix', 'Evolution favors type I false-positive errors: mistaking a harmless bush for a predator is far safer than mistaking a predator for a bush.'),
    (49, 'How does your body know when it is hungry?', ['Biology', 'Health & Body', 'Neuroscience', 'Psychology'], 'metabolism', 'heart-pulse', 'waves', 'Ghrelin released by an empty stomach communicates with hypothalamic receptors to trigger relentless neurological foraging drives.'),
    (50, 'How does your body maintain almost exactly the right temperature?', ['Biology', 'Health & Body', 'Medicine', 'Physics'], 'homeostasis', 'thermometer', 'waves', 'The preoptic hypothalamus orchestrates vasodilation, sweating, shivering, and metabolic adjustments to defend a fragile thirty-seven degrees.'),
    (51, 'How did humans measure time before clocks existed?', ['History', 'Astronomy', 'Civilizations', 'Mathematics'], 'ancient time', 'sun', 'spokes', 'Sundial shadows, burning graduated candles, and water-clock outflows mapped celestial cycles onto tangible human rituals.'),
    (52, 'Why are there 24 hours in a day and 60 minutes in an hour?', ['History', 'Astronomy', 'Civilizations', 'Mathematics'], 'sexagesimal', 'circle', 'spokes', 'Ancient Sumerians and Babylonians used base-sixty sexagesimal arithmetic because twelve finger knuckles and sixty divisors simplify divisions.'),
    (53, 'How did humans navigate across oceans without GPS?', ['History', 'Engineering', 'Geography', 'Mathematics', 'Ocean & Deep Sea'], 'celestial navigation', 'compass', 'orbit', 'Polynesians read wave swells and migratory birds, while sailors used astrolabes, cross-staffs, and polar stars to cross boundless oceans.'),
    (54, 'How did ancient civilizations build enormous structures without modern machines?', ['History', 'Architecture & Design', 'Civilizations', 'Engineering', 'Mathematics'], 'monumental engineering', 'landmark', 'grid', 'Ingenious levers, earthen ramps, hydraulic counterweights, and immense organized human coordination moved multi-ton megaliths.'),
    (55, 'How did the printing press transform human civilization?', ['History', 'Art & Culture', 'Social Science', 'Technology'], 'typography', 'book-open', 'grid', 'Movable metal type democratized knowledge, ignited the scientific revolution, and shattered centralized information monopolies.'),
    (56, 'How did humans first create accurate maps of the world?', ['History', 'Geography', 'Mathematics', 'Technology'], 'cartography', 'map', 'grid', 'Triangulation baselines, coastal dead reckoning, and marine chronometers slowly resolved distorted shorelines into reliable globes.'),
    (57, 'How did railways change the way humans understood time?', ['History', 'Engineering', 'Geography', 'Technology'], 'railway time', 'train', 'waves', 'High-speed locomotive schedules forced cities to abandon conflicting local solar sun-times in favor of synchronized standardized timezones.'),
    (58, 'Why do countries drive on different sides of the road?', ['History', 'Engineering', 'Geography', 'Social Science'], 'traffic history', 'split', 'grid', 'Medieval knights kept left to draw right-handed scabbards, while French teamsters and American freight wagons favored the right.'),
    (59, 'How did money evolve from physical objects into numbers in a computer?', ['Economics', 'Computer Science', 'History', 'Technology'], 'money evolution', 'coins', 'matrix', 'From cowrie shells to gold-backed certificates to digital central-bank ledger balances, money has always been an institutional web of trust.'),
    (60, 'How did writing emerge independently in different civilizations?', ['History', 'Anthropology', 'Civilizations', 'Linguistics'], 'epigraphy', 'feather', 'grid', 'Agricultural tallying and tax recording in Mesopotamia, Egypt, China, and Mesoamerica prompted pictograms to abstract into phonetic scripts.'),
    (61, 'How does a bank transfer actually move money between two banks?', ['Economics', 'Computer Science', 'Mathematics', 'Technology'], 'clearinghouse', 'arrow-left-right', 'matrix', 'No physical cash travels; centralized settlement accounts at central banks adjust reserve balances in automated batch ledgers.'),
    (62, 'How does a credit card payment travel from a shop to your bank?', ['Economics', 'Computer Science', 'Mathematics', 'Technology'], 'payment gateway', 'credit-card', 'matrix', 'Within three seconds, merchant acquirers, card networks, and issuing banks exchange encrypted tokens verifying risk and credit lines.'),
    (63, 'Why can\'t governments simply print unlimited money?', ['Economics', 'History', 'Mathematics', 'Politics'], 'monetary policy', 'banknote', 'waves', 'Expanding monetary supply faster than real economic output devalues currency, triggering hyperinflation and societal collapse.'),
    (64, 'How does inflation actually spread through an economy?', ['Economics', 'History', 'Mathematics', 'Psychology'], 'cantillon effect', 'trending-up', 'waves', 'The Cantillon effect dictates that new capital enriches first recipients before rippling outward as higher consumer prices everywhere.'),
    (65, 'How does the stock market actually work?', ['Economics', 'Mathematics', 'Psychology', 'Technology'], 'equities', 'candlestick-chart', 'waves', 'Continuous double auction order books match buyer bids and seller asks, aggregating global information into instantaneous prices.'),
    (66, 'How does an airline decide how much a ticket should cost?', ['Economics', 'Mathematics', 'Technology', 'Transportation'], 'dynamic pricing', 'plane', 'matrix', 'Yield management algorithms reprice seats continuously based on historical booking curves, seasonal demand, and competitor moves.'),
    (67, 'How does Amazon get a package from a warehouse to your doorstep?', ['Economics', 'Engineering', 'Geography', 'Technology'], 'logistics', 'package', 'grid', 'Random-stow robotics, predictive shipping algorithms, and hub-and-spoke sorting facilities turn supply chains into precision rivers.'),
    (68, 'How does a supermarket decide which products to put on its shelves?', ['Economics', 'Mathematics', 'Psychology', 'Social Science'], 'planogram', 'shopping-cart', 'grid', 'Slotting fees, eye-level shelf placements, and basket-analysis basket correlations optimize retail floor space down to centimeters.'),
    (69, 'How does a country keep millions of people supplied with electricity every second?', ['Engineering', 'Economics', 'Physics', 'Technology'], 'power grid', 'zap', 'grid', 'Grid operators balance instantaneous generation and load within fractions of a hertz, dispatching peaker plants to avert blackouts.'),
    (70, 'How does electricity actually travel through a wire?', ['Physics', 'Engineering', 'Mathematics', 'Technology'], 'electromagnetism', 'cable', 'waves', 'Individual electrons drift at centimeters per hour, but the Poynting electromagnetic field surrounding the conductor moves at lightspeed.'),
    (71, 'How does a battery store energy inside a tiny container?', ['Physics', 'Chemistry', 'Engineering', 'Technology'], 'electrochemistry', 'battery-charging', 'matrix', 'Chemical redox reactions force electrons through an external circuit as lithium ions shuttle between cathode and anode matrices.'),
    (72, 'How does an electric motor turn electricity into motion?', ['Physics', 'Engineering', 'Mathematics', 'Technology'], 'electromechanics', 'rotate-cw', 'spokes', 'Lorentz magnetic forces repel alternating stator coils, producing a revolving magnetic field that drags the rotor in endless rotation.'),
    (73, 'How does a refrigerator move heat from inside the fridge to the outside?', ['Physics', 'Chemistry', 'Engineering', 'Everyday Life'], 'thermodynamics', 'snowflake', 'waves', 'Phase-change refrigerants absorb internal thermal energy during liquid evaporation and dump it into room air during compression.'),
    (74, 'How does noise cancellation actually cancel sound?', ['Physics', 'Engineering', 'Mathematics', 'Technology'], 'acoustics', 'volume-x', 'waves', 'External microphones capture incoming sound waves and invert their phase by 180 degrees, causing destructive interference.'),
    (75, 'How does a touchscreen know exactly where you touched it?', ['Physics', 'Computer Science', 'Engineering', 'Technology'], 'capacitive touch', 'fingerprint', 'grid', 'A conductive grid of indium tin oxide detects the minute electrostatic disturbance caused by your finger’s natural capacitance.'),
    (76, 'How does a camera turn light into a photograph?', ['Physics', 'Art & Culture', 'Engineering', 'Technology'], 'imaging sensor', 'camera', 'matrix', 'Silicon photodiodes convert incoming photons into proportional electrical charges, filtered through a red-green-blue Bayer matrix.'),
    (77, 'How does an airplane stay in the air?', ['Physics', 'Engineering', 'Mathematics', 'Technology'], 'aerodynamics', 'navigation-2', 'waves', 'Cambered wings deflect air downwards while Bernoulli pressure differentials generate net upward lift opposing gravitational weight.'),
    (78, 'How does an airbag know the exact moment it should deploy?', ['Engineering', 'Computer Science', 'Physics', 'Transportation'], 'accelerometer', 'shield-alert', 'spokes', 'MEMS micromachined accelerometers detect catastrophic deceleration and ignite sodium azide gas canisters within thirty milliseconds.'),
    (79, 'How does a bridge distribute the weight of thousands of cars?', ['Engineering', 'Architecture & Design', 'Mathematics', 'Physics'], 'structural engineering', 'git-merge', 'grid', 'Trusses, suspension cables, and piers resolve complex gravitational loads into pure tension and compression vectors anchored in bedrock.'),
    (80, 'How does a submarine stay underwater without sinking to the bottom?', ['Engineering', 'Mathematics', 'Ocean & Deep Sea', 'Physics'], 'buoyancy', 'anchor', 'orbit', 'Variable ballast tanks flood with seawater or displace water with high-pressure air to achieve equilibrium buoyancy at exact depths.'),
    (81, 'How does a weather forecast predict what the atmosphere will do tomorrow?', ['Physics', 'Computer Science', 'Environment', 'Mathematics'], 'meteorology', 'cloud-sun', 'waves', 'Navier-Stokes fluid dynamics equations simulate atmospheric moisture, temperature, and planetary rotation on massive supercomputers.'),
    (82, 'How does a hurricane turn warm ocean water into a massive storm?', ['Environment', 'Geography', 'Ocean & Deep Sea', 'Physics'], 'cyclone', 'wind', 'spokes', 'Latent heat from evaporating seawater fuels an enormous thermodynamic heat engine twisted into cyclonic fury by the Coriolis effect.'),
    (83, 'Why does the climate change when Earth\'s atmosphere changes by such a small amount?', ['Environment', 'Chemistry', 'Geography', 'Physics'], 'climate science', 'globe', 'orbit', 'Trace greenhouse gases absorb longwave infrared reradiation, tilting planetary energy balance and triggering compounding feedback loops.'),
    (84, 'How does the ocean influence the weather on land?', ['Environment', 'Geography', 'Ocean & Deep Sea', 'Physics'], 'ocean currents', 'waves', 'waves', 'Thermohaline conveyor belts transport equatorial heat across global oceans, moderating coastal climates and steering storm tracks.'),
    (85, 'How does a satellite photograph Earth from space?', ['Space & Cosmos', 'Engineering', 'Geography', 'Physics', 'Technology'], 'remote sensing', 'satellite', 'matrix', 'Multispectral pushbroom sensors sweep lines of terrain across visible and infrared spectrums from five hundred miles above.'),
    (86, 'How does a map represent a three-dimensional planet on a flat surface?', ['Geography', 'History', 'Mathematics', 'Technology'], 'projections', 'map', 'grid', 'Because a sphere cannot be flattened without tearing, cartographic projections sacrifice area, shape, or distance by design.'),
    (87, 'Why do earthquakes happen?', ['Physics', 'Environment', 'Geography', 'Geology'], 'plate tectonics', 'activity', 'waves', 'Tectonic plates grind together along locked fault boundaries until stored elastic strain overcomes friction, rupturing in seismic waves.'),
    (88, 'How can scientists predict where a volcano might erupt?', ['Geology', 'Environment', 'Mathematics', 'Physics'], 'volcanology', 'flame', 'spokes', 'Seismic harmonic tremors, ground deformation tilts, and changing sulfur dioxide emissions herald magma rising beneath the crust.'),
    (89, 'How did humans evolve from earlier species?', ['Biology', 'Anthropology', 'Evolution', 'History'], 'paleoanthropology', 'footprints', 'spokes', 'Bipedal locomotion, tool mastery, dietary shifts, and encephalization over six million years diverged hominins from ancestral apes.'),
    (90, 'Why did humans become the dominant species on Earth?', ['Biology', 'Anthropology', 'Evolution', 'History', 'Social Science'], 'hominin dominance', 'users', 'spokes', 'Flexible symbolic language allowed large groups of strangers to cooperate around shared fictions, myths, and collective knowledge.'),
    (91, 'Why do humans cooperate with strangers?', ['Psychology', 'Evolution', 'Philosophy', 'Social Science'], 'game theory', 'handshake', 'orbit', 'Reciprocal altruism, social reputation, and group selection punish free riders and reward cooperative investment in shared survival.'),
    (92, 'Why do humans form governments?', ['Politics', 'Civilizations', 'History', 'Philosophy', 'Social Science'], 'social contract', 'building-2', 'grid', 'The Hobbesian security dilemma and common pool resource coordination lead societies to trade autonomy for centralized rule of law.'),
    (93, 'How did cities become possible?', ['History', 'Civilizations', 'Economics', 'Engineering', 'Geography'], 'urbanization', 'building', 'grid', 'Agricultural food surpluses freed specialized labor forces to congregate around trade nexuses, temples, and administrative hubs.'),
    (94, 'How does a language change over thousands of years?', ['Linguistics', 'Anthropology', 'History', 'Social Science'], 'historical linguistics', 'languages', 'waves', 'Phonetic drift, grammatical simplification, borrowing, and geographical separation evolve single ancestral tongues into language families.'),
    (95, 'Why are there thousands of human languages instead of one?', ['Linguistics', 'Anthropology', 'Geography', 'History'], 'linguistic diversity', 'message-circle', 'spokes', 'Topographical barriers, tribal divergence, and social identity barriers continually fracture speech into distinct dialects and tongues.'),
    (96, 'How do myths from completely different civilizations end up having similar themes?', ['Mythology & Folklore', 'Anthropology', 'History', 'Psychology'], 'comparative mythology', 'feather', 'orbit', 'Universal psychological archetypes, shared existential challenges, and ancient cultural migrations created the monomyth framework.'),
    (97, 'Why do humans create art?', ['Art & Culture', 'Anthropology', 'Neuroscience', 'Philosophy', 'Psychology'], 'aesthetics', 'palette', 'waves', 'Art externalizes internal mental landscapes, acts as fitness signaling, and creates emotional empathy bridges across time and space.'),
    (98, 'How did humans go from hunter-gatherers to building cities?', ['History', 'Agriculture', 'Anthropology', 'Civilizations', 'Economics'], 'neolithic transition', 'wheat', 'grid', 'The Neolithic Revolution anchored nomadic bands to cultivated fertile river valleys, sparking property, hierarchy, and specialization.'),
    (99, 'How did agriculture completely change human civilization?', ['History', 'Agriculture', 'Biology', 'Civilizations', 'Economics', 'Geography'], 'agrarian society', 'sprout', 'spokes', 'Farming created permanent settlements, population explosions, and surplus storage, but also infectious epidemics and systemic inequality.'),
    (100, 'Why does almost every civilization develop some form of mathematics?', ['Mathematics', 'Anthropology', 'Civilizations', 'History', 'Philosophy'], 'ethnomathematics', 'binary', 'matrix', 'Quantifying goods, mapping seasonal cycles, surveying land boundaries, and navigating by stars made mathematical logic an inevitable human discovery.')
]

def slugify(title):
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', title).lower()
    slug = re.sub(r'[\s]+', '-', slug).strip('-')
    return slug

all_topics = []
for num, title, tags, term, icon, style, blurb in topics_tuples:
    topic_id = slugify(title)
    category = tags[0]
    reading_time = '3 min' if num % 2 == 0 else '4 min'
    all_topics.append({
        'id': topic_id,
        'num': num,
        'title': title,
        'category': category,
        'tags': tags,
        'description': blurb,
        'blurb': blurb,
        'hook': blurb,
        'readingTime': reading_time,
        'svgKeywords': [term, category.lower(), icon],
        'svgTerm': term,
        'icon': icon,
        'abstractStyle': style,
        'content': []
    })

# 1. Output src/data/topics.js
js_content = 'export const TOPICS = ' + json.dumps(all_topics, indent=2) + ';\n'
with open('src/data/topics.js', 'w') as f:
    f.write(js_content)

# 2. Output src/data/prefetchedTopics.js
prefetched = []
for t in all_topics:
    prefetched.append({
        'id': t['id'],
        'title': t['title'],
        'description': t['description'],
        'category': t['category'],
        'tags': t['tags'],
        'readingTime': t['readingTime'],
        'svgTerm': t['svgTerm'],
        'icon': t['icon'],
        'abstractStyle': t['abstractStyle'],
        'imageTags': t['svgKeywords'],
        'introBody': t['description'],
        'content': []
    })

js_prefetched = 'export const PREFETCHED_TOPICS = ' + json.dumps(prefetched, indent=2) + ';\n'
with open('src/data/prefetchedTopics.js', 'w') as f:
    f.write(js_prefetched)

# 3. Output migrations/0002_seed_100_topics.sql
sql_lines = ['-- Seed 100 Curated Topics', 'DELETE FROM topics WHERE is_system = 1;']
now_ms = 1758960000000

for t in all_topics:
    title_esc = t['title'].replace("'", "''")
    cat_esc = t['category'].replace("'", "''")
    blurb_esc = t['blurb'].replace("'", "''")
    rtime_esc = t['readingTime']
    icon_esc = t['icon']
    style_esc = t['abstractStyle']
    cover_json = json.dumps({'term': t['svgTerm'], 'icon': icon_esc, 'style': style_esc}).replace("'", "''")
    content_json = '[]'
    
    sql = f"INSERT OR REPLACE INTO topics (id, title, category, blurb, reading_time, cover_image, content_data, is_system, created_by, created_at) VALUES ('{t['id']}', '{title_esc}', '{cat_esc}', '{blurb_esc}', '{rtime_esc}', '{cover_json}', '{content_json}', 1, NULL, {now_ms});"
    sql_lines.append(sql)

with open('migrations/0002_seed_100_topics.sql', 'w') as f:
    f.write('\n'.join(sql_lines) + '\n')

print(f"Successfully generated all 100 topics in src/data/topics.js, src/data/prefetchedTopics.js, and migrations/0002_seed_100_topics.sql")
