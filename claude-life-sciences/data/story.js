/* The Discovery Stack — narrative section data. Sources for every figure are
 * listed in data/network.js (window.NETWORK.sources) or inline here. */
(function () {
  const S = window.NETWORK.sources;

  /* ── The Explorers: people and institutions (x/y in a 1000×620 box) ── */
  const explorers = {
    nodes: [
      { id: "dario", kind: "person", name: "Dario Amodei", role: "CEO, Anthropic", x: 500, y: 70,
        sections: [["Vision", ["Author of “Machines of Loving Grace” (2024): AI could compress 50–100 years of biological progress into 5–10."]],
                   ["On Claude Science", ["“We don't know for sure if that's going to work out. But… we're seeing the beginnings of it.”"]]] },
      { id: "eka", kind: "person", name: "Eric Kauderer-Abrams", role: "Head of Life Sciences, Anthropic", x: 300, y: 170,
        sections: [["Role", ["Leads Anthropic's life sciences effort, from Claude for Life Sciences to Claude Science."]],
                   ["In his words", ["“By far the greatest opportunity [to serve humanity's long-term well-being] is in the life sciences.”"]]] },
      { id: "cool", kind: "person", name: "Jonah Cool", role: "Life Sciences Partnerships, Anthropic", x: 700, y: 170,
        sections: [["Role", ["Builds the partnerships with the Allen Institute, HHMI and industry."]],
                   ["In his words", ["Systems that “amplify scientific intuition rather than replace it.”"]]] },
      { id: "tara", kind: "person", name: "Alexander Tarashansky", role: "Claude Science lead, Anthropic", x: 150, y: 330,
        sections: [["Role", ["Led development of Claude Science and demonstrated it on drug-candidate search for phenylketonuria (PKU), a rare metabolic disease."]]] },
      { id: "jumper", kind: "person", name: "John Jumper", role: "AlphaFold co-creator, Nobel 2024", x: 850, y: 330,
        sections: [["2026", ["Announced in June 2026 that he was joining Anthropic."]],
                   ["Legacy", ["AlphaFold has predicted more than 200 million protein structures."]]] },
      { id: "csci", kind: "org", abbr: "CS", name: "Claude Science", role: "AI research workbench", x: 360, y: 360,
        sections: [["What it is", ["Multi-agent workbench with 60+ scientific skills and connectors, launched June 2026."]]] },
      { id: "anth", kind: "org", abbr: "A\\", name: "Anthropic", role: "Maker of Claude", x: 560, y: 290,
        sections: [["2026", ["Opened its own biology lab and started drug programs for neglected diseases."]]] },
      { id: "regev", kind: "person", name: "Aviv Regev", role: "Head of Research, Genentech", x: 830, y: 520,
        sections: [["With Claude", ["Genentech uses Claude to build infrastructure for autonomous discovery."]]] },
      { id: "lecoq", kind: "person", name: "Jérôme Lecoq", role: "Allen Institute", x: 560, y: 560,
        sections: [["With Claude", ["Built multi-agent review templates (about 20 skills) and produced 10+ in-depth computational reviews, many over 100 pages."]]] },
      { id: "ruetten", kind: "person", name: "Virginie Ruetten", role: "HHMI Janelia", x: 700, y: 420,
        sections: [["With Claude", ["Unified seven microscopy vendor programs through the Model Hardware Standard."]]] },
      { id: "francis", kind: "person", name: "Stephen Francis", role: "UCSF Brain Tumor Center", x: 120, y: 520,
        sections: [["With Claude", ["Germline variant work-ups in roughly one-tenth of the time."]]] },
      { id: "white", kind: "person", name: "Andrew White", role: "Edison Scientific", x: 330, y: 560,
        sections: [["With Claude", ["Builds AI scientists; calls Claude excellent at coding and understanding figures."]]] },
      { id: "doustdar", kind: "person", name: "Mike Doustdar", role: "CEO, Novo Nordisk", x: 930, y: 170,
        sections: [["With Claude", ["Novo's R&D collaboration with Anthropic aims to “supercharge our R&D.”"]]] },
      { id: "saxonov", kind: "person", name: "Serge Saxonov", role: "CEO, 10x Genomics", x: 80, y: 170,
        sections: [["With Claude", ["Single-cell and spatial analysis through Claude, “without needing a computational background.”"]]] },
    ],
    links: [["dario", "anth"], ["eka", "anth"], ["cool", "anth"], ["tara", "csci"], ["eka", "csci"], ["jumper", "anth"],
            ["csci", "anth"], ["regev", "anth"], ["lecoq", "csci"], ["lecoq", "cool"], ["ruetten", "cool"], ["francis", "csci"],
            ["white", "anth"], ["doustdar", "anth"], ["doustdar", "csci"], ["saxonov", "eka"], ["ruetten", "anth"]],
  };

  /* ── From weeks to minutes: before → after rows ── */
  const accelerations = [
    { task: "Clinical study report, first draft", who: "Novo Nordisk · NovoScribe", before: "10+ weeks", after: "~10 min", note: "Built on Claude by an 11-person team, drawing on approved source content.", src: S.novo },
    { task: "Genome-wide association study", who: "Biomni · Stanford", before: "Months", after: "~20 min", note: "An autonomous agent chose the tools, ran the analysis and reported back.", src: S.accel },
    { task: "Wearables analysis, 450+ files", who: "Biomni · Stanford", before: "~3 weeks", after: "35 min", note: "Compared with an expert's estimate for the same work.", src: S.biomni },
    { task: "Ebola situation report", who: "WHO Africa · 2026 outbreak", before: "A full day", after: "< 1 hour", note: "Field teams got that time back during an active outbreak.", src: S.ebola },
    { task: "Phase II trial protocol draft", who: "Clinical trial protocol skill", before: "Many days", after: "~1 hour", note: "Demonstrated with a Parkinson's disease protocol.", src: { title: "Fortune — Anthropic unveils Claude for Healthcare", url: "https://fortune.com/2026/01/11/anthropic-unveils-claude-for-healthcare-and-expands-life-science-features-partners-with-healthex-to-let-users-connect-medical-records/" } },
    { task: "Protein design campaign, per target", who: "Optimized open models", before: "~$10,000", after: "~$150", note: "Claude made 30+ biomolecular models about 4× faster and released the code openly.", src: S.uplift },
  ];

  /* ── The research loop ── */
  const loop = [
    { id: "ask", name: "Ask", text: "Choose a problem worth solving. A scientific problem-selection skill pressure-tests the question before any work begins." },
    { id: "read", name: "Read", text: "Search 35M+ PubMed articles, preprints and journals through connectors, with citations to check." },
    { id: "hypothesize", name: "Hypothesize", text: "Look across screens, databases and papers for patterns — like the MIT lab that surfaced a pathway other models had missed." },
    { id: "design", name: "Design", text: "Draft protocols, clone designs and protein binders. On Protocol QA, Claude outscored the human expert baseline." },
    { id: "test", name: "Test", text: "Human scientists run the experiments at the bench, from Anthropic's lab to partners like Adaptyv Bio. Reality is the judge." },
    { id: "analyze", name: "Analyze", text: "Process raw NMR, LC-MS and single-cell data in minutes, with reproducible code and figures. Results feed the next question." },
  ];

  /* ── The connected lab: sankey-lite ── */
  const flow = {
    columns: ["Knowledge", "Lab systems", "Claude", "Outcomes"],
    nodes: [
      { id: "lit", col: 0, name: "Literature", sub: "PubMed · bioRxiv · Wiley" },
      { id: "mol", col: 0, name: "Molecules & targets", sub: "ChEMBL · Open Targets" },
      { id: "trials", col: 0, name: "Clinical trials", sub: "ClinicalTrials.gov · Medidata" },
      { id: "eln", col: 1, name: "Lab notebooks", sub: "Benchling" },
      { id: "sc", col: 1, name: "Single-cell & spatial", sub: "10x Genomics" },
      { id: "inst", col: 1, name: "Instruments", sub: "Model Hardware Standard" },
      { id: "skills", col: 2, name: "Agent Skills", sub: "scRNA QC · Nextflow · protocols" },
      { id: "code", col: 2, name: "Claude Code", sub: "Pipelines & analysis" },
      { id: "agents", col: 2, name: "Claude Science", sub: "Multi-agent workbench" },
      { id: "disc", col: 3, name: "Discoveries", sub: "New enzyme family" },
      { id: "designs", col: 3, name: "Designs", sub: "354 lab-confirmed binders" },
      { id: "docs", col: 3, name: "Protocols & reports", sub: "Weeks → minutes" },
      { id: "health", col: 3, name: "Public health", sub: "Outbreak response" },
    ],
    links: [["lit", "eln"], ["lit", "agents"], ["mol", "agents"], ["mol", "code"], ["trials", "skills"], ["eln", "skills"], ["eln", "agents"],
            ["sc", "skills"], ["sc", "code"], ["inst", "agents"], ["skills", "docs"], ["skills", "health"], ["code", "designs"],
            ["code", "disc"], ["agents", "disc"], ["agents", "designs"], ["agents", "health"], ["skills", "disc"]],
    stats: [
      { value: "60+", label: "scientific skills and connectors in Claude Science" },
      { value: "354", label: "Claude-designed protein binders confirmed in the wet lab" },
      { value: "950", label: "agents searching in parallel for new enzymes" },
      { value: "10,000", label: "free or discounted seats for scientists" },
    ],
  };

  /* ── Five frontiers ── */
  const frontiers = [
    { id: "discovery", name: "Discovery", sub: "Finding what no one has looked for yet",
      possible: ["Screen hundreds of thousands of sequences in parallel", "Interpret CRISPR screens with stated confidence", "Read the literature, then check every citation"],
      practice: ["~950 agents screened 200,000 reverse transcriptases in 21 hours and surfaced a new CRISPR-like family, which the lab then expressed", "MIT Cheeseman lab: a pathway other models had dismissed", "Allen Institute: 10+ in-depth computational reviews"] },
    { id: "design", name: "Molecular design", sub: "From idea to molecule at a fraction of the cost",
      possible: ["Run the full open protein-design stack autonomously", "Speed up structure models such as AlphaFold3 and Boltz-2", "Analyze raw NMR and LC-MS data without vendor software"],
      practice: ["354 binders across 14 of 15 targets; 22.6–35.1% hit rate against a typical 10–15%", "Best binder affinity: 3.9 nM", "Design cost per target: ~$10,000 → ~$150"] },
    { id: "clinical", name: "Clinical development", sub: "Better trials, designed faster",
      possible: ["Draft trial protocols from registries and prior studies", "Model site selection and enrollment risk", "Generate real-world evidence at scale"],
      practice: ["ICON: Claude in trial feasibility and enrollment planning", "Genmab: clinical development agents with human oversight", "Phase II protocol draft: days → about an hour"] },
    { id: "regulatory", name: "Regulatory & manufacturing", sub: "Hand the paperwork to machines",
      possible: ["Draft clinical study reports and submissions", "Turn instrument data into standard formats", "Support quality work such as CAPA and batch release"],
      practice: ["Novo Nordisk: CSR first draft, 10+ weeks → ~10 minutes", "Bluenote: regulatory documents 50–75% faster", "BMS: agents across regulatory and manufacturing"] },
    { id: "health", name: "Global health", sub: "Speed where it matters most",
      possible: ["Compile outbreak situation reports", "Assemble viral genomes and trace spread", "Organize vaccine-candidate evidence"],
      practice: ["WHO Africa: situation reports in under an hour", "INRB (DR Congo): Ebola genome assembly and phylogenies", "CEPI: vaccine-candidate data organized"] },
  ];

  /* ── A global effort: [lon, lat] ── */
  const places = [
    { name: "Anthropic Life Sciences Lab", place: "San Francisco Bay Area", ll: [-122.27, 37.8], kind: "anthropic", text: "Claude-directed research with human scientists at the bench." },
    { name: "Stanford · Biomni", place: "Palo Alto, CA", ll: [-122.17, 37.43], kind: "research", text: "A general biomedical agent built on Claude, used by 7,000+ labs." },
    { name: "UCSF", place: "San Francisco, CA", ll: [-122.46, 37.76], kind: "research", text: "Germline work-ups in roughly one-tenth of the time." },
    { name: "Genentech", place: "South San Francisco, CA", ll: [-122.39, 37.65], kind: "pharma", text: "Infrastructure for autonomous discovery." },
    { name: "Allen Institute", place: "Seattle, WA", ll: [-122.33, 47.62], kind: "research", text: "Multi-agent systems for multi-omic research." },
    { name: "HHMI Janelia", place: "Ashburn, VA", ll: [-77.46, 39.07], kind: "research", text: "AI agents connected to microscopes." },
    { name: "Broad Institute", place: "Cambridge, MA", ll: [-71.09, 42.36], kind: "research", text: "Claude agents on the Terra platform." },
    { name: "Bristol Myers Squibb", place: "Princeton, NJ", ll: [-74.66, 40.35], kind: "pharma", text: "30,000+ employees across R&D and manufacturing." },
    { name: "Regeneron", place: "Tarrytown, NY", ll: [-73.86, 41.08], kind: "pharma", text: "Literature reviews that once took days." },
    { name: "US National Labs", place: "Genesis Mission", ll: [-106.3, 35.88], kind: "research", text: "17 national labs; pandemic early warning and drug discovery." },
    { name: "Novo Nordisk", place: "Bagsværd, Denmark", ll: [12.45, 55.76], kind: "pharma", text: "Clinical study reports: weeks to minutes." },
    { name: "Genmab", place: "Copenhagen, Denmark", ll: [12.57, 55.68], kind: "pharma", text: "Agents for clinical development." },
    { name: "Sanofi", place: "Paris, France", ll: [2.35, 48.86], kind: "pharma", text: "Company-wide daily use." },
    { name: "Owkin", place: "Paris, France", ll: [2.3, 48.9], kind: "tools", text: "Pathology Explorer agent via MCP." },
    { name: "ICON", place: "Dublin, Ireland", ll: [-6.26, 53.35], kind: "pharma", text: "Claude in clinical trial operations." },
    { name: "CEPI", place: "Oslo, Norway", ll: [10.75, 59.91], kind: "health", text: "Vaccine-candidate data during the Ebola response." },
    { name: "WHO Africa", place: "Brazzaville, Congo", ll: [15.28, -4.27], kind: "health", text: "Outbreak situation reports in under an hour." },
    { name: "INRB", place: "Kinshasa, DR Congo", ll: [15.31, -4.44], kind: "health", text: "Viral genome assembly and phylogenetics for Ebola." },
  ];

  /* ── Timeline and horizon ── */
  const timeline = [
    { date: "Oct 2024", title: "Machines of Loving Grace", text: "Dario Amodei sets out the vision of a “compressed 21st century” for biology." },
    { date: "May 2025", title: "AI for Science", text: "API credits for high-impact research, and ASL-3 biosecurity safeguards switched on." },
    { date: "Oct 2025", title: "Claude for Life Sciences", text: "Connectors to Benchling, PubMed, 10x Genomics and more; the first scientific skills." },
    { date: "Jan 2026", title: "Healthcare & life sciences", text: "HIPAA-ready infrastructure; clinical trial, chemistry and target connectors." },
    { date: "Feb 2026", title: "Allen Institute & HHMI", text: "Partnerships to put agents alongside scientists and instruments." },
    { date: "Jun 2026", title: "Claude Science", text: "A multi-agent research workbench; Anthropic starts neglected-disease drug programs." },
    { date: "Aug 2026", title: "Proteins, validated", text: "354 Claude-designed binders confirmed in the wet lab, and a standard for lab hardware." },
    { date: "Sep 2026", title: "A new enzyme family", text: "About 950 agents surface a new CRISPR-like enzyme family, which the lab then expresses; trusted access launches." },
  ];

  const horizon = [
    { name: "Infectious disease", text: "Reliable prevention and treatment of nearly all natural infectious disease." },
    { name: "Cancer", text: "Mortality and incidence reduced by 95% or more." },
    { name: "Genetic disease", text: "Most genetic disease prevented, through better screening and treatment." },
    { name: "Alzheimer's", text: "Prevention of Alzheimer's and other neurodegenerative disease." },
    { name: "Chronic disease", text: "Far better treatment for diabetes, obesity and heart disease." },
    { name: "Healthy lifespan", text: "A plausible doubling of the healthy human lifespan." },
  ];

  /* ── Responsible by design ── */
  const safeguards = [
    { name: "Scientists stay in charge", text: "Claude proposes; people decide. Human scientists run all bench work in Anthropic's lab, and partners like Genmab deploy agents within defined guardrails and with human oversight.", src: S.genmab },
    { name: "Reality is the referee", text: "Claims are tested in the physical world. Protein designs were synthesized and measured by independent labs, and the data was published openly.", src: S.protein },
    { name: "Biosecurity by default", text: "Since 2025, Claude's most capable models run with ASL-3 protections, including classifiers designed to block dangerous biological misuse.", src: S.asl3 },
    { name: "Trusted access for deeper work", text: "The Life Sciences Verification Program vets research organizations before granting access to more powerful capabilities, with usage monitored against a stated purpose.", src: S.lsvp },
    { name: "Private by design", text: "Claude for Healthcare is HIPAA-ready, and personal health records people connect to Claude are never used to train models.", src: { title: "Fortune — Anthropic unveils Claude for Healthcare", url: "https://fortune.com/2026/01/11/anthropic-unveils-claude-for-healthcare-and-expands-life-science-features-partners-with-healthex-to-let-users-connect-medical-records/" } },
  ];

  window.STORY = { explorers, accelerations, loop, flow, frontiers, places, timeline, horizon, safeguards };
})();
