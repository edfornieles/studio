#!/usr/bin/env python3
"""One-off ingest of June 2026 web research on Ed Fornieles.

Encodes the structured findings from public-web research into:
  - project-card stubs under project_cards/<status>/<id>.md  (needs_review: true)
  - image records appended to image_manifests/public_gallery_manifest.jsonl

Design choices:
  - PROTECTED ids (the four hand-written interview cards) are NEVER overwritten —
    only their images are catalogued.
  - Auto-generated cards carry an HTML marker comment; re-running overwrites only
    those, never hand-edited files lacking the marker.
  - The image manifest is merged by asset_id (dedupe), so re-runs are idempotent.

This is a data file as much as a script: extend DATA and re-run as more is found.
All facts here are from PUBLIC sources and flagged needs_review — verify before
treating as canonical. Run `python scripts/validate_dataset.py` afterwards.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

from _common import (
    IMAGE_MANIFEST_DIR,
    PROJECT_CARDS_DIR,
    read_jsonl,
    slugify,
    write_jsonl,
)

AUTOGEN_MARKER = "<!-- autogen:ingest_research_2026 — safe to regenerate; remove this line to protect manual edits -->"
PROTECTED = {"dorm-daze", "animal-house", "modern-family", "jupiter-ascending-sauna"}
MANIFEST = IMAGE_MANIFEST_DIR / "public_gallery_manifest.jsonl"


def img(url, caption, page, rights=""):
    return {"url": url, "caption": caption, "page": page, "rights": rights}


# ---------------------------------------------------------------------------
# RESEARCH DATA — one dict per project. Sources are public; all needs_review.
# ---------------------------------------------------------------------------
DATA = [
    {
        "id": "inside-out-2", "title": "Inside Out 2", "status": "completed",
        "date": "2024", "venue": "Carlos/Ishikawa, London (23 May – 6 July 2024)",
        "short": "Solo exhibition built around 'Oom', a chat application by Fornieles' company Fini Studios. The gallery became a brand/marketing environment — vinyl promotional banners, plush 'marketing' toys on plinths, a 3D-printed resin marketing sculpture with a light sensor, and video works including an 'internal film on the subject of cute' and a choral piece 'The Oom Cosmology' with 20 watercolours. It blurs art exhibition, product launch and corporate branding to examine cuteness as emotional capture.",
        "question": "How does 'cute' branding operate as a mechanism for emotional attachment and behavioural capture, and what happens when an art exhibition becomes indistinguishable from a product launch?",
        "themes": ["cuteness", "branding", "marketing", "chat apps", "emotional capital", "kawaii", "corporate aesthetics", "Oom", "Fini Studios"],
        "machine": "A consumer chat app ('Oom') and its marketing apparatus (banners, plushies, promo sculpture, film) deployed as the exhibition itself — the gallery operating as a brand-launch system.",
        "real_world": "Tech-startup product launches, app marketing, brand environments.",
        "sources": ["https://www.carlosishikawa.com/exhibitions/inside-out-2/", "https://ocula.com/art-galleries/carlosishikawa/exhibitions/ed-fornieles-inside-out-2/", "https://artlyst.com/whats-on-archive/ed-fornieles-inside-2/", "https://www.gamescenes.org/2024/07/ed-fornelies-inside-out-2.html"],
        "confidence": "high",
        "notes": "Links to Finiliar/Fini Studios brand. A follow-on 'SOLOS' series was reported (FAD, Sept 2024). Title echoes the Pixar film but appears used ironically; not confirmed as a direct reference.",
        "images": [
            img("https://www.carlosishikawa.com/site/assets/files/15065/ef_io2_2024_v1.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15066/ef_io2_2024_v2.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15067/ef_io2_2024_v3.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15068/ef_io2_2024_v4.900x0.jpg", "Promotional material for Oom, 2024, vinyl on wall, 250 x 110 cm (each of 5)", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15071/oom-banner-1100x2500-a.1200x0.webp", "Promotional material for Oom, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15076/ef_io2_2024_v5.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15077/ef_io2_2024_v7.900x0.jpg", "Oom marketing plushies, 2024, plush toys, wooden plinth, 92 x 110 x 110 cm", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15078/ef_io2_2024_v6.451x701.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15079/ef_io2_2024_v8.900x0.jpg", "Oom marketing plushies, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15080/ef_io2_2024_v10.451x701.jpg", "Oom marketing sculpture, 2024, 3D printed resin sculpture with light sensor, 135 x 65 x 56 cm", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15081/ef_io2_2024_v9.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15082/ef_io2_2024_v11.900x0.jpg", "Oom marketing sculpture, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15083/ef_io2_2024_v12.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15084/ef_io2_2024_v13.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15085/ef_io2_2024_v14.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15086/ef_io2_2024_v15.900x0.jpg", "Internal film on the subject of cute, 2024, video, 11:57 min, ed. of 3 + 2 AP", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15087/ef_io2_2024_v16.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15088/ef_io2_2024_v17.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15089/ef_io2_2024_v18.900x0.jpg", "The Oom Cosmology, 2024, choral piece with 20 watercolour paintings, 7:32 min, ed. of 3 + 2 AP", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
            img("https://www.carlosishikawa.com/site/assets/files/15090/ef_io2_2024_v19.900x0.jpg", "Installation View, Inside Out 2, 2024", "https://www.carlosishikawa.com/exhibitions/inside-out-2/"),
        ],
    },
    {
        "id": "associations", "title": "Associations", "status": "completed",
        "date": "2021", "venue": "Carlos/Ishikawa, London (17 Apr – 22 May 2021); online via HeK Basel 'HeK Net Works' (Instagram, 8 Jun – 7 Jul 2021)",
        "short": "Fornieles collects internet images and arranges them into chains by formal and conceptual similarity (e.g. hand → family → house → globe), mapping his own tastes, biases and predilections against a broader cultural space. At Carlos/Ishikawa the work took the form of large inkjet prints with multi-aperture window mounts creating layered, associative viewing.",
        "question": "How is identity formed, replicated and sustained through associative chains of images, and what do those chains reveal about personal and cultural bias?",
        "themes": ["image culture", "internet", "association", "identity", "taste", "bias", "networks", "mind-mapping"],
        "machine": "An associative image-chaining network — internet images linked by resemblance, shown both as layered physical prints and as a sequential Instagram feed.",
        "real_world": "Online image culture, social-media feeds, search/recommendation.",
        "sources": ["https://www.carlosishikawa.com/exhibitions/associations/", "https://hek.ch/en/projects/hek-net-works/ed-fornieles-associations-12-08-06-2021/", "https://curamagazine.com/digital/ed-fornieles-associations-cura/", "https://artvisor.com/exhibition-review-ed-fornieles-association-works-at-carlos-ishikawa/"],
        "confidence": "high",
        "notes": "HeK Basel showing was online/Instagram. Three further installation views on the page are Vimeo CDN video-frame thumbnails (not durable assets), omitted here.",
        "images": [
            img("https://www.carlosishikawa.com/site/assets/files/8394/ci-ef-0298-300-1.1200x0.webp", "Dinosaurs & Strange Creatures with Mr. Know-it-Owl, 2021", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8363/ci-ef-associations-2021-v6.900x0.jpg", "Associations, 2021, Installation View", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8416/ci-ef-associations-2021-v16.900x0.jpg", "Associations, 2021, Installation View", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8386/ci-ef-0304-300.1200x0.webp", "Soup with Stars / The Happy Friendly Sparkly Toast Club, 2021", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8365/ci-ef-associations-2021-v3.900x0.jpg", "Associations, 2021, Installation View", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8400/ci-ef-0310-300.1200x0.webp", "Fuck Da Babylon (Pilot), 2021", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8417/ci-ef-associations-2021-v22.900x0.jpg", "Associations, 2021, Installation View", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8414/ci-ef-associations-2021-v28.1801x1001.jpg", "Pickles: The Dog Who Won the World Cup; The Reason I Jump, 2021", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8367/ci-ef-associations-2021-v17.900x0.jpg", "Associations, 2021, Installation View", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8379/ci-ef-0323-300.1200x0.webp", "The Loop, 2021", "https://www.carlosishikawa.com/exhibitions/associations/"),
            img("https://www.carlosishikawa.com/site/assets/files/8368/ci-ef-associations-2021-v23.900x0.jpg", "Associations, 2021, Installation View", "https://www.carlosishikawa.com/exhibitions/associations/"),
        ],
    },
    {
        "id": "cel", "title": "Cel", "status": "completed",
        "date": "2019", "venue": "Carlos/Ishikawa, London (20 Mar – 20 Apr 2019); also CCA Futura, Prague; screening at New Museum/Rhizome, NY (Dec 2019)",
        "short": "Documents a 72-hour immersive live-action role-play (LARP) in which ten participants inhabit an embodied, fictional version of extremist/'incel' online communities (largely white men), living in a house under dominance/submission protocols. Developed with LARP designer Nina Runa Essendrop; an initial rule ('you must always have someone lower than yourself') was later removed to let alternatives emerge. Recorded on chest cams and CCTV; the video mimics grainy street-violence footage. Exhibited with panels (e.g. 'Post-Patriarchal Masculinity').",
        "question": "What ideologies produce aggressive/extremist masculinity, and can embodied role-play generate critical empathy that helps dismantle them?",
        "themes": ["masculinity", "incel culture", "alt-right", "online radicalisation", "LARP", "role-play", "empathy", "extremism", "CCTV", "parafiction"],
        "machine": "A 72-hour protocol-driven LARP simulating extremist online male communities, documented via surveillance/body cameras and exhibited as video installation plus panels.",
        "real_world": "Online radicalisation, incel/alt-right forums, male violence.",
        "sources": ["https://www.carlosishikawa.com/exhibitions/cel/", "https://www.frieze.com/event/ed-fornieles-cel", "https://rhizome.org/events/cel-a-screening-and-conversation-with-artist-ed-fornieles/", "https://magazine.tank.tv/tank/2019/04/ed-fornieles", "https://www.timeout.com/london/art/ed-fornieles-cel", "https://www.contemporaryartdaily.com/project/ed-fornieles-at-carlos-ishikawa-london-33445"],
        "confidence": "high",
        "notes": "Title plays on 'incel' and the animation term 'cel'. Booklet PDF: https://www.carlosishikawa.com/site/assets/files/2182/0-booklet-ef-2019.pdf. Critical reception reportedly mixed.",
        "images": [
            img("https://www.carlosishikawa.com/site/assets/files/4982/2-ef-2019_copy.900x0.jpg", "Cel, 2019, Installation view", "https://www.carlosishikawa.com/exhibitions/cel/"),
            img("https://www.carlosishikawa.com/site/assets/files/2383/3-ef-2019.900x0.jpg", "Cel, 2019, Installation view", "https://www.carlosishikawa.com/exhibitions/cel/"),
            img("https://www.carlosishikawa.com/site/assets/files/2384/4-ef-2019.900x0.jpg", "Cel, 2019, Installation view", "https://www.carlosishikawa.com/exhibitions/cel/"),
            img("https://www.carlosishikawa.com/site/assets/files/2190/5-ef-2019_copy.1801x1001.jpg", "Cel, 2019, Video Still", "https://www.carlosishikawa.com/exhibitions/cel/"),
            img("https://www.carlosishikawa.com/site/assets/files/2385/13-ef-2019.900x0.jpg", "Cel, 2019, Installation view", "https://www.carlosishikawa.com/exhibitions/cel/"),
            img("https://www.carlosishikawa.com/site/assets/files/2386/15-ef-2019.900x0.jpg", "Cel, 2019, Installation view", "https://www.carlosishikawa.com/exhibitions/cel/"),
            img("https://www.carlosishikawa.com/site/assets/files/2193/16-ef-2019.900x0.jpg", "Cel, 2019, Installation view", "https://www.carlosishikawa.com/exhibitions/cel/"),
            img("https://media.timeout.com/images/105421348/750/422/image.jpg", "Cel, 2019, video still", "https://www.timeout.com/london/art/ed-fornieles-cel", "Time Out"),
        ],
    },
    {
        "id": "seed", "title": "Seed", "status": "completed",
        "date": "2017", "venue": "Carlos/Ishikawa, London (22 Sep – 28 Oct 2017)",
        "short": "Gathered strands of Fornieles' work on simulation, AI, data and emotional attachment: the 'Finiliar' (a cute creature whose emotional states track live data such as stock prices), 'Mii Friends' (avatar/AI conversation works), 'The Truth Table Experience' (VR-and-bed installation), the 'Sim Vol.1' publication on existential risk, and 'Babble Box'. Probes how friendly interfaces forge emotional bonds with abstract data systems.",
        "question": "How do cute interfaces and simulations make us emotionally attached to — and able to internalise — abstract data systems, currencies and risks?",
        "themes": ["simulation", "artificial intelligence", "data", "kawaii", "emotional attachment", "avatars", "Mii", "VR", "existential risk", "Finiliar"],
        "machine": "Data-driven empathic characters (Finiliar reacting to real-time data), AI conversation systems (Mii Friends), and a VR simulation (Truth Table) — interfaces translating data into emotion.",
        "real_world": "Financial data feeds, AI assistants, game avatars, VR.",
        "sources": ["https://www.carlosishikawa.com/exhibitions/seed/", "https://www.ofluxo.net/seed-by-ed-fornieles-at-carlosishikawa/", "https://www.arsenalcontemporary.com/ny/exhib/detail/the-finiliar-ed-fornieles", "http://theseenjournal.org/art-seen-national/ed-fornieles-finilar/", "https://www.computerworld.com/article/1627715/culture-crossover-finiliar-by-ed-fornieles-turns-data-into-empathy-tool.html"],
        "confidence": "medium",
        "notes": "Page interleaves several distinct bodies of work (Sim Vol.1, Mii Friends, Finiliar, Truth Table, Babble Box); slightly ambiguous which were physically in 'Seed'. Booklet PDF: https://www.carlosishikawa.com/site/assets/files/2578/0-booklet-ef-2017.pdf.",
        "images": [
            img("https://www.carlosishikawa.com/site/assets/files/2589/1.900x0.jpg", "Sim Vol.1, 2017, Installation view", "https://www.carlosishikawa.com/exhibitions/seed/"),
            img("https://www.carlosishikawa.com/site/assets/files/2592/4.900x0.jpg", "Sim Vol.1: Existential Risk, 2017, A4 book, 30 x 21 cm", "https://www.carlosishikawa.com/exhibitions/seed/"),
            img("https://www.carlosishikawa.com/site/assets/files/2593/5.900x0.jpg", "Mii Friends, 2017, digital print on foam board, 200 x 220 x 133", "https://www.carlosishikawa.com/exhibitions/seed/"),
            img("https://www.carlosishikawa.com/site/assets/files/2595/7.900x0.jpg", "Mii Friends, 2017, Installation View", "https://www.carlosishikawa.com/exhibitions/seed/"),
            img("https://www.carlosishikawa.com/site/assets/files/2596/8.900x0.jpg", "Mii Friends Conversation Reports, 2017, inkjet on paper, 233 x 246 cm", "https://www.carlosishikawa.com/exhibitions/seed/"),
            img("https://www.carlosishikawa.com/site/assets/files/2598/10.900x0.jpg", "Finiliar, 2017, Installation View", "https://www.carlosishikawa.com/exhibitions/seed/"),
            img("https://www.carlosishikawa.com/site/assets/files/2599/11.900x0.jpg", "Finiliar, 2017, Installation View", "https://www.carlosishikawa.com/exhibitions/seed/"),
            img("https://www.carlosishikawa.com/site/assets/files/2603/14.900x0.jpg", "The Truth Table Experience, 2017, VR set and bed, 190 x 90 x 50 cm", "https://www.carlosishikawa.com/exhibitions/seed/"),
            img("https://www.carlosishikawa.com/site/assets/files/2610/16.1801x1001.jpg", "Test combination I, 2017, magnets on magnetic whiteboard, 120 x 180 cm", "https://www.carlosishikawa.com/exhibitions/seed/"),
            img("https://www.carlosishikawa.com/site/assets/files/2609/20.451x701.jpg", "Babble Box, 2017, aluminium, acrylic, audio equipment, 105 x 56 x 44 cm", "https://www.carlosishikawa.com/exhibitions/seed/"),
        ],
    },
    {
        "id": "the-hangover-part-ii", "title": "The Hangover Part II", "status": "completed",
        "date": "2011", "venue": "Carlos/Ishikawa, London (11 Nov – 17 Dec 2011)",
        "short": "An early solo exhibition of sculptural assemblage combining found objects, inflatables, polystyrene, building materials and consumer electronics — e.g. 'Contagion' (steel, inflatable rhino, polystyrene), 'ORCA' (inflatable whale, steel, peace flags), 'Monster' (Hardiplank, studwork, iPhone 3G), 'Glock' (socks, polystyrene, papier-mâché), and 'Dorm Daze' / 'Adventureland' installations. Channels US teen/party-movie iconography and the residue of Animal House and Dorm Daze into post-party sculptural debris.",
        "question": "How do the mythologies and detritus of American teen/party/college culture translate into sculptural form?",
        "themes": ["American college culture", "party movies", "frat/Animal House", "found objects", "inflatables", "assemblage", "consumer detritus", "residue"],
        "machine": "Object-based sculpture/installation drawing on party-movie franchises and reusing the residue of earlier performance works rather than a participatory system.",
        "real_world": "Hollywood teen/party-movie franchises; consumer culture.",
        "sources": ["https://www.carlosishikawa.com/exhibitions/the-hangover-part-ii/", "https://www.artlyst.com/whats-on-archive/ed-fornieles-the-hangover-part-ii-carlo-ishikawa/", "https://www.newexhibitions.com/e/52088"],
        "confidence": "medium",
        "notes": "No press-release text located; conceptual fields inferred from titles/listings. One source mentions a dorm installation 'Animal House 2: Revenge of the Nerdz'. Links to existing cards [[animal-house]] and [[dorm-daze]] (this show used their residue).",
        "images": [
            img("https://www.carlosishikawa.com/site/assets/files/4477/3-ef-part2.900x0.jpg", "Installation view", "https://www.carlosishikawa.com/exhibitions/the-hangover-part-ii/"),
            img("https://www.carlosishikawa.com/site/assets/files/4498/4-ef-part2_main_image.1801x1001.jpg", "Contagion, 2011, steel, inflatable rhino, polystyrene, 150 x 125 x 230 cm", "https://www.carlosishikawa.com/exhibitions/the-hangover-part-ii/"),
            img("https://www.carlosishikawa.com/site/assets/files/4478/2-ef-part2.451x701.jpg", "Installation view", "https://www.carlosishikawa.com/exhibitions/the-hangover-part-ii/"),
            img("https://www.carlosishikawa.com/site/assets/files/4479/5-ef-part2.1801x1001.jpg", "Adventureland, 2011, mixed media assemblage", "https://www.carlosishikawa.com/exhibitions/the-hangover-part-ii/"),
            img("https://www.carlosishikawa.com/site/assets/files/4480/6-ef-part2-1.1801x1001.jpg", "The Hangover, 2011, carpet, residual materials", "https://www.carlosishikawa.com/exhibitions/the-hangover-part-ii/"),
            img("https://www.carlosishikawa.com/site/assets/files/4481/8-ef-part2.451x701.jpg", "Glock, 2011, socks, polystyrene, papier mache", "https://www.carlosishikawa.com/exhibitions/the-hangover-part-ii/"),
            img("https://www.carlosishikawa.com/site/assets/files/4481/1-ef-part2.451x701.jpg", "ORCA, 2011, inflatable whale, steel, peace flags", "https://www.carlosishikawa.com/exhibitions/the-hangover-part-ii/"),
            img("https://www.carlosishikawa.com/site/assets/files/4534/9-ef-part2.1801x1001.jpg", "Dorm Daze, 2011, mixed media", "https://www.carlosishikawa.com/exhibitions/the-hangover-part-ii/"),
        ],
    },
    {
        "id": "ny-ny-hp-hp", "title": "New York New York Happy Happy (NY NY HP HP)", "status": "completed",
        "date": "2013 (work sometimes dated 2014)", "venue": "New Museum, New York — in association with Rhizome / Performa 13",
        "short": "A semi-fictional charity benefit / art gala staged as immersive performance. Commissioned by Rhizome as a fundraiser, Fornieles mapped the narratives and character types of New York society life onto a real gala and its online representation, drawing on film/TV (Patrick Bateman, Woody Allen, Sex and the City, Girls). Ticket-buyers were contacted in advance and assigned heightened personas with cues; both real museum donors and hired actors were scripted, blurring reality and fiction.",
        "question": "What is the difference between a real social ritual and its performed/fictional double when participants and their online traces are scripted?",
        "themes": ["gala/benefit", "society archetypes", "immersive performance", "role-play", "social ritual", "online representation", "Rhizome/Performa"],
        "machine": "A charity-gala format as a scripted social system — pre-assigned personas and cues for real donors + actors, plus its social-media documentation.",
        "real_world": "Art-world charity galas; New York society; social media.",
        "sources": ["https://www.newmuseum.org/calendar/view/243/ny-ny-hp-hp-1", "https://www.interviewmagazine.com/art/ed-fornieles-new-york-new-york-happy-happy", "https://www.wmagazine.com/story/ny-ny-happy-happy", "https://en.wikipedia.org/wiki/Ed_Fornieles"],
        "confidence": "high",
        "notes": "Event took place Nov 2013 (Rhizome/Performa); Carlos/Ishikawa and Meer caption the work '2014'. Treat 2013 as event date, 2014 as possible work/edition date.",
        "images": [
            img("https://www.meer.com/attachments/d62f8dc368c5e409dcae83f56bacca9fe0e7d2ac/store/fill/1095/821/1b72938a81e64a85e38451cf32c815f20a43a7e586917e366f0b58266ebe/Ed-Fornieles-New-York-New-York-Happy-Happy-NY-NY-HP-HP-2014-Performance-in-association-with.jpg", "New York New York Happy Happy (NY NY HP HP), Performance, New Museum", "https://www.meer.com/chisenhale-gallery/artworks/49180", "© the artist, courtesy Carlos/Ishikawa, London"),
        ],
    },
    {
        "id": "dreamy-awards", "title": "The Dreamy Awards", "status": "completed",
        "date": "2012 (7 Sept)", "venue": "Serpentine Galleries Park Nights, Serpentine Pavilion 2012, London",
        "short": "A fictional, immersive award ceremony staged as participatory performance with ~200+ people. Each attendee was assigned a character identity and a few plot points to enact, forming a 'three-tiered micro-society' of real public figures, the artist's collaborators and members of the public, all playing heightened versions of a self. Awards spanned music, TV, film, politics, business and technology; actor Zac Efron was a (pre-recorded) honoree, probing celebrity as a transferable construct.",
        "question": "What is the cultural function of the awards ceremony as ritual, and how do power, status and identity form within a temporary scripted micro-society?",
        "themes": ["award ceremony", "ritual", "identity", "role-play", "participation", "micro-society", "celebrity", "immersive theatre"],
        "machine": "A participatory live-role-play event built on the award-show format/ritual; ticket purchase = entry into an assigned character.",
        "real_world": "Award ceremonies; celebrity culture.",
        "sources": ["https://www.serpentinegalleries.org/whats-on/park-nights-ed-fornieles/", "https://www.anothermag.com/art-photography/2185/ed-fornieles-the-dreamy-awards", "http://www.dazeddigital.com/artsandculture/article/14415/1/the-dreamy-awards", "https://en.wikipedia.org/wiki/Ed_Fornieles"],
        "confidence": "high",
        "notes": "Attendance cited as 'over 200' (AnOther/Wikipedia) and '~230' (Dazed). Lewis Ronald credited as photographer on the Serpentine set.",
        "images": [
            img("https://d37zoqglehb9o7.cloudfront.net/uploads/2020/03/120907-EdFornieles-15-1502x1001.jpg", "The Dreamy Awards, Park Nights, Serpentine Gallery, 7 Sept 2012", "https://www.serpentinegalleries.org/whats-on/park-nights-ed-fornieles/", "Photograph © 2012 Lewis Ronald"),
            img("https://d37zoqglehb9o7.cloudfront.net/uploads/2020/03/120907-EdFornieles-3-667x1001.jpg", "The Dreamy Awards, Park Nights, Serpentine Gallery", "https://www.serpentinegalleries.org/whats-on/park-nights-ed-fornieles/", "Photograph © 2012 Lewis Ronald"),
            img("https://d37zoqglehb9o7.cloudfront.net/uploads/2020/03/120907-EdFornieles-12-1502x1001.jpg", "The Dreamy Awards, Park Nights, Serpentine Gallery", "https://www.serpentinegalleries.org/whats-on/park-nights-ed-fornieles/", "Photograph © 2012 Lewis Ronald"),
            img("https://d37zoqglehb9o7.cloudfront.net/uploads/2020/03/120907-EdFornieles-25-667x1001.jpg", "The Dreamy Awards, Park Nights, Serpentine Gallery", "https://www.serpentinegalleries.org/whats-on/park-nights-ed-fornieles/", "Photograph © 2012 Lewis Ronald"),
            img("https://d37zoqglehb9o7.cloudfront.net/uploads/2020/03/120907-EdFornieles-52-1502x1001.jpg", "The Dreamy Awards, Park Nights, Serpentine Gallery", "https://www.serpentinegalleries.org/whats-on/park-nights-ed-fornieles/", "Photograph © 2012 Lewis Ronald"),
            img("https://d37zoqglehb9o7.cloudfront.net/uploads/2020/03/120907-EdFornieles-58-667x1001.jpg", "The Dreamy Awards, Park Nights, Serpentine Gallery", "https://www.serpentinegalleries.org/whats-on/park-nights-ed-fornieles/", "Photograph © 2012 Lewis Ronald"),
        ],
    },
    {
        "id": "finiliar", "title": "Finiliar", "status": "active",
        "date": "2016 (origin) – 2022 (NFT launch) – ongoing", "venue": "Web3 / NFT (Ethereum); with curator Sam Spike; via Verse, OpenSea; companion app 'Oom'",
        "short": "'Living' digital creatures whose moods change in real time according to the price of a linked cryptocurrency. The 2022 NFT collection is 10,000 PFPs across ten 'families', each tethered via data oracles to a specific coin (ETH, BTC, BNB, SOL, AVAX, DOGE, MATIC, LINK, UNI, XTZ): when the coin rises the creature looks happy/energetic, when it falls it looks sad or sick. The concept began in 2016 as a single GIF tied to an RSS currency feed.",
        "question": "What is our emotional relationship to the abstract financial/data systems that govern our lives — can data be made to feel cute and alive?",
        "themes": ["crypto", "NFT", "data visualization", "cuteness", "oracles", "digital pets", "finance", "affect", "Tamagotchi"],
        "machine": "Dynamic NFTs driven by blockchain price oracles; moods update hourly/daily/weekly, with community lore ('Fini World'), a companion app (Oom), and Fini Sketches (2024).",
        "real_world": "Cryptocurrency markets; NFT/PFP culture; data oracles.",
        "sources": ["https://www.finiliar.com/", "https://opensea.io/blog/articles/finiliar", "https://verse.works/series/finiliar-by-ed-fornieles", "https://verse.works/journal/reality-blurred-ed-fornieles-interview", "https://web3galaxybrain.com/episode/Finiliar-with-Ed-Fornieles-Sam-Spike-and-Jake-Allen"],
        "confidence": "high",
        "notes": "Distinct from but continuous with [[the-finiliar-arsenal]] (2017 gallery show) and [[finiliar-land-nabi]] (2017, Seoul). Connects to Fini Studios / [[inside-out-2]].",
        "images": [
            img("https://cdn.prod.website-files.com/65455ae3354eb117950e9025/6807b79229200f9ecc9c88fa_blog%20size%20(29).avif", "Finiliar blog image", "https://opensea.io/blog/articles/finiliar"),
            img("https://cdn.prod.website-files.com/65455ae3354eb117950e9025/6807b6fd3748f7531f52a7b0_adeb15d5d7f319fd6141fc2376971439.avif", "Finiliar creature", "https://opensea.io/blog/articles/finiliar"),
            img("https://cdn.prod.website-files.com/65455ae3354eb117950e9025/6807b7f8c41f6b64bc5e6bd7_3b39500d5805f3101bee0418299cb89d.avif", "Finiliar creature", "https://opensea.io/blog/articles/finiliar"),
            img("https://cdn.prod.website-files.com/65455ae3354eb117950e9025/6807b8219d38d1494d271e61_20119673530e08abe69ff3a654f88ff8.avif", "Finiliar creature", "https://opensea.io/blog/articles/finiliar"),
            img("https://cdn.prod.website-files.com/65455ae3354eb117950e9025/6807b7bdb56a7e139f953f15_d65768f324f6896388d0d73c7e37528f.avif", "Finiliar creature", "https://opensea.io/blog/articles/finiliar"),
        ],
    },
    {
        "id": "the-finiliar-arsenal", "title": "The Finiliar (Arsenal Contemporary)", "status": "completed",
        "date": "2017 (22 Feb – 23 Apr)", "venue": "Arsenal Contemporary, New York (21 Cortlandt Alley)",
        "short": "The gallery debut of the Finiliar concept: telematic LED works, inkjet prints, sculptures and animated video. Cute, Tamagotchi-inspired creatures were linked to real-time currency values (Canadian dollar, British pound, Ethereum) via synchronized LED screens. Included the HD video 'Tulip Fever' (2017, 9:21, ed. 5) and merchandise-style objects.",
        "question": "How does global capital circulate through and animate everyday emotional/consumer objects?",
        "themes": ["crypto", "currency", "data", "capital", "cuteness", "installation", "video", "LED", "merchandise"],
        "machine": "Real-time currency-data-driven animated characters in a gallery installation.",
        "real_world": "Foreign-exchange and crypto markets.",
        "sources": ["https://www.arsenalcontemporary.com/ny/exhib/detail/the-finiliar-ed-fornieles", "https://www.artrabbit.com/events/ed-fornieles-the-finiliar-arsenal-contemporary-art-new-york"],
        "confidence": "high",
        "notes": "Earlier installation phase of [[finiliar]]; currencies here (CAD, GBP, ETH) differ from the later ten-coin NFT roster. ~19 image URLs on the source page; a subset catalogued.",
        "images": [
            img("https://images.squarespace-cdn.com/content/v1/5afb5bb0fcf7fd7aebb47cac/1557941501349-HKY2B5BUEQJMLE2H56FP/ed_fornieles_tulip-fever.jpg", "Tulip Fever, 2017, video still", "https://www.arsenalcontemporary.com/ny/exhib/detail/the-finiliar-ed-fornieles"),
            img("https://images.squarespace-cdn.com/content/v1/5afb5bb0fcf7fd7aebb47cac/1557941529779-ULWQ48GFYUAYEP3G3ZVW/ed_fornieles-install-2.jpg", "Installation view", "https://www.arsenalcontemporary.com/ny/exhib/detail/the-finiliar-ed-fornieles"),
            img("https://images.squarespace-cdn.com/content/v1/5afb5bb0fcf7fd7aebb47cac/1557941528453-PFCVYFL0YF468LB7L947/ed_fornieles_finiliar-selection1-2-.jpg", "Finiliar character selection", "https://www.arsenalcontemporary.com/ny/exhib/detail/the-finiliar-ed-fornieles"),
            img("https://images.squarespace-cdn.com/content/v1/5afb5bb0fcf7fd7aebb47cac/1557941529935-1DKF3AR1QOG32ECPBRLY/ed_fornieles-install-3.jpg", "Installation view", "https://www.arsenalcontemporary.com/ny/exhib/detail/the-finiliar-ed-fornieles"),
            img("https://images.squarespace-cdn.com/content/v1/5afb5bb0fcf7fd7aebb47cac/1557941530296-990RQ9YQVO60GJRFP86G/ed_fornieles-install-5.jpg", "Installation view", "https://www.arsenalcontemporary.com/ny/exhib/detail/the-finiliar-ed-fornieles"),
        ],
    },
    {
        "id": "finiliar-land-nabi", "title": "Finiliar Land (Neotopia: Data and Humanity)", "status": "completed",
        "date": "2017–2018", "venue": "Art Center Nabi, Seoul — group show 'Neotopia: Data and Humanity' (shown at COMO venue, 15 Jan – 28 Feb 2018)",
        "short": "Fornieles contributed 'Finiliar Land' (2017) to Art Center Nabi's group exhibition 'Neotopia: Data and Humanity', which gathered artworks using data from various fields to imagine a more humane society. The Finiliar are creature-avatars whose emotional state is tied to live financial/market data.",
        "question": "Can data be made humane — can people form caring, affective bonds with abstract data streams when those streams are embodied as living creatures?",
        "themes": ["data", "affect", "finance/markets", "avatars", "creatures", "empathy", "digital economy", "Finiliar"],
        "machine": "Living 'Finiliar' creatures whose wellbeing is driven by live data feeds, making abstract data legible as emotional state.",
        "real_world": "Financial markets; data society.",
        "sources": ["https://nabi.or.kr/en/page/board_view.php?brd_idx=795&brd_id=project", "https://en.wikipedia.org/wiki/Art_Center_Nabi"],
        "confidence": "medium",
        "notes": "Part of [[finiliar]]. Creature/financial-data mechanic inferred from the broader Finiliar body of work. Exhibition supported by the Netherlands Embassy, Japan Foundation Seoul, Goethe-Institut Korea.",
        "images": [
            img("http://artnabi.gabia.io/upload_file/board/editor/edf.jpg", "Ed Fornieles, Finiliar Land, 2017", "https://nabi.or.kr/en/page/board_view.php?brd_idx=795&brd_id=project", "Art Center Nabi"),
        ],
    },
    {
        "id": "crypto-certs", "title": "Crypto Certs", "status": "completed",
        "date": "2019", "venue": "Blockchain (Ethereum) art-finance project; reported via Dazed",
        "short": "A blockchain-based art-financing scheme. Crypto Certs were certificate artworks (~€550) each containing a key hidden under a scratch panel, linked to an Ethereum fund. As more certs sold, the pooled fund grew and financed new artwork; collectors could 'cash out' by scratching the panel — destroying the artwork but releasing their share of profits. It replaces single-collector dependence with a distributed network of micro-patrons.",
        "question": "When art becomes a speculative financial instrument, what does it take to retain the work's integrity — and can artists be financed by a decentralized network rather than individual collectors?",
        "themes": ["blockchain", "Ethereum", "crypto", "art finance", "speculation", "patronage", "decentralization", "certificates"],
        "machine": "A tokenized investment/patronage instrument with a destructive 'cash-out' mechanic tied to a shared crypto fund.",
        "real_world": "Art market finance; crypto funds; patronage.",
        "sources": ["https://www.dazeddigital.com/art-photography/article/42884/1/ed-fornieles-crypto-certs-bitcoin-project-proposes-way-to-finance-artists"],
        "confidence": "medium",
        "notes": "Only the 2019 announcement is documented; long-term uptake/outcome not confirmed.",
        "images": [
            img("https://images-prod.dazeddigital.com/1400/azure/dazed-prod/1250/8/1258220.jpg", "Crypto Certs artwork", "https://www.dazeddigital.com/art-photography/article/42884/1/ed-fornieles-crypto-certs-bitcoin-project-proposes-way-to-finance-artists", "Dazed"),
            img("https://images-prod.dazeddigital.com/786/azure/dazed-prod/1250/8/1258221.jpg", "Crypto Certs artwork", "https://www.dazeddigital.com/art-photography/article/42884/1/ed-fornieles-crypto-certs-bitcoin-project-proposes-way-to-finance-artists", "Dazed"),
            img("https://images-prod.dazeddigital.com/786/azure/dazed-prod/1250/8/1258222.jpg", "Crypto Certs artwork", "https://www.dazeddigital.com/art-photography/article/42884/1/ed-fornieles-crypto-certs-bitcoin-project-proposes-way-to-finance-artists", "Dazed"),
        ],
    },
    {
        "id": "8-ball-sages", "title": "8 Ball Sages", "status": "active",
        "date": "2024", "venue": "SOLOS. (NFT platform), curated by Nico Epstein; launch at Shoreditch Arts Club, London (13 Sept 2024)",
        "short": "An AI-powered NFT series of 500 responsive, uniquely animated characters acting as interactive virtual advisors/fortune-tellers that mimic companionship and dispense 'wisdom'. References the 1940s Magic 8 Ball, Zoltar fairground fortune-tellers, and the film A.I. Artificial Intelligence; probes how algorithmic confidants compare to human bonds and critiques the commodification of wisdom.",
        "question": "How does AI-mediated companionship and on-demand 'wisdom' reshape human trust, introspection and intimacy?",
        "themes": ["AI", "NFT", "companionship", "fortune-telling", "nostalgia", "algorithmic trust", "consumerism", "animated characters"],
        "machine": "Interactive AI agents distributed as blockchain NFTs whose moods/behaviours respond to external factors.",
        "real_world": "AI chatbots/companions; NFT platforms; fortune-telling toys.",
        "sources": ["https://fadmagazine.com/2024/07/29/ed-fornieles-new-series-coming-this-september-from-solos/"],
        "confidence": "high",
        "notes": "Part of the SOLOS series noted alongside [[inside-out-2]].",
        "images": [
            img("https://fadmagazine.com/wp-content/uploads/Hear-m07.png", "8 Ball Sages character", "https://fadmagazine.com/2024/07/29/ed-fornieles-new-series-coming-this-september-from-solos/", "FAD Magazine"),
            img("https://fadmagazine.com/wp-content/uploads/devil_-01.png", "8 Ball Sages character", "https://fadmagazine.com/2024/07/29/ed-fornieles-new-series-coming-this-september-from-solos/", "FAD Magazine"),
            img("https://fadmagazine.com/wp-content/uploads/hair_fm_angel_v1-1.png", "8 Ball Sages character", "https://fadmagazine.com/2024/07/29/ed-fornieles-new-series-coming-this-september-from-solos/", "FAD Magazine"),
            img("https://fadmagazine.com/wp-content/uploads/hair_greek_M_v1-1-2.png", "8 Ball Sages character", "https://fadmagazine.com/2024/07/29/ed-fornieles-new-series-coming-this-september-from-solos/", "FAD Magazine"),
        ],
    },
    {
        "id": "cute-somerset-house", "title": "CUTE — Adventures in Symbolic Love Tyranny", "status": "completed",
        "date": "2024 (25 Jan – 14 Apr)", "venue": "CUTE group exhibition, Embankment Galleries, Somerset House, London",
        "short": "Fornieles' new commission for the CUTE group show: a film, 'Adventures in Symbolic Love Tyranny', in which high-pitched, chubby-cheeked NFT-style characters discuss how cuteness 'weaponizes' itself — gaining power by professing its own demure powerlessness and thereby directing all interactions with it. Extends his Finiliar-era interest in cuteness as a tool of power and capital.",
        "question": "How does cuteness operate as a covert mechanism of power and control rather than mere harmlessness?",
        "themes": ["cuteness", "power", "NFT aesthetics", "film", "capital", "affect", "control"],
        "machine": "A film essay voiced by cute animated/NFT characters within a major thematic group show.",
        "real_world": "Kawaii/cute consumer culture; NFT aesthetics.",
        "sources": ["https://www.somersethouse.org.uk/whats-on/cute", "https://apollo-magazine.com/cute-somerset-house-review/", "https://spikeartmagazine.com/articles/review-cute-somerset-house-london-2024", "https://outland.art/cute-money/"],
        "confidence": "high",
        "notes": "Film title confirmed via Outland/Spike snippets. No Fornieles-specific image file URLs extracted from the Somerset House page; worth a human re-check (Outland 'Cute Money' returned 503).",
        "images": [],
    },
    {
        "id": "der-geist-flesh-feast", "title": "Der Geist: Flesh Feast", "status": "completed",
        "date": "2016", "venue": "Arratia Beer, Berlin",
        "short": "An exhibition (film, sculpture, objects, installation) chronicling Fornieles' attempt to follow a corporate-zen 'self-management diet', with his own body as the real site of intervention. The video 'Der Geist' (2016) centres on a cartoon fox and his success with the 'Bulletproof Diet', surrounded by figurines, printed wall-carpets, diet-packs and motivational messaging.",
        "question": "How do wellness, productivity and self-optimization regimes colonize and reprogram the body and self?",
        "themes": ["self-optimization", "wellness culture", "the body", "corporate zen", "diet", "cartoon/animation", "motivational messaging"],
        "machine": "A self-management/diet regime as a behavioural system, documented and satirized across media.",
        "real_world": "Wellness/biohacking culture; productivity self-help.",
        "sources": ["https://en.wikipedia.org/wiki/Ed_Fornieles", "https://www.schirn.de/en/magazine/interviews/upgrade_your_mind/", "https://www.carlosishikawa.com/artists/edfornieles/"],
        "confidence": "high",
        "notes": "Continues the body/self-optimization theme; conceptually adjacent to the wellness logic of [[jupiter-ascending-sauna]].",
        "images": [],
    },
    {
        "id": "truth-table", "title": "Truth Table", "status": "completed",
        "date": "2016", "venue": "Cura / Basement Roma, Rome (also a VR component within [[seed]], 2017)",
        "short": "A pornographic VR work whose variables are randomized roughly every 20 seconds, presented as 'The Truth Table Experience' (a VR set and bed). Part of Fornieles' simulation strand, using combinatorial/randomized systems to generate experience.",
        "question": "What happens to desire and identity when experience is generated by a randomized combinatorial system?",
        "themes": ["VR", "simulation", "pornography", "randomization", "combinatorics", "desire", "the body"],
        "machine": "A VR experience driven by a 'truth table' of randomized variables (changing ~every 20s), with a physical bed interface.",
        "real_world": "VR; online pornography; recommendation/combinatorial systems.",
        "sources": ["https://curamagazine.com/exhibitions/ed-fornieles-truth-table/", "https://basementroma.org/exhibitions/ed-fornieles/"],
        "confidence": "medium",
        "notes": "Shown at Basement Roma (2016) and again as a component of [[seed]] (2017). Exact dates worth confirming.",
        "images": [],
    },
    {
        "id": "sim-vol-1-existential-risk", "title": "Sim Vol. 1: Existential Risk", "status": "completed",
        "date": "2017", "venue": "Alyssa Davis Gallery, New York; presented via Schirn PEACE; component of [[seed]]",
        "short": "A simulation/world-building work taking The Sims as a reference. Participants enact scenarios such as sick 'players' being cared for by co-players who risk infection, escalating to extreme in-game acts (e.g. killing a child character deemed a security risk). A display case holds a 'Game Book' — a manual to the simulation. It uses game mechanics to stage emergent, often dark social behaviour and questions of risk and survival.",
        "question": "How do groups rationalize cruelty, risk and sacrifice under the rule-systems of a simulation — and what does that reveal about real social behaviour?",
        "themes": ["simulation", "The Sims", "role-play", "existential risk", "emergent behaviour", "game logic", "rulebook"],
        "machine": "A Sims-inspired live/role-play simulation with imposed rule-sets producing emergent behaviour, plus a 'Game Book' manual.",
        "real_world": "Video-game simulation; existential-risk / systems modelling.",
        "sources": ["https://www.schirn-peace.org/en/post/ed-fornieles-sim-vol-1-existential-risk/", "https://basementroma.org/exhibitions/ed-fornieles/", "https://www.carlosishikawa.com/artists/edfornieles/"],
        "confidence": "medium",
        "notes": "The brief's 'Simulation Machine' most plausibly maps to this Sim strand; that exact title not independently confirmed. Conceptually adjacent to [[cel]].",
        "images": [],
    },
    {
        "id": "despicable-me-2", "title": "Despicable Me 2 (incl. 'Pony Hoof')", "status": "completed",
        "date": "2013", "venue": "Mihai Nicodim Gallery, Los Angeles",
        "short": "An exhibition organised around a fabricated virtual muse ('Britney Rivers'), using candy colours, glitter, mirrors and fairy lights alongside darker, self-mocking transgression. The sculpture 'Pony Hoof' — a large soft toy brutally impaled on a gallows — pairs infantile aesthetics with violence.",
        "question": "How do childhood/infantile aesthetics conceal or coexist with violence and cruelty?",
        "themes": ["infantilism", "cuteness", "violence", "sculpture", "soft toy", "fiction", "fabricated persona"],
        "machine": "A gallery installation organised around a fabricated social-media persona (Britney Rivers).",
        "real_world": "Social-media personas; consumer kids' culture.",
        "sources": ["https://www.artnet.com/artists/ed-fornieles/", "https://artreview.com/reviews/october_2013_review_ed_fornieles/", "https://en.wikipedia.org/wiki/Ed_Fornieles"],
        "confidence": "medium",
        "notes": "The brief's 'Pony' most plausibly refers to 'Pony Hoof' here; no standalone project named simply 'Pony' found. Confirm with Ed.",
        "images": [],
    },
    {
        "id": "workland", "title": "Workland: the fence is a narrow place", "status": "completed",
        "date": "2015", "venue": "Chateau Shatto, Los Angeles",
        "short": "A Los Angeles exhibition in Fornieles' mid-career period exploring work, systems and constructed social space. (Lightly researched — a lead for deeper work.)",
        "question": "TKTK — not yet documented in sources consulted.",
        "themes": ["work", "systems", "installation"],
        "machine": "TKTK — to research.",
        "real_world": "Labour / workplace systems (inferred from title).",
        "sources": ["https://www.carlosishikawa.com/artists/edfornieles/"],
        "confidence": "low",
        "notes": "Lead surfaced from CV; not deeply researched. Title also cited as 'Workland'. Needs a dedicated research pass.",
        "images": [],
    },
    {
        "id": "cursed-images", "title": "Cursed Images", "status": "completed",
        "date": "2019", "venue": "Lisa Kandlhofer, Vienna",
        "short": "A 2019 exhibition at Galerie Kandlhofer, Vienna, referencing the 'cursed images' internet genre. (Lightly researched — a lead for deeper work; likely related to the image-culture concerns of [[associations]].)",
        "question": "TKTK — not yet documented in sources consulted.",
        "themes": ["internet images", "cursed images", "image culture", "meme"],
        "machine": "TKTK — to research.",
        "real_world": "Internet meme/image genres.",
        "sources": ["https://www.carlosishikawa.com/artists/edfornieles/"],
        "confidence": "low",
        "notes": "Lead surfaced from CV/Wikipedia; not deeply researched. Verify venue/dates.",
        "images": [],
    },
    {
        "id": "do-disturb-palais-de-tokyo", "title": "Do Disturb / 'The Fortress of Solitude' (Palais de Tokyo)", "status": "completed",
        "date": "2016 (8–10 Apr)", "venue": "Palais de Tokyo, Paris — 'Do Disturb' non-stop performance festival",
        "short": "Fornieles took part in Palais de Tokyo's 'Do Disturb — Festival non-stop' (8–10 April 2016), a non-stop festival of performance, dance, circus and design. His artist bios name a Palais de Tokyo performance 'The Fortress of Solitude'; the two are most plausibly the same occasion.",
        "question": "TKTK — specific mechanic not documented.",
        "themes": ["performance", "festival", "immersive", "role-play"],
        "machine": "A live performance within a non-stop festival format; specific mechanic undocumented.",
        "real_world": "Live-art festival.",
        "sources": ["https://www.palaisdetokyo.com/en/event/do-disturb-0", "https://www.somersethouse.org.uk/a-z-community-directory/ed-fornieles", "https://en.wikipedia.org/wiki/Ed_Fornieles"],
        "confidence": "low",
        "notes": "The 'Fortress of Solitude' ↔ Do Disturb 2016 link is inferred, not confirmed (searches polluted by Superman/Lethem). Needs human verification of exact title/date pairing.",
        "images": [],
    },
    {
        "id": "trial-trial", "title": "Trial Trial", "status": "completed",
        "date": "2026", "venue": "Lancaster Rooms, Somerset House, London — 'States of Exception', n-Space residency (curated by Linda Rocco)",
        "short": "A live, role-played court hearing (LARP) devised collectively by the n-Space fellows (dmstfctn, Ed Fornieles, Agnes Cameron, Hannah Cobb, Leela Jadhav). It revives the medieval English 'deodand' rule (an object that caused a death could be forfeited) and stages a simulated trial in which a contemporary dual-use technology is put on trial as if legally responsible for harm, using UK governance-by-procurement as its frame.",
        "question": "Could existing British legal frameworks hold complex technological systems morally and legally accountable — and how does a configuration of governance come to seem unavoidable?",
        "themes": ["LARP", "law", "deodand", "dual-use technology", "military", "governance", "procurement", "accountability", "simulation"],
        "machine": "A live role-played courtroom / mock-trial format used to interrogate a real technical system.",
        "real_world": "English law (deodand); technology governance and procurement.",
        "sources": ["https://www.somersethouse.org.uk/whats-on/states-of-exception-2026/trial-trial"],
        "confidence": "high",
        "notes": "A collaborative n-Space fellows work, not solo. No image file URLs extractable (placeholder images only). Supported by Rothschild Foundation, UAL CCI, Goldsmiths, AND, SODA.",
        "images": [],
    },
]


def build_card(p: dict) -> str:
    themes = ", ".join(p["themes"])
    sources = "\n".join(f"  - {u}" for u in p["sources"])
    fm = [
        "---",
        f"project_id: {p['id']}",
        f"title: {p['title']}",
        f"date: {p['date']}",
        f"status: {p['status']}",
        "confidentiality: public",
        f"source_materials: web research June 2026 (public sources; see Sources)",
        f"related_assets: see image_manifests/public_gallery_manifest.jsonl (project: {p['id']})",
        f"research_confidence: {p['confidence']}",
        "needs_review: true",
        "---",
        "",
        AUTOGEN_MARKER,
        "",
        f"# {p['title']}",
        "",
        "## Short description",
        "",
        p["short"],
        "",
        "## Core question",
        "",
        p["question"],
        "",
        "## Social machine",
        "",
        p["machine"],
        "",
        "## Fictional device",
        "",
        "TKTK — interview Ed.",
        "",
        "## Real-world system it attaches to",
        "",
        p.get("real_world", "TKTK"),
        "",
        "## Audience / participant role",
        "",
        "TKTK — interview Ed.",
        "",
        "## Performer / subject role",
        "",
        "TKTK — interview Ed.",
        "",
        "## Emotional engine",
        "",
        "TKTK — interview Ed.",
        "",
        "## Ethical danger",
        "",
        "TKTK — interview Ed.",
        "",
        "## Aesthetic world",
        "",
        f"Tags: {themes}.",
        "",
        "## Research method",
        "",
        "TKTK — interview Ed.",
        "",
        "## Use of real material",
        "",
        "TKTK — interview Ed.",
        "",
        "## Use of fiction",
        "",
        "TKTK — interview Ed.",
        "",
        "## Emergent behaviour",
        "",
        "TKTK — interview Ed.",
        "",
        "## Residue / documentation / afterlife",
        "",
        f"Images catalogued in image_manifests/public_gallery_manifest.jsonl (project: {p['id']}). Further documentation TKTK.",
        "",
        "## What this project teaches the studio",
        "",
        "TKTK — interview Ed.",
        "",
        "## What failed or remained unresolved",
        "",
        "TKTK — interview Ed.",
        "",
        "## Possible mutations",
        "",
        "TKTK — interview Ed.",
        "",
        "## Assistant behaviour rules derived from this project",
        "",
        "TKTK — interview Ed.",
        "",
        "## Venue / context",
        "",
        p["venue"],
        "",
        "## Sources",
        "",
        sources,
        "",
    ]
    if p["notes"]:
        fm += ["## Research notes (needs review)", "", p["notes"], ""]
    return "\n".join(fm)


def asset_id_for(project_id: str, url: str) -> str:
    return f"img_{project_id}_{hashlib.sha1(url.encode()).hexdigest()[:8]}"


def main() -> int:
    written, skipped = 0, 0
    for p in DATA:
        if p["id"] in PROTECTED:
            skipped += 1
        else:
            dest = PROJECT_CARDS_DIR / p["status"] / f"{p['id']}.md"
            if dest.exists():
                existing = dest.read_text(encoding="utf-8", errors="replace")
                if AUTOGEN_MARKER not in existing:
                    print(f"  ~ skip (hand-edited, no marker): {dest.relative_to(PROJECT_CARDS_DIR.parent)}")
                    skipped += 1
                    continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(build_card(p), encoding="utf-8")
            written += 1
            print(f"  + card: {dest.relative_to(PROJECT_CARDS_DIR.parent)}")

    # merge images into manifest (dedupe by asset_id)
    existing = [r for r in read_jsonl(MANIFEST) if r.get("asset_id") != "img_seed_placeholder"]
    by_id = {r["asset_id"]: r for r in existing if r.get("asset_id")}
    added = 0
    for p in DATA:
        for im in p["images"]:
            aid = asset_id_for(p["id"], im["url"])
            if aid in by_id:
                continue
            by_id[aid] = {
                "asset_id": aid,
                "project": p["id"],
                "type": "image",
                "source_url": im["url"],
                "local_path": "",
                "drive_url": "",
                "caption": im["caption"],
                "description": "",
                "conceptual_tags": p["themes"],
                "visual_tags": [],
                "people_visible": False,
                "rights": im.get("rights", "") or "verify before reuse",
                "photographer": im.get("rights", "") if "Photo" in im.get("rights", "") or "©" in im.get("rights", "") else "",
                "source_page": im["page"],
                "confidentiality": "public",
            }
            added += 1
    write_jsonl(MANIFEST, list(by_id.values()))

    print(f"\nCards written: {written}, skipped (protected/hand-edited): {skipped}")
    print(f"Image records: {len(by_id)} total ({added} new) -> {MANIFEST.relative_to(PROJECT_CARDS_DIR.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
