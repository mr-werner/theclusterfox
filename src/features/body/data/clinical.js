// The two clinical levels of explanation in BodyFox.
//
//   sport  Sports Medicine: how the part is used and trained, how it gets
//          hurt, and how it heals and returns to play.
//   med    Medical: precise anatomy, what goes wrong, how it is found and
//          treated, including what has no cure.
//
// GROUPS holds a write-up for every system and smaller group (keys as in
// model/systems.js: "layer/group" or "layer/group/sub"), so every part has
// text. PART_NOTES add detail for well-known parts; the first match wins,
// tested against the name without "left"/"right".
// Written for learning. It is not medical advice.

export const GROUPS = {
  // ---------- Skin ----------
  "skin/skin": {
    sport: "Skin takes friction, sun and impact. Blisters and chafing come from repeated rubbing: dry, well-fitted kit and early taping prevent them. Cuts and grazes need cleaning and covering, and athletes training outdoors need sunscreen year round. Sweat is the main way the body sheds heat in exercise, so heat illness risk rises with humidity, heavy kit and poor fitness.",
    med: "Epidermis (stratified squamous epithelium) over dermis (collagen, vessels, nerves, glands) over subcutaneous fat. Common problems: eczema, psoriasis, acne, infections (cellulitis, impetigo, fungal), burns (graded by depth) and pressure ulcers. Skin cancers: basal cell carcinoma (most common, rarely spreads; excision), squamous cell carcinoma, and melanoma (can spread; wide excision, sentinel node biopsy, immunotherapy for advanced disease). Melanoma is checked with ABCDE: asymmetry, border, colour, diameter, evolution.",
  },
  "skin/hair": {
    sport: "Hair has little sporting role beyond heat and sun protection for the scalp.",
    med: "Hair grows in cycles (anagen, catagen, telogen). Hair loss can be patterned (androgenetic alopecia; minoxidil, finasteride), patchy and autoimmune (alopecia areata; steroids, JAK inhibitors), or diffuse after stress, illness or iron deficiency (telogen effluvium, usually recovers). Scarring alopecias destroy follicles and cannot regrow.",
  },

  // ---------- Muscles ----------
  "muscles/head": {
    sport: "Head and face muscles matter for chewing and expression rather than sport. Jaw clenching under heavy effort is common; mouthguards protect the teeth and jaw in contact sports.",
    med: "Facial muscles are run by the facial nerve (VII) and the chewing muscles by the trigeminal nerve (V3). Bell's palsy weakens one side of the face suddenly; most recover in weeks to months, helped by early steroids. A stroke spares the forehead, which helps tell it apart from Bell's palsy.",
  },
  "muscles/head/face": {
    sport: "Facial muscles take no load in sport, but facial cuts and bruises are common in contact sports and need checking for fractures beneath.",
    med: "Muscles of facial expression insert into skin and are supplied by the facial nerve (VII). Problems: Bell's palsy (idiopathic VII palsy; steroids within 72 hours, eye protection), facial nerve damage from parotid surgery or trauma, and hemifacial spasm (botulinum toxin injections).",
  },
  "muscles/head/chewing": {
    sport: "Clenching during heavy lifts loads the jaw muscles and joint. A custom mouthguard spreads blows across the teeth and reduces jaw injuries in contact sports.",
    med: "Masseter, temporalis and the pterygoids (trigeminal nerve V3) move the temporomandibular joint (TMJ). Temporomandibular disorders cause jaw pain, clicking and limited opening: treated with soft diet, night splints, physiotherapy and stress management. Trismus (lockjaw) can follow dental infection, radiotherapy or tetanus.",
  },
  "muscles/head/eye": {
    sport: "Eye muscles track fast-moving balls and opponents. Blows to the orbit can trap an eye muscle in a floor fracture, causing double vision on looking up: that needs urgent review.",
    med: "Four recti and two obliques move the eye (nerves III, IV, VI). Problems: strabismus (squint; glasses, patching, surgery), cranial nerve palsies (from diabetes, aneurysm, raised pressure), thyroid eye disease (swollen muscles; steroids, teprotumumab, surgery) and myasthenia gravis (fatigable droop and double vision).",
  },
  "muscles/head/mouth": {
    sport: "Throat muscles matter for breathing and swallowing under effort; little direct sports injury.",
    med: "Tongue, palate and pharyngeal muscles control swallowing and speech. Weakness (dysphagia) after stroke, in motor neurone disease or myasthenia raises the risk of choking and aspiration pneumonia; speech and swallowing therapy and diet changes help, and some need feeding tubes. Obstructive sleep apnoea is the throat collapsing in sleep (CPAP, weight loss).",
  },
  "muscles/neck": {
    sport: "Neck muscles hold the head steady against impact. Stronger necks are linked to fewer concussions in contact sports, so neck strengthening is standard in rugby, football and combat sports. Whiplash-type strains and 'stingers' (a brief burning arm from a nerve stretch) are common.",
    med: "Neck muscles move the head and cervical spine. Problems: acute torticollis (wry neck; heat, analgesia, gentle movement), whiplash-associated disorder, cervical dystonia (involuntary twisting; botulinum toxin) and neck pain from degenerative disc and facet disease. Red flags: weakness in the arms, numbness, unsteady walking (myelopathy), fever or major trauma need urgent imaging.",
  },
  "muscles/trunk": {
    sport: "The trunk transfers force between legs and arms. Core stability training (bracing, anti-rotation, loaded carries) underpins lifting, throwing and running. Common injuries: rib-muscle strains in rowers and throwers, abdominal strains, and back muscle strains from lifting.",
    med: "Trunk muscles stabilise the spine, power breathing and wall in the abdomen. Problems include hernias through weak spots, muscle strains, rib injuries, and diastasis recti (separation of the rectus muscles after pregnancy; exercise, rarely surgery).",
  },
  "muscles/trunk/chest": {
    sport: "Chest muscles drive pushing, throwing and tackling. The pectoralis major tendon can tear in heavy bench pressing, usually when the bar is lowered under load: sudden pain, bruising and a changed chest contour. Early surgical repair gives the best strength.",
    med: "Pectoralis major and minor (medial and lateral pectoral nerves) and serratus anterior (long thoracic nerve). Long thoracic nerve injury causes a winged scapula. Pectoralis major rupture is repaired surgically within weeks for active people; Poland syndrome is congenital absence of part of the muscle.",
  },
  "muscles/trunk/breathing": {
    sport: "The diaphragm and rib muscles set breathing capacity. Inspiratory muscle training can modestly help endurance athletes. A 'stitch' is pain under the ribs in running, eased by slowing and deep breathing. Rib stress fractures and intercostal strains occur in rowing and throwing.",
    med: "The diaphragm (phrenic nerve C3 to C5) does most of the work of breathing; intercostals lift the ribs. Problems: diaphragm paralysis (phrenic nerve injury), diaphragmatic hernia (congenital or traumatic; surgery), respiratory muscle weakness in neuromuscular disease (needs breathing support, often non-invasive ventilation at night), and costochondritis (chest wall pain; self-limiting).",
  },
  "muscles/trunk/belly": {
    sport: "Abdominal muscles brace the trunk for lifting and rotate it for throwing and swinging. Strains of the oblique (side strain) are common in cricket bowlers and baseball pitchers and take 3 to 6 weeks. 'Sports hernia' (athletic pubalgia) is groin pain where abdominal muscles meet the pubis; rest and rehab first, surgery if it fails.",
    med: "Rectus abdominis, external and internal obliques and transversus abdominis form the abdominal wall. Problems: inguinal and umbilical hernias (surgical repair, mesh), incisional hernias after surgery, rectus sheath haematoma (often with anticoagulants) and diastasis recti.",
  },
  "muscles/trunk/back": {
    sport: "Back muscles extend and stabilise the spine and move the shoulder blades. Acute low back strain is the most common back injury: staying active, with gradual loading, beats bed rest. Deadlifts, rows and back extensions build strength; poor bracing under fatigue is a common cause of strain.",
    med: "Superficial back muscles move the scapula and arm; the erector spinae and multifidus hold the spine. Most low back pain is non-specific and settles within 6 weeks with activity and simple pain relief. Red flags: numbness in the saddle area, bladder or bowel changes (cauda equina syndrome, a surgical emergency), fever, weight loss, cancer history or major trauma.",
  },
  "muscles/arms": {
    sport: "Arm muscles throw, lift, hold and swing. Overuse injuries dominate: tendinopathy at the shoulder, elbow and wrist from repeated loading. Load management, gradual progression and strengthening the whole chain (legs and trunk too) prevent most of them.",
    med: "Upper limb muscles are supplied by the brachial plexus (C5 to T1). Nerve entrapments (carpal tunnel, cubital tunnel) and plexus injuries cause weakness and numbness in typical patterns, which help locate the problem.",
  },
  "muscles/arms/shoulder": {
    sport: "The rotator cuff holds the ball in the socket during throwing, swimming and pressing. Overload causes cuff tendinopathy and impingement (pain lifting the arm overhead); a fall or heavy pull can tear it. Most respond to cuff and shoulder-blade strengthening and load management; full-thickness tears in young, active people are often repaired. Return to throwing follows a graded interval programme.",
    med: "Deltoid (axillary nerve), supraspinatus and infraspinatus (suprascapular nerve), teres minor (axillary) and subscapularis (subscapular nerves). Problems: rotator cuff tears (degenerative with age; physiotherapy, injection, surgical repair or reverse shoulder replacement for massive tears), calcific tendinitis, frozen shoulder (adhesive capsulitis; months-long natural course, injection, hydrodilatation), and axillary nerve injury after dislocation (numb patch over the deltoid).",
  },
  "muscles/arms/upper-arm": {
    sport: "Biceps and triceps bend and straighten the elbow and help the shoulder. The distal biceps tendon can rupture lifting heavy loads with the elbow bent: a 'Popeye' bulge and weak turning of the forearm; early surgery within 2 to 3 weeks restores strength. Triceps tendon ruptures are rare but seen in weightlifters, especially with steroid use.",
    med: "Biceps, brachialis and coracobrachialis (musculocutaneous nerve) flex the elbow; triceps (radial nerve) extends it. Long head of biceps tendinopathy and rupture (often managed without surgery in older people), distal biceps rupture (surgical reattachment), and radial nerve palsy from mid-humerus fractures (wrist drop; most recover).",
  },
  "muscles/arms/forearm": {
    sport: "Forearm muscles grip and control the wrist. Tennis elbow (outer elbow, extensors) and golfer's elbow (inner elbow, flexors) are overload tendinopathies: eased by load reduction, progressive strengthening and sometimes a brace. In climbers and rowers, forearm compartment pain can come from swelling within tight muscle compartments.",
    med: "Flexors (median and ulnar nerves) and extensors (radial nerve) move the wrist and fingers. Problems: lateral and medial epicondylopathy (usually settle in 6 to 12 months; injections give short-term relief), De Quervain's tenosynovitis (thumb side of the wrist; splint, injection, release), and acute compartment syndrome after fractures or crush injury (a surgical emergency: fasciotomy).",
  },
  "muscles/arms/hand": {
    sport: "Small hand muscles give grip precision. Climbers injure finger pulleys (a 'pop' and pain at the base of a finger); most heal with taping and a graded return. Jammed fingers in ball sports can hide tendon ruptures (mallet finger, jersey finger) that need splinting or surgery.",
    med: "Thenar, hypothenar, lumbricals and interossei (median and ulnar nerves). Wasting of the thenar muscles points to carpal tunnel syndrome; of the interossei, to ulnar nerve damage. Dupuytren's contracture (thickened palm fascia pulling fingers down; needle release, collagenase, surgery) and trigger finger (injection, release).",
  },
  "muscles/legs": {
    sport: "Leg muscles absorb landing forces and power running and jumping. Muscle strains (hamstring, quadriceps, adductor, calf) are the most common injuries in field sports. Eccentric strengthening (Nordic curls for hamstrings, Copenhagen adductor work) cuts injury rates substantially.",
    med: "Lower limb muscles are supplied by the lumbar and sacral plexuses. Deep vein thrombosis in the calf presents as swelling and pain; it must not be confused with a strain. Compartment syndromes, rhabdomyolysis after extreme exertion (dark urine; needs IV fluids) and muscular dystrophies also affect these muscles.",
  },
  "muscles/legs/hip": {
    sport: "Glutes drive sprinting, jumping and stable single-leg landing; weak hip abductors are linked to knee pain and ACL injury. Gluteal tendinopathy (outer hip pain lying on that side) and hip flexor strains (kicking, sprinting) are common. Hip thrusts, single-leg squats and lateral work build them.",
    med: "Gluteus maximus (inferior gluteal nerve), medius and minimus (superior gluteal nerve), and the deep rotators. Problems: greater trochanteric pain syndrome (gluteal tendinopathy; exercise, avoid crossing legs, injection), Trendelenburg gait from abductor weakness, piriformis syndrome (sciatic irritation), and iliopsoas bursitis.",
  },
  "muscles/legs/thigh": {
    sport: "Hamstring strains are the most common injury in sprinting sports: a sudden pull at the back of the thigh at top speed. Most return in 2 to 6 weeks with a graded running programme; tendon avulsions from the sitting bone need surgery. Quadriceps strains come from kicking; a 'dead leg' (thigh contusion) should be iced and gently stretched early to prevent bone forming in the muscle (myositis ossificans).",
    med: "Quadriceps (femoral nerve) extend the knee; hamstrings (sciatic nerve) flex the knee and extend the hip; adductors (obturator nerve) pull the thigh in. Problems: strains graded by MRI, proximal hamstring avulsion (surgical repair), quadriceps tendon rupture (surgical), myositis ossificans, and femoral nerve palsy (weak knee extension).",
  },
  "muscles/legs/lower-leg": {
    sport: "Calf muscles store and release energy in every running stride. Calf strains ('tennis leg') and Achilles tendinopathy come from sudden increases in running or jumping. Shin splints (medial tibial stress syndrome) are bone and muscle-attachment overload. Heavy, slow calf raises are the backbone of rehab.",
    med: "Gastrocnemius and soleus (tibial nerve) plantarflex the ankle; tibialis anterior (deep fibular nerve) dorsiflexes it. Problems: Achilles rupture (casting in a boot or surgery; similar outcomes with modern rehab), chronic exertional compartment syndrome (pain that builds with running; fasciotomy), foot drop from common fibular nerve injury at the knee, and calf deep vein thrombosis.",
  },
  "muscles/legs/foot": {
    sport: "Small foot muscles support the arch and fine-tune balance. Plantar heel pain (plantar fasciopathy) is common in runners: calf and foot strengthening, load changes and supportive shoes help most within months.",
    med: "Intrinsic foot muscles (medial and lateral plantar nerves) support the arches. Weakness from neuropathy (for example in diabetes) leads to claw toes and pressure ulcers. Plantar fasciopathy (stretching, strengthening, orthoses, shockwave, injection), Morton's neuroma (between the toes; wider shoes, injection, excision).",
  },
  "muscles/pelvic-floor": {
    sport: "The pelvic floor works with the diaphragm and deep abdominals to brace under load. Leakage during jumping or heavy lifts is common, especially after childbirth, and is not inevitable: pelvic floor training with a specialist physio fixes most.",
    med: "Levator ani and coccygeus (pudendal nerve and sacral branches) support the pelvic organs. Problems: stress urinary incontinence (pelvic floor training first, then slings), pelvic organ prolapse (pessary or surgery), faecal incontinence, and pelvic floor dysfunction causing pain or constipation. Childbirth injury is the most common cause.",
  },
  "muscles/connective": {
    sport: "Tendons and fascia transmit force and store elastic energy. They adapt more slowly than muscle (months, not weeks), so tendons are the weak link when training jumps suddenly. Iliotibial band syndrome causes outer knee pain in runners and cyclists.",
    med: "Dense collagen tissue with a poor blood supply, so it heals slowly. Tendinopathy is failed healing rather than inflammation; progressive loading is the main treatment. Fluoroquinolone antibiotics and steroids raise rupture risk.",
  },

  // ---------- Skeleton ----------
  "skeleton/skull": {
    sport: "The skull protects the brain, but concussion happens without a fracture. Any suspected concussion means leaving play that day and a graded return. Helmets prevent skull fractures and severe brain injury; they do not prevent concussion.",
    med: "Cranial vault and facial skeleton. Skull fractures: linear (often observed), depressed (may need surgery), and basal (bruising behind the ears or around the eyes, clear fluid from the nose; risk of meningitis). An extradural haematoma after a temple blow can follow a 'lucid interval' and needs urgent surgery.",
  },
  "skeleton/skull/cranium": {
    sport: "Facial bones are injured by elbows, balls and sticks. Broken noses are common; cheekbone and eye-socket fractures need specialist review. Face shields and mouthguards reduce injury.",
    med: "Facial fractures follow patterns (nasal, zygomatic, orbital floor 'blow-out', Le Fort I to III, mandible). Treatment ranges from observation to plating. Other conditions: craniosynostosis in infants (early fusion of skull sutures; surgery), Paget's disease of bone, and sinusitis.",
  },
  "skeleton/skull/teeth": {
    sport: "Knocked-out adult teeth can be saved: hold by the crown, rinse briefly, put back in the socket or store in milk, and see a dentist within an hour. Mouthguards prevent most dental injuries.",
    med: "Enamel, dentine and pulp in a periodontal ligament socket. Problems: dental caries (fluoride, fillings, root canal), periodontitis (gum disease; cleaning, linked to heart disease and diabetes), abscesses (drainage, antibiotics), impacted wisdom teeth and tooth loss.",
  },
  "skeleton/skull/ear": {
    sport: "Ear bones are protected deep in the skull. Barotrauma from diving or flying hurts the eardrum rather than these bones.",
    med: "Malleus, incus and stapes conduct sound. Otosclerosis fixes the stapes (conductive hearing loss; hearing aids or stapedotomy). Chronic ear infection and cholesteatoma erode the ossicles (surgery, reconstruction).",
  },
  "skeleton/spine": {
    sport: "The spine takes load in every sport. Stress fractures of the lower vertebrae (spondylolysis) are a common cause of back pain in teenage fast bowlers, gymnasts and divers: pain arching backwards; rest from extension and rehab, usually 3 months. Disc injuries come from repeated flexion under load.",
    med: "Vertebral column with discs, facet joints and ligaments around the spinal cord. Problems: disc herniation with sciatica (most settle in 6 to 12 weeks; surgery for persistent or severe weakness), spinal stenosis, spondylolisthesis, scoliosis, osteoporotic compression fractures, ankylosing spondylitis, and spinal cord injury (no cure; rehabilitation). Cauda equina syndrome is an emergency.",
  },
  "skeleton/spine/neck": {
    sport: "Neck vertebrae are vulnerable in diving into shallow water, rugby scrums and spear tackles. Any player with neck pain plus numbness or weakness after impact must be immobilised and not moved by untrained people.",
    med: "Seven cervical vertebrae; C1 and C2 allow nodding and rotation. Problems: cervical spondylosis, radiculopathy (arm pain from a trapped nerve root), myelopathy (cord compression; surgery to decompress), and fractures (assessed with clinical rules and CT). Rheumatoid arthritis can make C1 and C2 unstable.",
  },
  "skeleton/spine/mid-back": {
    sport: "The thoracic spine needs rotation for throwing, golf and swimming. Stiffness here pushes load to the shoulders and lower back. Rib joint sprains are a source of sharp mid-back pain in rowers.",
    med: "Twelve thoracic vertebrae joined to the ribs. Problems: Scheuermann's kyphosis in adolescents, osteoporotic wedge fractures (height loss, stooping; bone protection drugs), and metastatic cancer (the spine is the most common site for bone metastases).",
  },
  "skeleton/spine/low-back": {
    sport: "Lumbar vertebrae carry the most load. Spondylolysis (stress fracture of the pars interarticularis) is the top serious cause of back pain in young athletes. Deadlift and squat technique, gradual loading and trunk strength protect the low back.",
    med: "Five lumbar vertebrae. Problems: mechanical low back pain, disc herniation (L4/5 and L5/S1 most often), spondylolisthesis (one vertebra slipping forward; physiotherapy or fusion), lumbar spinal stenosis (leg pain on walking eased by bending forward; decompression).",
  },
  "skeleton/spine/tailbone": {
    sport: "Falls onto the bottom bruise or fracture the coccyx (common in skating and gymnastics). Painful sitting can last weeks; a cushion with a cut-out helps.",
    med: "Sacrum and coccyx. Problems: coccydynia (injection, rarely removal), sacral insufficiency fractures in osteoporosis, sacroiliac joint dysfunction and sacroiliitis (in spondyloarthritis).",
  },
  "skeleton/spine/disks": {
    sport: "Discs tolerate load well but dislike repeated bending and twisting under heavy weight. Most disc bulges seen on scans in athletes cause no pain. After a disc injury, gradual return to loaded flexion is the goal.",
    med: "Annulus fibrosus around a gel nucleus pulposus. With age discs dry and lose height (degeneration, often painless). Herniation can compress a nerve root (sciatica) and usually shrinks by itself; epidural steroid injection or discectomy for persistent cases. Discitis is infection (antibiotics).",
  },
  "skeleton/ribcage": {
    sport: "Rib fractures and bruising come from tackles and falls; a hard blow can rarely puncture a lung (breathlessness needs urgent review). Rib stress fractures occur in rowers. Pain relief that allows deep breathing prevents chest infections.",
    med: "Ribs, costal cartilages and sternum. Problems: rib fractures (multiple adjacent fractures can cause a flail segment; analgesia, sometimes fixation), pneumothorax, costochondritis, pectus excavatum and carinatum (chest wall deformities; bracing or surgery).",
  },
  "skeleton/ribcage/ribs": {
    sport: "A cracked rib takes about 6 weeks to heal; padding helps return to contact sports. Rowers get rib stress fractures from repetitive pull.",
    med: "Twelve pairs. Fractures (analgesia and breathing exercises), cervical ribs compressing the brachial plexus (thoracic outlet syndrome), and bone metastases.",
  },
  "skeleton/ribcage/breastbone": {
    sport: "Sternal fractures come from steering wheels and heavy direct blows; rare in sport but can come with heart bruising.",
    med: "Manubrium, body and xiphoid. Sternotomy (splitting the sternum) is the usual route for heart surgery; it heals over about 6 to 8 weeks. Sternal fractures may need heart monitoring.",
  },
  "skeleton/ribcage/cartilage": {
    sport: "Costal cartilage can tear from the rib in impact sports (a 'rib tip' injury), painful for weeks.",
    med: "Costochondritis and Tietze syndrome cause chest wall pain and tenderness; self-limiting, but heart causes of chest pain must be ruled out first.",
  },
  "skeleton/arms": {
    sport: "Arm bones break most often from falls on an outstretched hand. Throwers develop adaptive bone changes in the dominant arm. Collarbone and wrist fractures are among the most common sports fractures.",
    med: "Upper limb skeleton. Fractures are classified by site and displacement; many heal in a cast or sling, displaced or joint-involving fractures often need fixation.",
  },
  "skeleton/arms/shoulder": {
    sport: "Collarbone fractures come from falls onto the shoulder (cycling, rugby); most heal in a sling in 6 to 12 weeks, though shortened or badly displaced ones may be plated. AC joint sprains ('separated shoulder') are graded I to VI; most return in weeks. Shoulder dislocations in young athletes recur often; surgery to stabilise is common after a first dislocation in contact sports.",
    med: "Clavicle and scapula with the glenohumeral and acromioclavicular joints. Problems: dislocation (anterior in 95%; reduction, rehab, stabilisation), Bankart and Hill-Sachs lesions, osteoarthritis (shoulder replacement), and scapular fractures (usually from high-energy trauma).",
  },
  "skeleton/arms/arm": {
    sport: "Elbow injuries in young throwing athletes ('Little League elbow') come from too many pitches: pitch counts protect them. Elbow dislocation from falls is the second most common major joint dislocation. Forearm fractures heal in 6 to 8 weeks; return to contact sport later.",
    med: "Humerus, radius and ulna. Problems: proximal humerus fractures in older people (sling or surgery), supracondylar fractures in children (risk to the brachial artery), radial head fractures, ulnar collateral ligament tears in throwers (reconstruction, 'Tommy John'), and Colles' fracture of the distal radius.",
  },
  "skeleton/arms/hand": {
    sport: "Scaphoid fractures after a fall on the hand are easy to miss: pain in the 'anatomical snuffbox' needs treating as a fracture until proven otherwise, as missed ones can die off. Boxer's fractures (fifth metacarpal) and finger dislocations are common.",
    med: "8 carpals, 5 metacarpals, 14 phalanges. Problems: scaphoid fracture (avascular necrosis risk; cast or screw), carpal instability, osteoarthritis at the thumb base (splints, injection, trapeziectomy), and rheumatoid arthritis deformities.",
  },
  "skeleton/legs": {
    sport: "Leg bones take high repeated loads; stress fractures follow sudden increases in running, low energy availability or low vitamin D. High-risk sites (front of the shin, femoral neck, navicular) need prompt imaging.",
    med: "Lower limb skeleton. Hip fractures in older people are a major cause of disability and death; early surgery and mobilisation improve outcomes. Osteoarthritis of the hip and knee is the leading cause of joint replacement.",
  },
  "skeleton/legs/pelvis": {
    sport: "Avulsion fractures of the pelvis occur in teenage sprinters and kickers when a muscle pulls off a piece of growing bone. Pubic bone stress injury (osteitis pubis) causes groin pain in footballers. Hip impingement (FAI) limits deep hip bending.",
    med: "Hip bones and sacrum form the pelvic ring. Problems: pelvic ring fractures (high-energy; can bleed heavily, binder and fixation), acetabular fractures, hip dysplasia (missed in infancy, early arthritis), femoroacetabular impingement and labral tears (physiotherapy or arthroscopy).",
  },
  "skeleton/legs/leg": {
    sport: "The knee is the most injured joint in sport: ACL tears (twist on landing; reconstruction and 9 to 12 months of rehab for return to cutting sports), meniscus tears, and kneecap dislocation. Tibial stress fractures in runners heal in 6 to 8 weeks of reduced load.",
    med: "Femur, patella, tibia, fibula. Problems: neck of femur fracture (hemiarthroplasty or fixation), femoral shaft fracture (nailing), tibial plateau and shaft fractures, knee osteoarthritis (exercise, weight loss, injection, knee replacement), osteosarcoma in teenagers around the knee.",
  },
  "skeleton/legs/foot": {
    sport: "Ankle sprains are the most common sports injury: most rehabilitate well with early movement and balance training, which also prevents the high re-injury rate. Fifth metatarsal fractures and navicular stress fractures can heal slowly and sometimes need surgery.",
    med: "7 tarsals, 5 metatarsals, 14 phalanges. Problems: ankle fractures (Weber classification; cast or fixation), Lisfranc injuries (easily missed midfoot injuries), bunions (hallux valgus), gout at the big toe, and Charcot foot in diabetic neuropathy (offloading).",
  },
  "skeleton/joints": {
    sport: "Ligaments stabilise joints and heal slowly; cartilage hardly heals at all. Protecting joints with strength, landing technique and gradual load matters more than braces.",
    med: "Articular cartilage has no blood supply, so damage tends to progress to osteoarthritis. Inflammatory arthritis (rheumatoid, psoriatic, gout) attacks joints from within; disease-modifying drugs prevent damage.",
  },
  "skeleton/joints/cartilage": {
    sport: "Cartilage injuries in the knee come with ligament tears or kneecap dislocations. Smaller defects can be repaired (microfracture, transplant), with long rehab. Nose and ear cartilage are hit in contact sports: an untreated ear haematoma becomes 'cauliflower ear', so it should be drained.",
    med: "Hyaline cartilage in joints, airways and nose; fibrocartilage in discs and menisci. Problems: osteoarthritis, chondromalacia, relapsing polychondritis (autoimmune inflammation of ear, nose and airway cartilage), and laryngeal cartilage fractures from neck trauma.",
  },
  "skeleton/joints/ligaments": {
    sport: "Sprains are graded I (stretched) to III (torn). Most heal with early protected movement and progressive loading; some, like the ACL, don't heal and need reconstruction for return to pivoting sports.",
    med: "Dense collagen bands linking bone to bone. Ligamentous laxity can be generalised (hypermobility syndromes, Ehlers-Danlos) and predispose to dislocations. Spinal ligament calcification occurs in ankylosing spondylitis and DISH.",
  },

  // ---------- Organs ----------
  "organs/digestive": {
    sport: "The gut supplies energy during long events. Endurance athletes often get cramps, nausea or diarrhoea from reduced gut blood flow: training the gut with race-day fuel, avoiding high-fibre and high-fat food before events and staying hydrated helps.",
    med: "From mouth to anus with liver, pancreas and gallbladder. Major conditions: reflux, peptic ulcer, inflammatory bowel disease, coeliac disease, irritable bowel syndrome, gallstones, pancreatitis, liver disease and colorectal cancer (screening saves lives).",
  },
  "organs/digestive/mouth": {
    sport: "Dry mouth and sugary sports drinks raise dental decay in athletes; rinse with water and keep up dental checks.",
    med: "Mouth, salivary glands, pharynx and oesophagus. Problems: oral cancer (smoking, alcohol, HPV), salivary stones, gastro-oesophageal reflux (lifestyle, acid suppression), Barrett's oesophagus (surveillance), oesophageal cancer, and achalasia (failed relaxation of the lower sphincter; dilation or surgery).",
  },
  "organs/digestive/stomach": {
    sport: "Eat a familiar, low-fibre meal 2 to 4 hours before exercise. Painkillers like ibuprofen before endurance events raise the risk of stomach bleeding and kidney injury.",
    med: "Fundus, body and antrum make acid and pepsin. Problems: gastritis and peptic ulcers (Helicobacter pylori and NSAIDs; eradication therapy, acid suppression), upper GI bleeding (endoscopy), gastric cancer, and gastroparesis (in diabetes).",
  },
  "organs/digestive/liver": {
    sport: "The liver stores glycogen used in long efforts. A blow to the right upper abdomen can injure it. Anabolic steroids and some supplements can damage the liver.",
    med: "The liver processes nutrients, drugs and toxins and makes proteins and bile. Problems: fatty liver disease (now the most common cause; weight loss), alcohol-related liver disease, viral hepatitis B and C (antivirals; C is curable), cirrhosis (complications include bleeding varices and fluid; transplant for end stage), liver cancer, and gallstones (cholecystectomy for symptoms).",
  },
  "organs/digestive/pancreas": {
    sport: "Athletes with type 1 diabetes adjust insulin and carbohydrate around training to prevent low blood sugar, which can happen hours after exercise.",
    med: "Exocrine enzymes and endocrine islets. Problems: acute pancreatitis (gallstones and alcohol; supportive care), chronic pancreatitis (pain, enzyme replacement), type 1 and type 2 diabetes, and pancreatic cancer (often found late; surgery when possible, chemotherapy).",
  },
  "organs/digestive/small-intestine": {
    sport: "Most fuel is absorbed here. Multiple carbohydrate types (glucose plus fructose) increase how much can be absorbed per hour during long events.",
    med: "Duodenum, jejunum and ileum. Problems: coeliac disease (gluten-free diet for life), Crohn's disease (immunosuppression, biologics, surgery; no cure), small bowel obstruction (adhesions, hernias), and B12 malabsorption after ileal disease.",
  },
  "organs/digestive/large-intestine": {
    sport: "'Runner's trots' (urgent diarrhoea in long runs) is common; adjusting food timing and fibre helps.",
    med: "Caecum, colon, rectum. Problems: appendicitis (appendicectomy or antibiotics), diverticular disease, ulcerative colitis (aminosalicylates, biologics, colectomy can cure it), irritable bowel syndrome, and colorectal cancer (screening, polyp removal, surgery, chemotherapy).",
  },
  "organs/breathing": {
    sport: "Lungs rarely limit healthy athletes, but exercise-induced bronchoconstriction (asthma triggered by exercise, cold dry air or pool chlorine) is common. An inhaler before exercise and warm-ups help.",
    med: "Airways and lungs. Major conditions: asthma, COPD (stopping smoking, inhalers, pulmonary rehab), pneumonia, pulmonary embolism, interstitial lung disease, lung cancer, and pneumothorax.",
  },
  "organs/breathing/airways": {
    sport: "Exercise-induced asthma is common in endurance and winter athletes. Vocal cord dysfunction mimics it (noisy breathing in, not out) and needs a different treatment: speech therapy breathing techniques.",
    med: "Larynx, trachea and bronchial tree. Problems: asthma (inhaled steroids and relievers), bronchiectasis (airway clearance), chronic bronchitis, inhaled foreign bodies (right main bronchus more often), laryngeal cancer and croup in children.",
  },
  "organs/breathing/lungs": {
    sport: "Spontaneous pneumothorax (collapsed lung) is most common in tall, thin young men: sudden one-sided chest pain and breathlessness. After it heals, flying and diving have strict rules. Altitude training works by the body adapting to lower oxygen.",
    med: "Lobes of lung with about 300 million alveoli. Problems: pneumonia (antibiotics), COPD, pulmonary fibrosis (antifibrotic drugs slow it; transplant), pulmonary embolism (anticoagulation), lung cancer (surgery, radiotherapy, targeted drugs, immunotherapy) and cystic fibrosis (CFTR modulators).",
  },
  "organs/urinary": {
    sport: "Dark urine after extreme exercise can mean rhabdomyolysis (muscle breakdown) and needs urgent fluids. Blood in the urine after long runs is often harmless but needs checking if it lasts. Anti-inflammatory painkillers plus dehydration can injure the kidneys.",
    med: "Kidneys, ureters, bladder, urethra. Problems: urinary tract infections, kidney stones (fluids, painkillers, lithotripsy), acute kidney injury, chronic kidney disease (blood pressure control, dialysis, transplant), bladder and kidney cancer, and an enlarged prostate in men.",
  },
  "organs/reproductive": {
    sport: "Low energy availability (eating too little for training) disrupts hormones in all athletes: missed periods in women, low testosterone in men, and weaker bones in both (REDs, relative energy deficiency in sport). It needs more fuel, not just rest.",
    med: "Gonads, ducts and accessory organs. Major conditions: infertility, sexually transmitted infections, and cancers of the cervix (screening and HPV vaccination), ovary, uterus, prostate, testis and breast.",
  },
  "organs/reproductive/female": {
    sport: "Training can continue through the menstrual cycle; tracking symptoms helps plan. Exercise in a healthy pregnancy is safe and recommended, avoiding contact and falls. After birth, return to running is graded over about 12 weeks with pelvic floor rehab.",
    med: "Ovaries, uterine tubes, uterus, cervix, vagina. Problems: endometriosis (pain and infertility; hormones, surgery; no cure), fibroids, polycystic ovary syndrome, ectopic pregnancy (an emergency), pelvic inflammatory disease, and cancers of the cervix, uterus and ovary.",
  },
  "organs/reproductive/breast": {
    sport: "A well-fitted sports bra reduces breast movement and pain in running and jumping. Breast bruising from impact is common and not linked to cancer.",
    med: "Mammary glands and ducts in fat. Problems: benign lumps (fibroadenoma, cysts), mastitis in breastfeeding, and breast cancer (screening mammograms; surgery, radiotherapy, hormone therapy, chemotherapy, targeted drugs). Any new lump needs assessment.",
  },
  "organs/reproductive/male": {
    sport: "A protective cup prevents testicular injury in cricket, hockey and martial arts. Sudden testicular pain is torsion until proven otherwise: an emergency needing surgery within hours.",
    med: "Testes, ducts, prostate and penis. Problems: testicular torsion, testicular cancer (in young men; highly curable), varicocele, epididymitis, benign prostatic enlargement and prostate cancer (often slow; watchful waiting, surgery or radiotherapy).",
  },
  "organs/glands": {
    sport: "Hormones drive adaptation to training. An enlarged spleen during glandular fever (mono) can rupture in contact sport, so contact sports wait at least 3 to 4 weeks. Thyroid disease affects energy and heart rate.",
    med: "Pituitary, thyroid, adrenals, thymus, spleen. Problems: thyroid over- and under-activity (antithyroid drugs, radioiodine, levothyroxine), thyroid cancer, Addison's disease (steroid replacement), Cushing's syndrome, pituitary tumours, and splenic rupture after trauma.",
  },
  "organs/senses": {
    sport: "Eye injuries from balls, sticks and fingers can cause bleeding inside the eye or retinal detachment; protective eyewear prevents most. Ears are injured in diving and combat sports.",
    med: "Eyes and ears. Leading causes of vision loss: cataract, glaucoma, diabetic retinopathy and macular degeneration. Hearing loss is most often age-related or noise-induced.",
  },
  "organs/senses/eye": {
    sport: "After any eye blow: blurred vision, a dark curtain, flashes and floaters, or blood in front of the iris needs same-day eye review. Polycarbonate eyewear in squash, racquetball and hockey prevents most injuries.",
    med: "Cornea, lens, retina and their supports. Problems: refractive errors, cataract (lens replacement), glaucoma (drops, laser, surgery; lost vision doesn't return), retinal detachment (urgent surgery), age-related macular degeneration (anti-VEGF injections for wet form), diabetic retinopathy (screening, laser, injections).",
  },
  "organs/senses/ear": {
    sport: "Blows to the ear cause haematomas that need draining to avoid 'cauliflower ear'. Swimmer's ear is outer ear canal infection (drops, keep dry).",
    med: "The auricle and ear canal. Problems: otitis externa, perichondritis, skin cancers on the rim, and keloids after piercing.",
  },
  "organs/other": {
    sport: "These structures are rarely injured in sport.",
    med: "Supporting tissues within the body cavities.",
  },

  // ---------- Heart and vessels ----------
  "vessels/heart": {
    sport: "Training enlarges the heart and slows the resting heart rate ('athlete's heart'), which is healthy. Sudden collapse during exercise in a young athlete is usually an inherited heart condition (hypertrophic cardiomyopathy, arrhythmia syndromes). Fast CPR and a defibrillator save lives. Pre-participation screening finds some of these.",
    med: "Four chambers, four valves, coronary circulation and conduction system. Major conditions: coronary artery disease, heart failure, valve disease, arrhythmias (atrial fibrillation most commonly), cardiomyopathies, congenital heart disease and myocarditis.",
  },
  "vessels/heart/chambers": {
    sport: "Endurance training enlarges the chambers; strength training thickens the walls a little. Doctors tell this from disease by its pattern and by how it reverses with detraining. Myocarditis after a viral illness is a reason not to train hard with a fever.",
    med: "Atria and ventricles. Problems: heart failure (reduced or preserved pumping; ACE inhibitors, beta blockers, SGLT2 inhibitors and more), hypertrophic cardiomyopathy (beta blockers, ICD, myosin inhibitors), dilated cardiomyopathy, atrial fibrillation (stroke prevention with anticoagulants, rate or rhythm control) and congenital septal defects.",
  },
  "vessels/heart/valves": {
    sport: "Mild valve leaks are common and harmless in athletes. A bicuspid aortic valve (two cusps instead of three) is common and can narrow or leak with age; it needs monitoring and sometimes limits on heavy lifting.",
    med: "Tricuspid, pulmonary, mitral, aortic. Problems: aortic stenosis (breathlessness, chest pain, fainting; valve replacement by surgery or catheter, TAVI), mitral regurgitation (repair), rheumatic heart disease, and infective endocarditis (long IV antibiotics, sometimes surgery).",
  },
  "vessels/heart/coronary": {
    sport: "Exercise is one of the best protections against coronary disease. In athletes over 35, sudden cardiac events are usually from coronary disease: chest tightness on exertion should never be trained through.",
    med: "Right and left coronary arteries. Coronary artery disease causes angina (medication, stents, bypass) and heart attack (myocardial infarction; urgent stenting, then aspirin, statins, beta blockers and rehab). Risk factors: smoking, blood pressure, cholesterol, diabetes, family history. Anomalous coronary origins cause sudden death in young athletes.",
  },
  "vessels/heart/cardiac-veins": {
    sport: "No direct role in sport.",
    med: "Cardiac veins drain into the coronary sinus. Pacemaker and resynchronisation leads are threaded into these veins to pace the left ventricle.",
  },
  "vessels/arteries": {
    sport: "Arteries widen and become more flexible with training. External iliac artery narrowing ('cyclist's iliac syndrome') causes leg pain at maximal effort in elite cyclists. Heavy lifting briefly raises blood pressure very high.",
    med: "Elastic and muscular arteries. Atherosclerosis narrows them (heart attack, stroke, peripheral arterial disease). Aneurysms (aortic most commonly) can rupture; screening older men finds abdominal aortic aneurysms early. Vasculitis inflames arteries.",
  },
  "vessels/arteries/main": {
    sport: "Tall athletes with long limbs should be checked for Marfan syndrome, which weakens the aorta. Very heavy lifting can, rarely, tear a weakened aorta.",
    med: "Aorta and great arteries. Problems: aortic dissection (tearing chest pain to the back; emergency surgery or blood pressure control), aortic aneurysm (monitoring, stent graft or open repair), coarctation (narrowing; repair) and Marfan or other connective tissue diseases.",
  },
  "vessels/arteries/head": {
    sport: "Neck trauma or sudden twisting can tear the carotid or vertebral artery (dissection): neck pain plus stroke-like symptoms needs emergency care.",
    med: "Carotid and vertebral arteries and the circle of Willis. Problems: ischaemic stroke (clot-busting drugs or clot retrieval within hours: time is brain), carotid stenosis (endarterectomy), dissection, and berry aneurysms (subarachnoid haemorrhage; coiling or clipping).",
  },
  "vessels/arteries/arms": {
    sport: "Overhead athletes (pitchers, swimmers) can compress arteries at the thoracic outlet, causing a cold, tired arm. Repeated hand impacts (volleyball, baseball catchers) can damage hand arteries.",
    med: "Subclavian, axillary, brachial, radial, ulnar. Problems: thoracic outlet syndrome, Raynaud's phenomenon (colour changes in the cold; warmth, calcium channel blockers), and arterial injury with fractures. The radial artery is used for blood gases and heart catheterisation.",
  },
  "vessels/arteries/trunk": {
    sport: "Blood flow to the gut drops sharply in hard exercise, one reason for gut symptoms in endurance events.",
    med: "Branches of the aorta to organs. Problems: mesenteric ischaemia (gut pain after meals or sudden severe pain; emergency), renal artery stenosis (high blood pressure), and bleeding from organ injury.",
  },
  "vessels/arteries/legs": {
    sport: "Popliteal artery entrapment (calf pain on running that stops at rest in young athletes) is rare but treatable with surgery. Knee dislocations can tear the popliteal artery.",
    med: "Iliac, femoral, popliteal, tibial arteries. Peripheral arterial disease causes calf pain on walking (claudication): walking exercise, stopping smoking, statins; angioplasty or bypass for severe disease; critical ischaemia risks amputation.",
  },
  "vessels/veins": {
    sport: "Calf muscle contractions pump blood back up the legs. Long-haul travel plus dehydration before competition raises clot risk. Effort thrombosis (a clot in the arm veins) occurs in rowers, swimmers and throwers.",
    med: "Veins return blood at low pressure with one-way valves. Problems: deep vein thrombosis and pulmonary embolism (anticoagulants), varicose veins (compression, ablation), chronic venous insufficiency (leg ulcers), and superficial thrombophlebitis.",
  },
  "vessels/veins/main": {
    sport: "Straining with a closed throat (heavy lifts) briefly compresses the great veins, which can cause light-headedness.",
    med: "Superior and inferior venae cavae. Superior vena cava obstruction (swollen face and arms, often from lung cancer; stenting) and IVC filters for some clot patients.",
  },
  "vessels/veins/head": {
    sport: "No direct sports role.",
    med: "Jugular veins and dural venous sinuses. Cerebral venous sinus thrombosis causes headache and seizures (anticoagulation). Raised jugular venous pressure is a sign of heart failure.",
  },
  "vessels/veins/arms": {
    sport: "'Effort thrombosis' (Paget-Schroetter syndrome) is a clot in the subclavian vein from repetitive overhead activity: a swollen, heavy, bluish arm needs urgent treatment.",
    med: "Deep and superficial arm veins. Used for blood tests, drips and fistulas for dialysis. Upper limb DVT is often linked to central lines.",
  },
  "vessels/veins/trunk": {
    sport: "No direct sports role.",
    med: "Veins of the chest and abdomen, including the hepatic veins. Budd-Chiari syndrome (hepatic vein blockage) and renal vein thrombosis are rare but serious.",
  },
  "vessels/veins/gut": {
    sport: "No direct sports role.",
    med: "The hepatic portal system. In cirrhosis, portal pressure rises (portal hypertension), causing varices that can bleed massively (banding, beta blockers, TIPS) and fluid in the belly (ascites).",
  },
  "vessels/veins/legs": {
    sport: "Calf DVT can look like a calf strain: swelling, warmth and pain, especially after travel, surgery or immobilisation, need scanning.",
    med: "Deep veins and the great and small saphenous veins. Problems: DVT (anticoagulation), varicose veins, venous ulcers (compression), and the great saphenous vein is harvested for heart bypass grafts.",
  },
  "vessels/lungs": {
    sport: "At altitude, the lung arteries tighten; going too high too fast can cause high-altitude pulmonary oedema (breathlessness at rest; descend at once).",
    med: "Pulmonary arteries and veins. Problems: pulmonary embolism (anticoagulation, clot-busters for massive PE), pulmonary hypertension (specialist drugs; transplant), and arteriovenous malformations.",
  },

  // ---------- Brain and nerves ----------
  "nervous/brain": {
    sport: "Concussion is a brain injury even without loss of consciousness. Remove from play, rest briefly, then a graded return to learning and sport over at least 1 to 3 weeks; children take longer. Repeated head impacts are linked to long-term problems. Exercise improves mood, memory and sleep.",
    med: "Cerebrum, deep nuclei, brainstem, cerebellum. Major conditions: stroke, epilepsy, dementia (Alzheimer's; few disease-modifying options), multiple sclerosis, Parkinson's disease, brain tumours, migraine, traumatic brain injury and meningitis.",
  },
  "nervous/brain/cerebrum": {
    sport: "Motor skill learning reshapes the motor cortex; mental rehearsal (imagery) improves skill. After concussion, symptoms include headache, fogginess and poor concentration.",
    med: "Frontal, parietal, temporal and occipital lobes. Damage causes problems by location: weakness (motor cortex), language loss (dominant hemisphere), neglect (non-dominant parietal), visual field loss (occipital). Epilepsy (antiseizure drugs, surgery), Alzheimer's and frontotemporal dementia, stroke, glioblastoma (surgery, chemoradiotherapy; usually incurable).",
  },
  "nervous/brain/deep": {
    sport: "The basal ganglia and cerebellum together automate practised movements.",
    med: "Thalamus, basal ganglia, hippocampus, amygdala. Problems: Parkinson's disease (levodopa, deep brain stimulation; no cure), Huntington's disease (inherited; no cure), hippocampal damage in Alzheimer's, and thalamic strokes.",
  },
  "nervous/brain/brainstem": {
    sport: "Rotational blows stress the brainstem; second impact syndrome (rapid swelling after a second hit before recovery) is rare but often fatal, the main reason concussed players must not return the same day.",
    med: "Midbrain, pons, medulla. Brainstem strokes cause cranial nerve problems on one side and weakness on the other; locked-in syndrome after a large pontine stroke. Brain death is defined by absent brainstem function.",
  },
  "nervous/brain/cerebellum": {
    sport: "The cerebellum learns timing and coordination; balance training sharpens it. Clumsiness or poor balance after a head injury suggests concussion.",
    med: "Coordinates movement. Damage causes ataxia (unsteady gait), slurred speech and nystagmus. Causes: alcohol, stroke, multiple sclerosis, tumours (medulloblastoma in children) and inherited ataxias.",
  },
  "nervous/brain/fluid": {
    sport: "No direct sports role.",
    med: "Ventricles and cerebrospinal fluid. Hydrocephalus (shunt or endoscopic ventriculostomy), normal pressure hydrocephalus in older people (walking difficulty, incontinence, confusion; shunt can help), and idiopathic intracranial hypertension.",
  },
  "nervous/nerves": {
    sport: "Nerves are stretched or pinched in sport: 'stingers' in tackling, ulnar nerve irritation in throwers, and numb toes from tight shoes. Most recover; numbness with weakness needs checking.",
    med: "Cranial nerves, spinal cord and peripheral nerves. Peripheral neuropathy (diabetes most commonly), entrapments (carpal tunnel), Guillain-Barré syndrome (ascending weakness; immunoglobulin) and nerve injuries. Cut nerves regrow about 1 mm a day.",
  },
  "nervous/nerves/cranial": {
    sport: "Head trauma can damage smell (olfactory nerve) or eye movement nerves. Double vision after a head knock needs review.",
    med: "Twelve pairs. Problems: optic neuritis (often the first sign of MS), Bell's palsy (VII), trigeminal neuralgia (severe electric facial pain; carbamazepine, surgery), vestibular neuritis (vertigo), acoustic neuroma, and cranial nerve palsies from raised pressure or aneurysms.",
  },
  "nervous/nerves/spinal": {
    sport: "Spinal cord injuries in sport come from diving, rugby, gymnastics and horse riding. Correct tackling technique and rule changes have cut them. Transient cord 'concussion' (brief tingling or weakness in all limbs) needs full imaging before return.",
    med: "Spinal cord and cauda equina. Problems: traumatic spinal cord injury (stabilisation and rehabilitation; no cure for lost function yet), cord compression from tumours or discs (emergency decompression), multiple sclerosis, motor neurone disease (no cure; riluzole, supportive care), and syringomyelia.",
  },
  "nervous/nerves/other": {
    sport: "Peripheral nerves can be compressed by equipment (handlebar palsy in cyclists, tight boots) or stretched in dislocations.",
    med: "Peripheral nerves and ganglia. Problems: diabetic and other neuropathies, entrapments, nerve trauma (repair, grafting), and shingles (reactivated chickenpox in a nerve root; antivirals, vaccination).",
  },
};

// Detail for well-known parts. First match wins.
export const PART_NOTES = [
  // Bones and joints
  { match: /^femur/, sport: "Stress fractures of the femoral neck in runners are high-risk: groin pain that worsens with running needs an MRI, because a full fracture can cut the blood supply to the hip. Thigh bone strength builds with impact and heavy lifting.", med: "Proximal femur fractures (intracapsular: hemiarthroplasty or total hip replacement; extracapsular: dynamic hip screw or nail) carry high one-year mortality in the elderly. Avascular necrosis of the femoral head (steroids, alcohol, sickle cell). Slipped capital femoral epiphysis in adolescents: knee pain can be hip pain." },
  { match: /^patella/, sport: "Patellofemoral pain (around the kneecap, worse on stairs and squats) is the most common knee complaint in runners: hip and quadriceps strengthening fixes most. Kneecap dislocations happen with twisting; recurrent ones may need ligament reconstruction (MPFL).", med: "Patellar fractures (displaced ones are wired), recurrent patellar dislocation, patellar tendinopathy ('jumper's knee'), and patellofemoral osteoarthritis." },
  { match: /^tibia/, sport: "Medial tibial stress syndrome (shin splints) along the inner shin and tibial stress fractures come from rapid increases in running. A 'dreaded black line' stress fracture on the front of the tibia heals poorly and may need surgery.", med: "Tibial plateau fractures (joint surface; often fixed), shaft fractures (intramedullary nail; compartment syndrome risk), Osgood-Schlatter disease in adolescents (tender bump below the knee; self-limiting)." },
  { match: /^fibula/, sport: "Fibula stress fractures occur in runners and recover in about 6 weeks. The fibula is often broken in ankle injuries.", med: "Ankle fractures by fibula level (Weber A, B, C: higher means more unstable). A high fibula fracture with an ankle injury (Maisonneuve) means a disrupted syndesmosis and usually surgery." },
  { match: /^clavicle/, sport: "Collarbone fractures from falls in cycling and rugby. Return to contact sport usually takes 10 to 12 weeks.", med: "Midshaft fractures mostly heal in a sling; shortened, displaced or open fractures and those threatening the skin are plated. Non-union in about 5 to 15% of displaced fractures." },
  { match: /^scapula/, sport: "Poor shoulder-blade control (scapular dyskinesis) feeds shoulder impingement in throwers and swimmers; rows, push-up plus and wall slides retrain it.", med: "Scapular fractures signal high-energy trauma (check the chest). Winging: long thoracic nerve (medial) or spinal accessory nerve (lateral) palsy." },
  { match: /^humerus/, sport: "Throwing twists the humerus hugely; young pitchers can get 'Little League shoulder' (growth plate stress). Arm-wrestling can snap the humerus shaft.", med: "Proximal humerus fractures (often non-operative in elderly), shaft fractures (functional brace; radial nerve palsy), supracondylar fractures in children (check pulse and nerves)." },
  { match: /^radius/, sport: "Distal radius (wrist) fracture is the most common fracture from falls in skating, snowboarding and football. Wrist guards in snowboarding halve the risk.", med: "Colles' fracture (dorsally displaced distal radius; manipulation and cast or plate), Smith's fracture, radial head fractures (elbow). Fragility wrist fractures warrant osteoporosis assessment." },
  { match: /^ulna/, sport: "Ulnar collateral ligament injuries at the inner elbow in pitchers and javelin throwers; 'Tommy John' reconstruction needs 12 to 18 months before full return.", med: "Olecranon fractures (tension-band wiring or plate), Monteggia fracture-dislocation (ulna fracture plus radial head dislocation; easily missed), olecranon bursitis." },
  { match: /^scaphoid/, sport: "Wrist pain after a fall: suspect a scaphoid fracture. Casting for 6 to 12 weeks or a screw for faster return in athletes.", med: "Blood enters from the far end, so proximal fractures risk avascular necrosis and non-union. MRI if X-rays are normal but suspicion is high." },
  { match: /^calcaneus/, sport: "Heel pain in active children (Sever's disease) is growth-plate irritation; it settles with load management.", med: "Calcaneal fractures follow falls from height (check the spine too); often complex, with long recovery and frequent long-term pain." },
  { match: /^talus/, sport: "Osteochondral lesions of the talus cause ongoing ankle pain after a sprain; some need arthroscopic treatment.", med: "Talar neck fractures risk avascular necrosis. Osteochondritis dissecans." },
  { match: /^(fifth|5th) metatarsal|^metatarsal/, sport: "Fifth metatarsal 'Jones' fractures in footballers and basketball players heal slowly; athletes often get a screw. Second metatarsal stress fractures ('march fracture') in runners.", med: "Avulsion fractures of the fifth metatarsal base heal well in a boot; Jones fractures have high non-union rates." },
  { match: /^hip bone/, sport: "Pelvic avulsion injuries in teen sprinters and kickers; hip impingement in hockey and football players.", med: "Pelvic ring fractures can bleed heavily (pelvic binder, embolisation, fixation); acetabular fractures; insufficiency fractures in osteoporosis." },
  { match: /^sacrum/, sport: "Sacral stress fractures in female distance runners, often linked to low energy availability.", med: "Sacral insufficiency fractures (osteoporosis), sacroiliitis in ankylosing spondylitis, sacral chordoma (rare)." },
  { match: /^mandible/, sport: "Jaw fractures from punches and elbows; mouthguards and headgear reduce them.", med: "Often break in two places. Fixed with plates or wiring. TMJ dislocation (open-mouth lock; manual reduction). Osteonecrosis of the jaw with bisphosphonates." },
  { match: /intervertebral disk of fifth lumbar|intervertebral disk of fourth lumbar/, sport: "The most commonly herniated discs. Return to sport is usually possible after conservative care or discectomy.", med: "L4/5 compresses the L5 root (weak big-toe lift); L5/S1 the S1 root (weak calf, lost ankle reflex). Cauda equina syndrome from a massive central disc is a surgical emergency." },
  { match: /\brib\b/, sport: "Rib stress fractures in rowers; cracked ribs from tackles. Most heal in about 6 weeks.", med: "Rib fractures: pain control (including nerve blocks) to allow deep breathing and prevent pneumonia; three or more in older people raise mortality." },
  { match: /vertebra$/, sport: "Vertebral stress fractures (pars defects) in young athletes who arch and twist: cricket fast bowlers, gymnasts, divers.", med: "Vertebral fractures: compression (osteoporosis; bone protection, vertebroplasty), burst and fracture-dislocations (spinal cord risk; surgical stabilisation). Metastases and infection (discitis, osteomyelitis) also strike vertebrae." },

  // Muscles
  { match: /biceps brachii/, sport: "Curls, chin-ups and rows train it. Distal biceps rupture in heavy lifting needs surgery within 2 to 3 weeks; long-head tendinopathy causes front-shoulder pain in overhead athletes.", med: "Musculocutaneous nerve (C5, C6); biceps reflex tests C5/6. Proximal long-head rupture ('Popeye sign') usually managed without surgery; distal rupture repaired in active patients." },
  { match: /triceps brachii/, sport: "Pressing and dips train it. Triceps tendinopathy at the elbow in weightlifters; rupture is rare.", med: "Radial nerve (C7); triceps reflex tests C7. Rupture repaired surgically." },
  { match: /deltoid/, sport: "Overhead pressing and raises train it. Deltoid strains are uncommon; shoulder pain usually comes from the rotator cuff underneath.", med: "Axillary nerve (C5); test sensation over the 'regimental badge' area after shoulder dislocation or neck-of-humerus fracture." },
  { match: /supraspinatus/, sport: "The most commonly injured rotator cuff tendon: painful arc lifting the arm, worse with overhead work. Rehab targets cuff and shoulder-blade strength; tears in young athletes are often repaired.", med: "Suprascapular nerve (C5). Tendinopathy, partial and full-thickness tears (ultrasound or MRI); repair, or reverse replacement for irreparable tears. Calcific tendinitis responds to needling or shockwave." },
  { match: /infraspinatus|teres minor/, sport: "External rotators that decelerate the arm in throwing; weakness raises shoulder injury risk. Train with band and cable external rotations.", med: "Infraspinatus: suprascapular nerve, which can be pinched at the spinoglenoid notch (volleyball players), causing isolated wasting. Teres minor: axillary nerve." },
  { match: /subscapularis/, sport: "Internal rotator at the front of the shoulder; tears follow forced external rotation or dislocation.", med: "Subscapular nerves. Tears cause weak internal rotation (lift-off and belly-press tests); usually repaired." },
  { match: /pectoralis major/, sport: "Bench press, push-ups and flyes train it. Tendon rupture during heavy bench pressing (bruising, lost armpit fold) is best repaired early.", med: "Medial and lateral pectoral nerves. Rupture: surgical repair within weeks gives the best strength; chronic tears can be reconstructed." },
  { match: /latissimus dorsi/, sport: "Pull-ups, rows and swimming train it. Strains and rare avulsions in baseball pitchers and climbers.", med: "Thoracodorsal nerve (C6 to C8). Used as a flap in breast reconstruction." },
  { match: /trapezius/, sport: "Shrugs and pulls train it. Upper trap tension and trigger points are common in desk workers and cyclists.", med: "Spinal accessory nerve (XI). Damage in neck surgery causes shoulder drop and lateral scapular winging." },
  { match: /rectus abdominis/, sport: "Trained by bracing and anti-extension exercises (planks, rollouts) more than endless crunches. Strains in tennis serves and fast bowling (opposite side to the arm).", med: "Thoracoabdominal nerves (T7 to T12). Diastasis recti after pregnancy; rectus sheath haematoma; used as a flap (TRAM) in reconstruction." },
  { match: /external oblique|internal oblique/, sport: "Rotational power for throwing, swinging and striking. Side strains (internal oblique, at the lower ribs) in cricket, baseball and javelin take about 4 weeks.", med: "Lower intercostal, iliohypogastric and ilioinguinal nerves. The inguinal canal runs through their aponeuroses: the site of inguinal hernias." },
  { match: /diaphragm/, sport: "The main breathing muscle; also part of core bracing. Being 'winded' is a brief diaphragm spasm after a blow to the solar plexus.", med: "Phrenic nerve (C3 to C5: 'keeps the diaphragm alive'). Paralysis (breathlessness lying flat), hiatus hernia (reflux; surgery if severe), congenital diaphragmatic hernia (surgery after birth)." },
  { match: /gluteus maximus/, sport: "Squats, deadlifts, hip thrusts and hill sprints train it. Weakness shifts load to the hamstrings and lower back.", med: "Inferior gluteal nerve (L5 to S2). Avoid intramuscular injections in the inner-lower quadrant (sciatic nerve)." },
  { match: /gluteus medius|gluteus minimus/, sport: "Holds the pelvis level on one leg; weakness causes the knee to collapse inward on landing (ACL and kneecap risk). Gluteal tendinopathy causes outer hip pain in runners.", med: "Superior gluteal nerve (L4 to S1). Weakness causes a Trendelenburg gait. Tendon tears (lateral hip pain, weakness) can be repaired." },
  { match: /biceps femoris|semitendinosus|semimembranosus/, sport: "Hamstring strain is the top injury in sprinting sports, most often the long head of biceps femoris. Nordic hamstring curls cut injury rates by about half. Return when strength, sprinting and confidence are back, typically 2 to 6 weeks.", med: "Sciatic nerve (tibial and common fibular parts). Strains graded by MRI; proximal avulsions with retraction need surgical reattachment." },
  { match: /rectus femoris/, sport: "The only quadriceps muscle crossing the hip; strained in kicking and sprinting. Rehab: progressive loading, then kicking drills.", med: "Femoral nerve (L2 to L4). Proximal avulsions in adolescents (anterior inferior iliac spine)." },
  { match: /vastus/, sport: "Squats, lunges and step-ups train it. Knee injuries quickly weaken these muscles, so quad strength is a key return-to-sport test after ACL reconstruction.", med: "Femoral nerve (L2 to L4); knee reflex tests L3/4. Quadriceps wasting follows knee injury and surgery; tendon rupture above the kneecap needs surgery." },
  { match: /adductor|gracilis|pectineus/, sport: "Groin strains in football, ice hockey and change-of-direction sports. Copenhagen adductor exercises cut groin injuries substantially.", med: "Obturator nerve (L2 to L4). Adductor longus tendinopathy and avulsion, osteitis pubis." },
  { match: /gastrocnemius/, sport: "'Tennis leg' is a tear of the inner gastrocnemius during a push-off. Heavy calf raises with a straight knee train it.", med: "Tibial nerve (S1, S2). Medial head tears (compression, gradual loading). Baker's cyst rupture mimics calf DVT." },
  { match: /soleus/, sport: "Takes the largest loads of any calf muscle in running (several times body weight per stride). Train with bent-knee calf raises.", med: "Tibial nerve. Its veins are where most leg DVTs begin; the 'calf muscle pump' is mostly soleus." },
  { match: /calcaneal tendon/, sport: "Achilles tendinopathy in runners and jumpers: heavy, slow calf loading over 12 weeks is the standard treatment. Rupture feels like a kick to the back of the heel; boot treatment or surgery, then about 9 to 12 months to return.", med: "Thompson (calf-squeeze) test for rupture. Fluoroquinolone antibiotics and steroid injections raise rupture risk. Insertional tendinopathy and Haglund's deformity at the heel." },
  { match: /tibialis anterior/, sport: "Overworked in downhill running; front-of-shin pain in runners can be anterior compartment syndrome.", med: "Deep fibular nerve (L4, L5). Weakness causes foot drop (high-stepping gait); anterior compartment syndrome is a surgical emergency after trauma." },
  { match: /iliopsoas|psoas major|iliacus/, sport: "Hip flexor strains in kicking and sprinting; tightness from sitting. Snapping hip (tendon flicking over bone) is usually painless.", med: "Femoral nerve and lumbar plexus. Psoas abscess (back pain, fever, limp), iliopsoas bursitis." },
  { match: /iliotibial tract/, sport: "Iliotibial band syndrome: outer knee pain in runners and cyclists after a set distance. Reduce load, strengthen hip abductors; stretching the band itself changes little.", med: "Fascial band from the hip to the tibia. Rarely needs surgery." },
  { match: /sternocleidomastoid/, sport: "Neck strengthening for contact sports includes it. Strains from whiplash.", med: "Spinal accessory nerve (XI). Congenital torticollis in infants (stretching). Landmark for neck procedures." },
  { match: /intercostal/, sport: "Strains in rowers, golfers and throwers; sharp pain on breathing and twisting.", med: "Intercostal nerves (T1 to T11) run beneath each rib; intercostal nerve blocks relieve rib-fracture pain; shingles follows these nerves." },
  { match: /masseter|temporalis|pterygoid/, sport: "Jaw clenching under load; mouthguards protect the TMJ.", med: "Trigeminal nerve V3. Temporomandibular disorders, bruxism, trismus." },

  // Organs
  { match: /^liver|caudate lobe of liver/, sport: "Liver glycogen fuels long efforts; carbohydrate before and during events tops it up. Liver lacerations from blows to the right upper abdomen are rare but serious.", med: "Fatty liver disease, hepatitis B and C, alcohol-related disease, cirrhosis (liver transplant for end stage), hepatocellular carcinoma. Liver function tests, ultrasound and elastography assess it." },
  { match: /^spleen/, sport: "An enlarged spleen during glandular fever can rupture in contact sport: no contact for at least 3 to 4 weeks from onset. Left upper abdominal pain after a blow needs assessment.", med: "Splenic rupture (observation, embolisation or splenectomy). After splenectomy, vaccines and sometimes antibiotics prevent overwhelming infection." },
  { match: /^kidney/, sport: "Blows to the flank cause kidney bruising: blood in the urine needs checking. Dehydration plus anti-inflammatory painkillers in endurance events can cause acute kidney injury.", med: "Chronic kidney disease (blood pressure and diabetes control, SGLT2 inhibitors; dialysis or transplant at end stage), kidney stones, polycystic kidney disease, renal cell carcinoma, glomerulonephritis." },
  { match: /lobe of lung|^lung/, sport: "Breathing rarely limits healthy athletes; asthma and exercise-induced bronchoconstriction are common and treatable. Spontaneous pneumothorax in tall young men.", med: "Pneumonia, COPD, asthma, pulmonary embolism, interstitial lung disease, lung cancer (screening for heavy ex-smokers; surgery, radiotherapy, targeted and immunotherapy)." },
  { match: /^stomach/, sport: "Pre-event meals 2 to 4 hours before; avoid NSAIDs before endurance events (gut bleeding).", med: "Peptic ulcer (H. pylori, NSAIDs), gastritis, gastric cancer, upper GI bleeding." },
  { match: /^appendix/, sport: "Appendicitis in athletes: return to training about 2 weeks after keyhole surgery, contact sports later.", med: "Appendicitis (pain moving from the navel to the right lower abdomen; appendicectomy, or antibiotics in selected cases)." },
  { match: /^pancreas|parenchyma of pancreas/, sport: "Insulin sensitivity improves with training; type 1 diabetic athletes manage insulin and carbohydrate carefully.", med: "Diabetes, pancreatitis, pancreatic cancer (Whipple's operation when resectable; chemotherapy)." },
  { match: /^urinary bladder/, sport: "Leakage during exercise is common and treatable with pelvic floor training.", med: "Cystitis, overactive bladder, bladder stones, bladder cancer (painless blood in urine; cystoscopy)." },
  { match: /^prostate/, sport: "Long hours in the saddle can irritate the prostate region; a cut-out saddle helps.", med: "Benign prostatic hyperplasia (alpha blockers, 5-alpha reductase inhibitors, surgery), prostatitis, prostate cancer (PSA testing, MRI, biopsy; active surveillance, surgery, radiotherapy, hormone therapy)." },
  { match: /^testis/, sport: "A protective cup for cricket, hockey and martial arts. Sudden pain is torsion until proven otherwise.", med: "Torsion (surgery within 6 hours saves the testis), testicular cancer (orchidectomy, chemotherapy; cure rates over 95%), orchitis, varicocele." },
  { match: /^(body|fundus) of uterus/, sport: "Exercise in healthy pregnancy is encouraged (about 150 minutes a week of moderate activity), avoiding contact, falls, lying flat on the back after mid-pregnancy and overheating.", med: "Fibroids (medication, embolisation, myomectomy, hysterectomy), endometriosis and adenomyosis, endometrial cancer (postmenopausal bleeding needs investigating), and complications of pregnancy." },
  { match: /^cervix of uterus/, sport: "No direct sports role.", med: "Cervical screening (HPV testing) and HPV vaccination prevent most cervical cancer; abnormal cells are removed before they become cancer." },
  { match: /^ovary/, sport: "Low energy availability can stop ovulation and periods; it is a warning sign, not a training adaptation.", med: "Ovarian cysts (most resolve), torsion (emergency), polycystic ovary syndrome, ovarian cancer (often found late; surgery and chemotherapy)." },
  { match: /^uterine tube/, sport: "No direct sports role.", med: "Ectopic pregnancy (one-sided pain and bleeding in early pregnancy; an emergency), pelvic inflammatory disease (antibiotics) and tubal infertility." },
  { match: /^mammary gland/, sport: "A supportive sports bra reduces breast pain in running.", med: "Breast cancer: the most common cancer in women. Screening mammography; treatment by stage and type (surgery, radiotherapy, hormone therapy, chemotherapy, HER2-targeted drugs)." },
  { match: /^thyroid gland|lobe of thyroid/, sport: "Unexplained fatigue or a racing heart in athletes is worth a thyroid blood test.", med: "Hypothyroidism (levothyroxine), hyperthyroidism (Graves' disease; carbimazole, radioiodine, surgery), nodules and cancer (mostly highly curable)." },
  { match: /^adrenal gland/, sport: "Adrenaline and cortisol rise with exercise and stress.", med: "Addison's disease (steroid replacement; adrenal crisis is an emergency), Cushing's syndrome, phaeochromocytoma, adrenal incidentalomas." },
  { match: /^cornea|^lens|^iris|retina|^sclera|^vitreous/, sport: "Ball and stick injuries to the eye: same-day eye review for blurred vision, flashes, floaters or blood in the eye.", med: "Corneal abrasion and ulcers, cataract, glaucoma, uveitis, retinal detachment, macular degeneration, diabetic retinopathy." },

  // Heart and vessels
  { match: /^wall of heart|^wall of (atrium|ventricle)|papillary muscle/, sport: "'Athlete's heart' (bigger chambers, slow pulse) is normal. Fainting or chest pain during exercise, or a family history of sudden death under 50, needs heart screening.", med: "Hypertrophic cardiomyopathy, dilated cardiomyopathy, myocarditis, heart failure, atrial fibrillation. Echo, ECG and cardiac MRI assess the muscle." },
  { match: /aortic valve/, sport: "Bicuspid aortic valves are common in athletes and need periodic echo checks.", med: "Aortic stenosis (valve replacement, surgical or TAVI), aortic regurgitation." },
  { match: /mitral valve/, sport: "Mitral valve prolapse is common and usually harmless.", med: "Mitral regurgitation (repair, clip), mitral stenosis (usually rheumatic; balloon or surgery)." },
  { match: /aorta/, sport: "Tall, long-limbed athletes may need checks for Marfan syndrome, which weakens the aorta.", med: "Aortic dissection, abdominal aortic aneurysm (screening; repair over 5.5 cm), coarctation." },
  { match: /carotid/, sport: "Neck trauma can tear the carotid artery: neck pain with stroke symptoms is an emergency.", med: "Carotid stenosis (endarterectomy or stenting for symptomatic narrowing), dissection, carotid body tumours." },
  { match: /femoral artery/, sport: "Pulses checked after major leg trauma.", med: "Access site for catheter procedures; peripheral arterial disease; false aneurysms after procedures." },
  { match: /great saphenous vein/, sport: "Varicose veins don't stop exercise; compression stockings ease aching.", med: "Varicose veins (ablation), thrombophlebitis, used as a bypass graft in heart surgery." },
  { match: /coronary/, sport: "Over 35, chest discomfort on exertion means stop and get checked.", med: "Coronary artery disease: angina, heart attack (stents, bypass), coronary anomalies in young athletes." },

  // Brain and nerves
  { match: /^cerebellum/, sport: "Balance and coordination; problems after a head knock suggest concussion.", med: "Ataxia from alcohol, stroke, MS, tumours or inherited disease." },
  { match: /^hippocampus/, sport: "Exercise boosts new nerve cells here, improving memory.", med: "Early target in Alzheimer's disease; damaged by prolonged seizures and low oxygen; hippocampal sclerosis causes temporal lobe epilepsy (surgery can cure)." },
  { match: /^optic nerve/, sport: "Eye-socket fractures and severe head trauma can injure it.", med: "Optic neuritis (often MS; steroids hasten recovery), glaucoma damages it, papilloedema (swelling) signals raised brain pressure." },
  { match: /^spinal cord/, sport: "Spinal cord injuries from diving, tackling and riding; immobilise and transport carefully.", med: "Spinal cord injury (no cure; rehabilitation), compression, MS, motor neurone disease." },
  { match: /^midbrain|^pons|^medulla oblongata/, sport: "Vital centres: a reason concussion is taken seriously.", med: "Brainstem strokes, demyelination, tumours; loss of all brainstem reflexes defines brain death." },
];

const firstMatch = (base, field) => PART_NOTES.find(n => n.match.test(base) && n[field])?.[field] ?? null;

/** Sports Medicine or Medical text: { lead, more } for a part. */
export function clinicalText(base, layer, groupId, subId, field) {
  const sub = subId ? GROUPS[`${layer}/${groupId}/${subId}`]?.[field] : null;
  const group = GROUPS[`${layer}/${groupId}`]?.[field] ?? null;
  const note = firstMatch(base, field);
  const lead = note ?? sub ?? group;
  const more = note ? (sub ?? group) : sub ? group : null;
  return { lead, more: more && more !== lead ? more : null };
}
