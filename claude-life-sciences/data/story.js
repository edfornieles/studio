/* The Discovery Stack — narrative data.
 * Sixty years of AI in the life sciences, with Claude as the through-line.
 * Every figure carries a source; items the research could not verify are left out
 * or worded as company claims. Research date: 30 September 2026. */
(function () {
  const S = window.NETWORK.sources;
  const src = (title, url) => ({ title, url });

  /* ── 1 · History: six eras, ~70 milestones ───────────────────────────
   * kind: "m" milestone · "lesson" a setback the field learned from · "claude" */
  const eras = [
    { id: "pioneers", name: "The Pioneers", span: "1962–1989", from: 1960, to: 1990,
      theme: "Scientists first turned computers on biology's hardest questions, and set the grand challenges the field would spend fifty years answering.",
      thread: "DENDRAL reasoned about molecules with hand-written rules. Today's models learn that reasoning from data. It is the same ambition, sixty years on." },
    { id: "book", name: "Reading the Book of Life", span: "1990–2011", from: 1990, to: 2012,
      theme: "Algorithms made the genome revolution possible, and open data plus open competitions made progress measurable.",
      thread: "The open resources built in this era — PubMed, GenBank, the Protein Data Bank — are the same ones Claude searches through connectors today." },
    { id: "learning", name: "Learning from Data", span: "2012–2019", from: 2012, to: 2020,
      theme: "Deep learning moved from recognizing cats to recognizing disease, and regulators began approving it for patients.",
      thread: "This era's hard lessons — validate prospectively, test independently — are why Claude's protein designs were measured by outside labs before anyone made a claim." },
    { id: "protein", name: "The Protein Revolution", span: "2020–2022", from: 2020, to: 2023,
      theme: "A fifty-year grand challenge fell, and the answers were given free to every scientist on Earth.",
      thread: "AlphaFold's open successors, OpenFold3 and Boltz-2, run inside Claude Science. In 2026, AlphaFold co-creator John Jumper joined Anthropic." },
    { id: "design", name: "Designing Life's Molecules", span: "2023–2024", from: 2023, to: 2025,
      theme: "AI went from predicting nature to designing new proteins and drugs, and earned two Nobel Prizes.",
      thread: "The first language-model lab agents (one study compared GPT-4 with an early Claude) pointed to a new role: not predicting one property, but running a whole workflow." },
    { id: "collab", name: "The Age of Collaborators", span: "2025–2026", from: 2025, to: 2027,
      theme: "AI became a working partner across the whole research loop, while human scientists still set the questions and run the tests.",
      thread: "Claude now coordinates the field's tools, from literature to protein design, on behalf of scientists who decide what is worth testing." },
  ];

  const milestones = [
    // Era 1 — The Pioneers
    { y: 1962, era: "pioneers", t: "QSAR is born", who: "Corwin Hansch & Toshio Fujita", what: "Showed that a drug's activity can be predicted mathematically from its chemical properties.", why: "The ancestor of every machine-learning model of drug activity.", src: src("Hansch & Fujita, JACS (1964)", "https://doi.org/10.1021/ja01062a035") },
    { y: 1965, era: "pioneers", t: "Atlas of Protein Sequence and Structure", who: "Margaret Oakley Dayhoff", what: "The first computer-compiled collection of protein sequences; her PAM matrices later quantified how proteins evolve.", why: "Widely seen as the beginning of bioinformatics.", src: src("Strasser, J. Hist. Biol. — Dayhoff's Atlas", "https://doi.org/10.1007/s10739-009-9221-0") },
    { y: 1965.5, era: "pioneers", t: "DENDRAL", who: "Feigenbaum, Lederberg, Djerassi, Buchanan · Stanford", what: "A program that inferred molecular structures from mass-spectrometry data.", why: "Often called the first expert system, and the first AI applied to real scientific reasoning.", src: src("NLM — Joshua Lederberg papers: DENDRAL", "https://profiles.nlm.nih.gov/spotlight/bb/feature/ai") },
    { y: 1969, era: "pioneers", t: "Levinthal's paradox", who: "Cyrus Levinthal", what: "Proteins cannot find their shape by random search, yet they fold in milliseconds.", why: "Framed protein folding as a grand challenge, answered at scale only in 2020.", src: src("Levinthal (1969)", "https://faculty.cc.gatech.edu/~turk/bio_sim/articles/proteins_levinthal_1969.pdf") },
    { y: 1970, era: "pioneers", t: "Needleman–Wunsch alignment", who: "Saul Needleman & Christian Wunsch", what: "A dynamic-programming method to align two sequences optimally.", why: "The mathematical foundation of sequence comparison.", src: src("J. Mol. Biol. (1970)", "https://doi.org/10.1016/0022-2836(70)90057-4") },
    { y: 1971, era: "pioneers", t: "Protein Data Bank founded", who: "Brookhaven National Laboratory", what: "Began with 7 structures; it now holds more than 250,000.", why: "Fifty years of open, curated data — the training set that made AlphaFold possible.", src: S.pdb },
    { y: 1972, era: "pioneers", t: "Anfinsen's Nobel Prize", who: "Christian Anfinsen · NIH", what: "Showed that a protein's sequence alone determines its 3D structure.", why: "Implied that structure could, in principle, be computed.", src: src("Nobel Prize in Chemistry 1972", "https://www.nobelprize.org/prizes/chemistry/1972/summary/") },
    { y: 1973, era: "pioneers", kind: "lesson", t: "The first “AI winter”", who: "UK Lighthill Report", what: "A government review of AI's over-promises led to funding cuts.", why: "The field learned to make narrower, testable claims.", src: src("The Lighthill Report (1973)", "http://www.chilton-computing.org.uk/inf/literature/reports/lighthill_report/contents.htm") },
    { y: 1976, era: "pioneers", t: "MYCIN", who: "Edward Shortliffe & Bruce Buchanan · Stanford", what: "A rule-based system that recommended antibiotics; a blinded 1979 evaluation rated it as good as infectious-disease experts.", why: "Proved AI could reason about medicine. It was never deployed — an early lesson in getting tools into practice.", src: src("Yu et al., JAMA (1979)", "https://doi.org/10.1001/jama.1979.03300120033020") },
    { y: 1977, era: "pioneers", t: "First simulation of a protein in motion", who: "McCammon, Gelin & Karplus; Levitt & Warshel", what: "Molecular dynamics turned proteins from static pictures into movies.", why: "Recognized with the 2013 Nobel Prize in Chemistry.", src: src("Nobel Prize in Chemistry 2013", "https://www.nobelprize.org/prizes/chemistry/2013/press-release/") },
    { y: 1981, era: "pioneers", t: "Captopril approved", who: "David Cushman & Miguel Ondetti · Squibb", what: "Designed from a model of the ACE enzyme's active site; the first oral ACE inhibitor.", why: "Often cited as the first rational, structure-guided drug design.", src: src("Lasker Foundation — ACE inhibitors", "https://laskerfoundation.org/winners/ace-inhibitors-for-treating-hypertension/") },
    { y: 1982, era: "pioneers", t: "GenBank & the Hopfield network", who: "Los Alamos / NCBI · John Hopfield", what: "A public home for DNA sequences opened; Hopfield's neural network revived the field.", why: "Open genomic data became the norm. Hopfield shared the 2024 Nobel Prize in Physics.", src: src("NCBI — GenBank", "https://www.ncbi.nlm.nih.gov/genbank/") },
    { y: 1986, era: "pioneers", t: "Backpropagation", who: "Rumelhart, Hinton & Williams", what: "Showed how multilayer neural networks can learn.", why: "The training method behind nearly all modern deep learning.", src: src("Nature (1986)", "https://doi.org/10.1038/323533a0") },
    { y: 1988, era: "pioneers", t: "Neural networks read protein structure", who: "Ning Qian & Terrence Sejnowski", what: "Predicted protein secondary structure with 64.3% accuracy.", why: "The first neural network applied to protein structure — a direct ancestor of AlphaFold.", src: src("J. Mol. Biol. (1988)", "https://doi.org/10.1016/0022-2836(88)90564-5") },
    // Era 2 — Reading the Book of Life
    { y: 1990, era: "book", t: "BLAST", who: "Altschul, Gish, Miller, Myers & Lipman · NCBI", what: "A fast way to search sequence databases.", why: "One of the most-cited papers in science; it made database search routine.", src: src("J. Mol. Biol. (1990)", "https://doi.org/10.1016/S0022-2836(05)80360-2") },
    { y: 1990.5, era: "book", t: "Human Genome Project launches", who: "NIH, DOE & international partners", what: "A 13-year effort to read the human genome.", why: "Assembling it was, at heart, an algorithmic problem.", src: src("NHGRI — Human Genome Project", "https://www.genome.gov/human-genome-project") },
    { y: 1994, era: "book", t: "CASP begins", who: "John Moult & Krzysztof Fidelis", what: "A blind, biennial competition in protein structure prediction.", why: "Honest, independent measurement — the arena where AlphaFold's success was later verified.", src: src("Prediction Center — CASP", "https://predictioncenter.org/") },
    { y: 1995, era: "book", t: "DNA microarrays", who: "Schena, Brown et al. · Stanford", what: "Measured thousands of genes at once.", why: "Biology's first “big data”, and a spur to machine learning in medicine.", src: src("Science (1995)", "https://doi.org/10.1126/science.270.5235.467") },
    { y: 1995.5, era: "book", t: "Dorzolamide approved", who: "Merck", what: "A glaucoma drug designed using the 3D structure of its target.", why: "Generally cited as the first marketed drug from structure-based design.", src: src("Baldwin et al., J. Med. Chem. (1989)", "https://doi.org/10.1021/jm00132a003") },
    { y: 1997, era: "book", t: "Rosetta", who: "Kim Simons & David Baker · UW", what: "A method for predicting protein structure that grew into a design suite.", why: "The platform for a generation of protein design.", src: src("J. Mol. Biol. (1997)", "https://doi.org/10.1006/jmbi.1997.0959") },
    { y: 2000, era: "book", t: "Folding@home", who: "Vijay Pande · Stanford", what: "Volunteers' computers simulating protein folding.", why: "Citizen science at scale; in 2020 it became the first exascale computer, studying SARS-CoV-2.", src: src("Folding@home — About", "https://foldingathome.org/about/") },
    { y: 2001, era: "book", t: "The human genome, drafted", who: "International consortium & Celera", what: "New assembly algorithms stitched millions of fragments into a genome.", why: "A triumph of computation in biology.", src: src("Nature (2001)", "https://doi.org/10.1038/35057062") },
    { y: 2003, era: "book", t: "Top7: a protein nature never made", who: "Brian Kuhlman & David Baker", what: "The first computer-designed protein with a new fold, confirmed by crystallography.", why: "Computers could design proteins, not only analyze them.", src: src("Science (2003)", "https://doi.org/10.1126/science.1089427") },
    { y: 2008, era: "book", t: "Foldit", who: "UW Center for Game Science & Baker lab", what: "A protein-folding game where players sometimes beat the algorithms.", why: "Humans and computers solving problems together.", src: src("Nature (2010)", "https://doi.org/10.1038/nature09304") },
    { y: 2011, era: "book", t: "Gamers solve an AIDS-related enzyme", who: "Foldit players", what: "Modelled the M-PMV protease in about 10 days, after more than a decade of failed attempts.", why: "A vivid case of human–computer teamwork.", src: src("Nat. Struct. Mol. Biol. (2011)", "https://doi.org/10.1038/nsmb.2119") },
    // Era 3 — Learning from Data
    { y: 2012, era: "learning", t: "AlexNet", who: "Krizhevsky, Sutskever & Hinton", what: "A deep network won the ImageNet challenge by a wide margin.", why: "The “big bang” of modern deep learning.", src: src("NeurIPS (2012)", "https://papers.nips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks") },
    { y: 2012.5, era: "learning", t: "The Merck Kaggle challenge", who: "George Dahl's team, Hinton lab", what: "Deep networks beat Merck's own drug-activity models — with no chemist on the team.", why: "Drug discovery's “AlexNet moment”.", src: src("J. Chem. Inf. Model. (2015)", "https://doi.org/10.1021/ci500747n") },
    { y: 2015, era: "learning", t: "AtomNet", who: "Atomwise", what: "The first deep network to predict how drugs bind using 3D structure.", why: "The start of deep learning for virtual screening.", src: src("arXiv (2015)", "https://arxiv.org/abs/1510.02855") },
    { y: 2016, era: "learning", t: "AI reads the retina", who: "Gulshan, Peng et al. · Google", what: "Matched ophthalmologists at spotting diabetic eye disease.", why: "A landmark for medical AI.", src: src("JAMA (2016)", "https://doi.org/10.1001/jama.2016.17216") },
    { y: 2017, era: "learning", t: "DeepVariant", who: "Google", what: "Reframed reading genetic variants as an image-recognition problem.", why: "Now widely used in genomics.", src: src("Nature Biotechnology (2018)", "https://doi.org/10.1038/nbt.4235") },
    { y: 2017.5, era: "learning", kind: "lesson", t: "Watson for Oncology stumbles", who: "IBM", what: "Internal documents described unsafe recommendations traced to synthetic training cases.", why: "The field learned to demand real-world data and prospective validation over marketing.", src: src("STAT (2018)", "https://www.statnews.com/2018/07/25/ibm-watson-recommended-unsafe-incorrect-treatments/") },
    { y: 2018.3, era: "learning", t: "First autonomous AI diagnostic", who: "IDx-DR · FDA", what: "Authorized to screen for diabetic retinopathy with no clinician reading the result.", why: "AI entered routine care through a prospective trial.", src: src("Abràmoff et al., npj Digital Medicine (2018) — pivotal trial", "https://doi.org/10.1038/s41746-018-0040-6") },
    { y: 2018.9, era: "learning", t: "AlphaFold 1 wins CASP13", who: "DeepMind", what: "Top-ranked on structures with no known template.", why: "A signal that deep learning could crack protein folding.", src: src("Nature (2020)", "https://doi.org/10.1038/s41586-019-1923-7") },
    { y: 2019.2, era: "learning", t: "Protein language models", who: "Alexander Rives et al. · Meta AI", what: "A model trained on 250M sequences learned structure and function without labels.", why: "Brought language-model ideas to biology.", src: src("PNAS (2021)", "https://doi.org/10.1073/pnas.2016239118") },
    { y: 2019.7, era: "learning", t: "Molecules designed in 21 days", who: "Insilico Medicine", what: "A generative model designed new kinase inhibitors that worked in cells and mice.", why: "A proof of concept for generative chemistry.", src: src("Nature Biotechnology (2019)", "https://doi.org/10.1038/s41587-019-0224-x") },
    // Era 4 — The Protein Revolution
    { y: 2020.05, era: "protein", t: "An AI-designed molecule enters trials", who: "Exscientia & Sumitomo Dainippon", what: "DSP-1181 reached human trials after about 12 months of design, against a typical ~5 years.", why: "A first, by the company's account. It was later discontinued — normal attrition for drugs.", src: S.dsp },
    { y: 2020.12, era: "protein", t: "Halicin, an antibiotic found by AI", who: "Stokes, Barzilay & Collins · MIT", what: "A deep-learning screen of 100M+ molecules found a structurally new antibiotic.", why: "AI could find medicines humans had overlooked.", src: src("Cell (2020)", "https://doi.org/10.1016/j.cell.2020.01.021") },
    { y: 2020.15, era: "protein", t: "An AI-suggested COVID treatment", who: "BenevolentAI", what: "A knowledge graph flagged baricitinib for COVID-19 within days; large trials then proved it.", why: "One of the clearest AI-assisted repurposing successes.", src: S.bari },
    { y: 2020.9, era: "protein", t: "AlphaFold 2", who: "John Jumper, Demis Hassabis et al. · DeepMind", what: "Predicted protein structures with near-experimental accuracy at CASP14.", why: "Organizers said the 50-year problem was largely solved for single proteins.", src: src("Nature (2021)", "https://doi.org/10.1038/s41586-021-03819-2") },
    { y: 2021.5, era: "protein", t: "RoseTTAFold", who: "Minkyung Baek & David Baker", what: "An open model with accuracy close to AlphaFold 2.", why: "The breakthrough was reproducible and open.", src: src("Science (2021)", "https://doi.org/10.1126/science.abj8754") },
    { y: 2021.6, era: "protein", kind: "lesson", t: "A sepsis model falls short", who: "Wong et al. · University of Michigan", what: "Independent validation found a widely used sepsis model worked far worse than advertised.", why: "A push toward independent testing and monitoring.", src: src("JAMA Internal Medicine (2021)", "https://doi.org/10.1001/jamainternmed.2021.2626") },
    { y: 2022.55, era: "protein", t: "200 million structures, free", who: "DeepMind & EMBL-EBI", what: "The AlphaFold database expanded to nearly every known protein.", why: "Used by 3M+ researchers in 190+ countries.", src: S.afdb },
    { y: 2022.7, era: "protein", t: "ProteinMPNN", who: "Justas Dauparas & David Baker", what: "Deep learning that writes sequences for designed protein shapes.", why: "Sharply raised design success rates.", src: src("Science (2022)", "https://doi.org/10.1126/science.add2187") },
    { y: 2022.9, era: "protein", t: "Med-PaLM passes the medical exam", who: "Google", what: "The first language model above the US medical licensing pass mark.", why: "Language models began to reason about medicine.", src: src("Nature (2023)", "https://doi.org/10.1038/s41586-023-06291-2") },
    // Era 5 — Designing Life's Molecules
    { y: 2023.5, era: "design", t: "RFdiffusion", who: "Joseph Watson & David Baker", what: "A diffusion model that generates new protein backbones and binders, validated in the lab.", why: "Generative AI could design proteins on demand.", src: src("Nature (2023)", "https://doi.org/10.1038/s41586-023-06415-8") },
    { y: 2023.7, era: "design", t: "AlphaMissense", who: "Google DeepMind", what: "Classified 89% of 71 million possible human missense variants.", why: "Experts had classified about 0.1%; this helps diagnose rare disease.", src: src("Science (2023)", "https://doi.org/10.1126/science.adg7492") },
    { y: 2023.9, era: "design", t: "Coscientist", who: "Boiko, MacKnight & Gomes · Carnegie Mellon", what: "A language-model agent planned and ran real chemistry on lab robots.", why: "The first glimpse of AI as a lab partner.", src: src("Nature (2023)", "https://doi.org/10.1038/s41586-023-06792-0") },
    { y: 2023.95, era: "design", t: "A new class of antibiotics", who: "Collins lab · MIT", what: "Explainable deep learning found a structural class active against MRSA.", why: "AI against antimicrobial resistance.", src: src("Nature (2023)", "https://doi.org/10.1038/s41586-023-06887-8") },
    { y: 2024.35, era: "design", t: "AlphaFold 3", who: "Google DeepMind & Isomorphic Labs", what: "Predicts how proteins interact with DNA, RNA and drug molecules.", why: "From single proteins to the interactions medicines depend on.", src: src("Nature (2024)", "https://doi.org/10.1038/s41586-024-07487-w") },
    { y: 2024.45, era: "design", t: "esmGFP", who: "EvolutionaryScale", what: "ESM3 designed a glowing protein far from any found in nature.", why: "The team estimates it equals 500M+ years of evolution.", src: src("Science (2025)", "https://doi.org/10.1126/science.ads0018") },
    { y: 2024.85, era: "design", t: "Evo", who: "Nguyen, Hie & Hsu · Arc Institute", what: "A DNA language model that designed working CRISPR systems.", why: "AI began writing in the language of genomes.", src: src("Science (2024)", "https://doi.org/10.1126/science.ado9336") },
    { y: 2024.77, era: "design", t: "Two Nobel Prizes for AI", who: "Hopfield & Hinton · Baker, Hassabis & Jumper", what: "Physics for neural networks; Chemistry for protein design and structure prediction.", why: "Science's highest honor recognized AI's contribution to understanding life.", src: src("Nobel Prize in Chemistry 2024", "https://www.nobelprize.org/prizes/chemistry/2024/press-release/") },
    // Era 6 — The Age of Collaborators
    { y: 2025.42, era: "collab", t: "An AI-discovered drug works in patients", who: "Insilico Medicine", what: "Rentosertib — target and molecule both found by AI — improved lung function in a Phase 2a trial for pulmonary fibrosis.", why: "First clinical proof of concept for a fully AI-discovered drug.", src: S.rento2 },
    { y: 2025.3, era: "collab", t: "FDA moves to reduce animal testing", who: "US FDA", what: "A roadmap to replace some animal studies with computational and lab-based methods.", why: "AI models may make medicines safer to test.", src: S.fdaNam },
    { y: 2025.62, era: "collab", t: "Generative AI designs new antibiotics", who: "Collins lab · MIT", what: "Designed 36M compounds and found new mechanisms against gonorrhoea and MRSA.", why: "Searching chemical space no one had explored.", src: S.mitAbx },
    { y: 2025.8, era: "collab", kind: "claude", t: "Claude for Life Sciences", who: "Anthropic", what: "Claude connected to Benchling, PubMed, 10x Genomics and more, with its first scientific skills.", why: "Claude joins scientists' existing tools.", src: S.cls },
    { y: 2025.87, era: "collab", t: "Antibodies designed atom by atom", who: "Baker lab · UW Institute for Protein Design", what: "De novo antibodies with atomically accurate binding, released openly.", why: "Antibodies on demand move closer.", src: S.rfab },
    { y: 2026.04, era: "collab", t: "Regulators align on AI", who: "FDA & EMA", what: "Ten joint principles of good AI practice in drug development.", why: "Clear rules make trustworthy adoption possible.", src: S.fdaEma },
    { y: 2026.07, era: "collab", t: "AlphaGenome", who: "Google DeepMind", what: "Reads a million letters of DNA and predicts 11 kinds of genomic activity; weights released.", why: "Reading the regulatory genome.", src: S.alphagenome },
    { y: 2026.18, era: "collab", t: "Evo 2", who: "Arc Institute & NVIDIA", what: "A genome model trained on 9.3 trillion DNA letters from 128,000+ species.", why: "Foundation models for all of life's code.", src: S.evo2 },
    { y: 2026.29, era: "collab", t: "GPT-Rosalind", who: "OpenAI", what: "A life-sciences reasoning model released through trusted access.", why: "Frontier labs compete — and adopt safeguards — in biology.", src: S.rosalind },
    { y: 2026.46, era: "collab", kind: "claude", t: "John Jumper joins Anthropic", who: "AlphaFold co-creator, Nobel 2024", what: "One of AlphaFold's creators moves to the company behind Claude.", why: "The protein revolution and the language-model revolution meet.", src: S.jumper },
    { y: 2026.5, era: "collab", kind: "claude", t: "Claude Science", who: "Anthropic", what: "A multi-agent research workbench with 60+ scientific skills and connectors.", why: "From answering questions to running research workflows.", src: S.csci },
    { y: 2026.63, era: "collab", kind: "claude", t: "354 Claude-designed binders, lab-confirmed", who: "Anthropic with Adaptyv Bio & Twist", what: "Claude ran the open protein-design stack against 15 targets; independent labs measured the results.", why: "Hit rates of 22.6–35.1%, against a typical 10–15%.", src: S.protein },
    { y: 2026.69, era: "collab", t: "Rentosertib reaches Phase 3", who: "Insilico Medicine", what: "First patient dosed in a 320-patient Phase 3 trial.", why: "The first generative-AI drug in a pivotal trial.", src: S.rento3 },
    { y: 2026.72, era: "collab", kind: "claude", t: "950 agents, one new enzyme family", who: "Anthropic Life Sciences Lab", what: "Claude agents screened 200,000 enzymes in 21 hours; scientists expressed the top candidate at the bench.", why: "Exploration at a scale no team could attempt by hand.", src: S.enzyme },
  ];

  /* ── 2 · Explorers across time (year → x; y is a lane 0–1) ─────────── */
  const explorers = {
    nodes: [
      { id: "dayhoff", name: "Margaret Dayhoff", role: "Atlas of Protein Sequence", year: 1965, lane: 0.25,
        sections: [["Contribution", ["Compiled the first computer database of protein sequences (1965) and modelled how proteins evolve."]], ["Thread to today", ["Every sequence search Claude runs stands on the databases she pioneered."]]] },
      { id: "dendral", name: "Feigenbaum & Lederberg", role: "DENDRAL, Stanford", year: 1965, lane: 0.72, initials: "FL",
        sections: [["Contribution", ["Built DENDRAL (1965), widely called the first expert system and the first AI applied to scientific reasoning."]], ["Thread to today", ["The first machine asked to reason about molecules, sixty years before Claude agents did the same at scale."]]] },
      { id: "anfinsen", name: "Christian Anfinsen", role: "Nobel 1972", year: 1972, lane: 0.45,
        sections: [["Contribution", ["Showed a protein's sequence determines its structure — the premise of all structure prediction."]]] },
      { id: "shortliffe", name: "Edward Shortliffe", role: "MYCIN, Stanford", year: 1976, lane: 0.85,
        sections: [["Contribution", ["MYCIN (1970s) recommended antibiotics as well as experts in blinded tests."]], ["Lesson", ["It was never deployed: good reasoning is not enough without a path into practice."]]] },
      { id: "berman", name: "Helen Berman", role: "Protein Data Bank", year: 1980, lane: 0.18,
        sections: [["Contribution", ["A long-time leader of the Protein Data Bank, the open archive founded in 1971."]], ["Thread to today", ["The PDB's 250,000 structures trained AlphaFold."]]] },
      { id: "hinton", name: "Geoffrey Hinton", role: "Deep learning, Nobel 2024", year: 1986, lane: 0.62,
        sections: [["Contribution", ["Co-authored backpropagation (1986) and AlexNet (2012); shared the 2024 Nobel Prize in Physics."]]] },
      { id: "lipman", name: "David Lipman", role: "BLAST, NCBI", year: 1990, lane: 0.35,
        sections: [["Contribution", ["Co-created BLAST (1990) and led NCBI, home of GenBank and PubMed."]], ["Thread to today", ["PubMed is one of the first places Claude looks when a scientist asks a question."]]] },
      { id: "moult", name: "John Moult", role: "Founder of CASP", year: 1994, lane: 0.78,
        sections: [["Contribution", ["Launched CASP (1994), the blind competition that kept protein prediction honest for 26 years."]]] },
      { id: "baker", name: "David Baker", role: "UW Institute for Protein Design", year: 2003, lane: 0.5,
        sections: [["Contribution", ["Rosetta, Top7, Foldit, RFdiffusion and de novo antibodies; Nobel Prize in Chemistry 2024."]], ["Thread to today", ["The open design tools from his lab are part of the stack Claude ran to design 354 lab-confirmed binders."]]] },
      { id: "collins", name: "Barzilay & Collins", role: "AI antibiotics, MIT", year: 2020, lane: 0.02, initials: "BC",
        sections: [["Contribution", ["Found halicin (2020) and new antibiotic classes with deep learning, then generative AI (2025)."]]] },
      { id: "zhav", name: "Alex Zhavoronkov", role: "Insilico Medicine", year: 2019, lane: 0.9,
        sections: [["Contribution", ["Insilico's rentosertib is the first drug with an AI-found target and AI-designed molecule to reach Phase 3 (2026)."]]] },
      { id: "hassabis", name: "Demis Hassabis", role: "DeepMind & Isomorphic", year: 2020.9, lane: 0.36,
        sections: [["Contribution", ["Led AlphaFold; Nobel Prize in Chemistry 2024. Isomorphic Labs aims to take AI-designed drugs into trials."]]] },
      { id: "jumper", name: "John Jumper", role: "AlphaFold → Anthropic", year: 2021.6, lane: 0.6,
        sections: [["Contribution", ["Led AlphaFold 2's development; Nobel Prize in Chemistry 2024."]], ["Thread to today", ["Announced in June 2026 that he was joining Anthropic."]]] },
      { id: "rives", name: "Alexander Rives", role: "ESM, now Biohub", year: 2022.4, lane: 0.2,
        sections: [["Contribution", ["Pioneered protein language models at Meta, then ESM3 and esmGFP at EvolutionaryScale; now head of science at Biohub."]]] },
      { id: "hsu", name: "Hsu & Hie", role: "Evo, Arc Institute", year: 2024.2, lane: 0.9, initials: "HH",
        sections: [["Contribution", ["Evo and Evo 2: language models that read and write DNA across all of life."]]] },
      { id: "regev", name: "Aviv Regev", role: "Genentech research", year: 2024.6, lane: 0.28,
        sections: [["Contribution", ["Champions “lab in the loop” at Genentech, where about 90% of eligible small-molecule programs now use AI."]], ["With Claude", ["Genentech uses Claude to build infrastructure for autonomous discovery."]]] },
      { id: "dario", name: "Dario Amodei", role: "CEO, Anthropic", year: 2024.8, lane: 0.7,
        sections: [["Vision", ["“Machines of Loving Grace” (2024): AI could compress 50–100 years of biological progress into 5–10."]]] },
      { id: "eka", name: "Eric Kauderer-Abrams", role: "Head of Life Sciences, Anthropic", year: 2025.8, lane: 0.06,
        sections: [["Role", ["Leads Anthropic's life sciences effort, from Claude for Life Sciences to Claude Science."]], ["In his words", ["“By far the greatest opportunity [to serve humanity's long-term well-being] is in the life sciences.”"]]] },
      { id: "claude", kind: "org", name: "Claude", role: "AI collaborator", year: 2026.2, lane: 0.5, initials: "",
        sections: [["Today", ["Coordinates literature, data, lab systems and open models like OpenFold3 and Boltz-2 — while scientists decide and test."]]] },
    ],
    links: [["dayhoff", "lipman"], ["dendral", "shortliffe"], ["anfinsen", "moult"], ["berman", "hassabis"], ["moult", "hassabis"], ["hinton", "hassabis"],
            ["baker", "hassabis"], ["hassabis", "jumper"], ["jumper", "claude"], ["lipman", "claude"], ["baker", "claude"], ["rives", "hsu"],
            ["dendral", "claude"], ["dario", "claude"], ["eka", "claude"], ["regev", "claude"], ["collins", "zhav"], ["hinton", "rives"], ["anfinsen", "baker"]],
  };

  /* ── 3 · From weeks to minutes ── */
  const accelerations = [
    { task: "Drug candidate to the clinic", who: "Exscientia · 2020", before: "~5 years", after: "12 months", note: "The company's own comparison for DSP-1181; the molecule was later discontinued.", src: S.dsp },
    { task: "Clinical study report, first draft", who: "Novo Nordisk · NovoScribe, built on Claude", before: "10+ weeks", after: "~10 min", note: "Built by an 11-person team, drawing on approved source content.", src: S.novo },
    { task: "Genome-wide association study", who: "Biomni · Stanford, built on Claude", before: "Months", after: "~20 min", note: "An agent chose the tools, ran the analysis and reported back.", src: S.accel },
    { task: "Wearables analysis, 450+ files", who: "Biomni · Stanford, built on Claude", before: "~3 weeks", after: "35 min", note: "Compared with an expert's estimate for the same work.", src: S.biomni },
    { task: "Ebola situation report", who: "WHO Africa · Claude skill", before: "A full day", after: "< 1 hour", note: "Time given back to field teams during an active outbreak.", src: S.ebola },
    { task: "Protein design campaign, per target", who: "Open models, optimized by Claude", before: "~$10,000", after: "~$150", note: "Claude made 30+ biomolecular models about 4× faster and released the code openly.", src: S.uplift },
  ];

  /* ── 4 · AI-discovered medicines in the clinic ──
   * stage: 0 Discovery · 1 Phase 1 · 2 Phase 2 · 3 Phase 3 · 4 Filed · 5 Approved */
  const pipeline = {
    stages: ["Discovery", "Phase 1", "Phase 2", "Phase 3", "Filed", "Approved"],
    approaches: [
      { id: "gen", name: "Generative AI design" },
      { id: "phys", name: "Physics-based computation" },
      { id: "pheno", name: "Phenomics & ML screening" },
      { id: "repo", name: "AI-suggested repurposing" },
    ],
    drugs: [
      { name: "Baricitinib (for COVID-19)", org: "BenevolentAI hypothesis · Lilly drug", stage: 5, approach: "repo", year: "2022",
        note: "An arthritis drug flagged for COVID-19 by a knowledge graph in days; large trials then proved it and the FDA approved the new use.", src: S.bari },
      { name: "Zasocitinib", org: "Nimbus → Takeda · Schrödinger platform", stage: 4, approach: "phys",
        note: "TYK2 inhibitor for psoriasis. Met all endpoints in two Phase 3 trials; FDA decision expected Q1 2027 under priority review.", src: S.zaso },
      { name: "Rentosertib", org: "Insilico Medicine", stage: 3, approach: "gen",
        note: "Target and molecule both found with generative AI. Phase 2a: lung function +98.4 mL vs −20.3 mL on placebo. Phase 3 began September 2026.", src: S.rento3 },
      { name: "GB-0895", org: "Generate:Biomedicines", stage: 3, approach: "gen",
        note: "AI-optimized antibody for severe asthma, dosed every 6 months; in two Phase 3 trials with 1,600 patients.", src: S.generate },
      { name: "REC-4881", org: "Recursion", stage: 2, approach: "pheno",
        note: "For familial adenomatous polyposis: 43% median reduction in polyp burden at 12 weeks.", src: S.recursion },
      { name: "ABS-201", org: "Absci", stage: 1, approach: "gen",
        note: "AI-designed antibody; positive interim Phase 1 data in June 2026.", src: S.absci },
      { name: "IAM1363", org: "Iambic Therapeutics", stage: 1, approach: "gen",
        note: "Brain-penetrant HER2 inhibitor; from discovery to first patient in under two years.", src: S.iambic },
      { name: "OPL-0401", org: "Valo Health", stage: 2, approach: "pheno", stopped: true,
        note: "Discontinued after a Phase 2 trial in diabetic retinopathy — a reminder that AI does not repeal biology.", src: S.valo },
      { name: "DSP-1181", org: "Exscientia · Sumitomo", stage: 1, approach: "gen", stopped: true,
        note: "The first molecule billed as AI-designed to enter trials (2020); later discontinued.", src: S.dsp },
      { name: "Halicin", org: "MIT", stage: 0, approach: "pheno",
        note: "A structurally new antibiotic found by deep learning (2020); preclinical.", src: src("Cell (2020)", "https://doi.org/10.1016/j.cell.2020.01.021") },
      { name: "Isomorphic's first programs", org: "Isomorphic Labs", stage: 0, approach: "gen",
        note: "First clinical trials, in oncology, expected by the end of 2026.", src: S.iso },
    ],
    stats: [
      { value: "117", label: "AI-enabled drug candidates from 63 companies have entered human trials (2026 analysis)" },
      { value: "80–90%", label: "Phase 1 success for AI-discovered molecules, vs 40–65% historically (BCG & Wellcome)" },
      { value: "~40%", label: "Phase 2 success — in line with the industry, so biology still decides" },
      { value: "Q1 2027", label: "First FDA decision expected on a computationally designed new drug" },
    ],
    statSrc: [S.trials117, S.bcg, S.zaso],
  };

  /* ── 5 · The research loop ── */
  const loop = [
    { id: "ask", name: "Ask", text: "Choose a problem worth solving. A scientific problem-selection skill pressure-tests the question before work begins." },
    { id: "read", name: "Read", text: "Search 35M+ PubMed articles, preprints and journals through connectors — the open databases built over sixty years." },
    { id: "hypothesize", name: "Hypothesize", text: "Look across screens, databases and papers for patterns, as Google's co-scientist and MIT's CRISPR-screen work have shown." },
    { id: "design", name: "Design", text: "Draft protocols and design molecules with open models like RFdiffusion, Boltz-2 and OpenFold3." },
    { id: "test", name: "Test", text: "Human scientists run the experiments, from Anthropic's lab to Adaptyv Bio. Reality is the judge — as CASP taught the field in 1994." },
    { id: "analyze", name: "Analyze", text: "Process raw NMR, LC-MS and single-cell data in minutes, with reproducible code and figures. Results feed the next question." },
  ];

  /* ── 6 · The connected lab ── */
  const flow = {
    columns: ["Sixty years of open data", "The field's models & tools", "Claude", "Outcomes"],
    nodes: [
      { id: "lit", col: 0, name: "Literature", sub: "PubMed · bioRxiv" },
      { id: "struct", col: 0, name: "Structures", sub: "Protein Data Bank · AlphaFold DB" },
      { id: "mol", col: 0, name: "Molecules & targets", sub: "ChEMBL · Open Targets" },
      { id: "trials", col: 0, name: "Clinical trials", sub: "ClinicalTrials.gov · Medidata" },
      { id: "fold", col: 1, name: "Structure models", sub: "OpenFold3 · Boltz-2" },
      { id: "genm", col: 1, name: "Genome models", sub: "Evo 2 via BioNeMo" },
      { id: "lab", col: 1, name: "Lab systems", sub: "Benchling · 10x · instruments" },
      { id: "skills", col: 2, name: "Agent Skills", sub: "scRNA QC · Nextflow · protocols" },
      { id: "code", col: 2, name: "Claude Code", sub: "Pipelines & analysis" },
      { id: "agents", col: 2, name: "Claude Science", sub: "Multi-agent workbench" },
      { id: "disc", col: 3, name: "Discoveries", sub: "New enzyme family" },
      { id: "designs", col: 3, name: "Designs", sub: "354 lab-confirmed binders" },
      { id: "docs", col: 3, name: "Protocols & reports", sub: "Weeks → minutes" },
      { id: "health", col: 3, name: "Public health", sub: "Outbreak response" },
    ],
    links: [["lit", "agents"], ["lit", "skills"], ["struct", "fold"], ["mol", "agents"], ["mol", "code"], ["trials", "skills"],
            ["fold", "agents"], ["fold", "code"], ["genm", "agents"], ["lab", "skills"], ["lab", "agents"],
            ["skills", "docs"], ["skills", "health"], ["code", "designs"], ["agents", "disc"], ["agents", "designs"], ["agents", "health"], ["code", "disc"]],
    stats: [
      { value: "250,000+", label: "experimental structures in the open Protein Data Bank" },
      { value: "200M+", label: "free AlphaFold structures, used in 190+ countries" },
      { value: "60+", label: "scientific skills and connectors in Claude Science" },
      { value: "10,000", label: "free or discounted Claude seats for scientists" },
    ],
  };

  /* ── 7 · Frontiers: where it started, where it is, Claude's part, what's next ── */
  const frontiers = [
    { id: "design", name: "Protein design", sub: "From reading proteins to writing them",
      started: ["Rosetta (1997) and Top7 (2003), the first protein with a fold nature never made"],
      now: ["De novo antibodies with atomic accuracy (Baker lab, 2025)", "OpenCRISPR-1, the first AI-designed gene editor", "GB-0895, an AI-optimized antibody, in Phase 3"],
      claude: ["Ran the open design stack: 354 binders on 14 of 15 targets, 22.6–35.1% hit rates vs a typical 10–15%"],
      next: ["Antibodies, enzymes and gene editors designed on demand, at a fraction of today's cost"] },
    { id: "cell", name: "The virtual cell", sub: "Simulating biology before the experiment",
      started: ["DNA microarrays (1995) measured thousands of genes at once"],
      now: ["Arc Institute's State model and Virtual Cell Challenge", "Biohub scaling to 10,000 GPUs by 2028", "Recursion's phenomics maps of cell biology"],
      claude: ["Single-cell QC and scvi-tools skills; 10x Genomics analysis in plain language"],
      next: ["Predict how cells respond to a drug before it is ever made"] },
    { id: "genome", name: "Reading genomes", sub: "From sequence to meaning",
      started: ["BLAST (1990) and the Human Genome Project (2001 draft)"],
      now: ["AlphaMissense classified 89% of 71M possible variants", "AlphaGenome reads a million DNA letters at once", "Evo 2, trained on 9.3 trillion DNA letters"],
      claude: ["UCSF germline work-ups in about one-tenth of the time", "Ebola genome assembly with INRB in the DR Congo"],
      next: ["A genome read and interpreted in hours for every child with a rare disease"] },
    { id: "agents", name: "AI scientists & labs", sub: "From one task to the whole loop",
      started: ["DENDRAL (1965), the first AI to reason about molecules", "Coscientist (2023), the first language-model lab agent"],
      now: ["Google's co-scientist reached a hypothesis a lab had spent a decade confirming", "Genentech's lab in the loop; autonomous labs at Lila Sciences", "GPT-Rosalind and Microsoft Discovery"],
      claude: ["Claude Science; 950 agents in parallel; the Model Hardware Standard for lab instruments"],
      next: ["Experiment cycles that close in days, with people setting the goals"] },
    { id: "clinic", name: "Medicines & the clinic", sub: "Getting better drugs to patients sooner",
      started: ["QSAR (1962), captopril (1981), dorzolamide (1995)"],
      now: ["Rentosertib in Phase 3; zasocitinib awaiting an FDA decision", "FDA–EMA principles for AI in drug development (2026)", "Generative AI designing new antibiotics"],
      claude: ["Clinical study reports from 10+ weeks to ~10 minutes (Novo Nordisk)", "Trial operations at ICON; protocol drafts in about an hour"],
      next: ["First approvals of AI-discovered medicines; faster trials; fewer animal tests"] },
  ];

  /* ── 8 · A global field: [lon, lat] ── */
  const places = [
    { name: "Anthropic & its life sciences lab", place: "San Francisco Bay Area", ll: [-122.39, 37.79], kind: "anthropic", text: "Claude, Claude Science and a wet lab testing what Claude proposes." },
    { name: "Google DeepMind", place: "London, UK", ll: [-0.126, 51.533], kind: "labs", text: "AlphaFold, AlphaMissense, AlphaGenome." },
    { name: "Isomorphic Labs", place: "London, UK", ll: [-0.08, 51.52], kind: "biotech", text: "AlphaFold's drug-design successor; first trials expected by end of 2026." },
    { name: "OpenAI", place: "San Francisco, CA", ll: [-122.414, 37.763], kind: "labs", text: "GPT-Rosalind for life sciences (2026)." },
    { name: "NVIDIA", place: "Santa Clara, CA", ll: [-121.964, 37.371], kind: "labs", text: "BioNeMo; compute behind Evo 2, Lilly and Roche." },
    { name: "Microsoft Research", place: "Redmond, WA", ll: [-122.121, 47.674], kind: "labs", text: "BioEmu, EvoDiff, Microsoft Discovery." },
    { name: "Arc Institute", place: "Palo Alto, CA", ll: [-122.17, 37.427], kind: "research", text: "Evo 2 and the Virtual Cell Challenge." },
    { name: "UW Institute for Protein Design", place: "Seattle, WA", ll: [-122.31, 47.65], kind: "research", text: "RFdiffusion; Nobel Prize 2024." },
    { name: "Allen Institute", place: "Seattle, WA", ll: [-122.33, 47.62], kind: "research", text: "Brain science with Claude and AI agents." },
    { name: "Broad Institute", place: "Cambridge, MA", ll: [-71.087, 42.363], kind: "research", text: "Schmidt Center for AI and biology." },
    { name: "Generate:Biomedicines", place: "Somerville, MA", ll: [-71.1, 42.388], kind: "biotech", text: "AI-designed antibody in Phase 3." },
    { name: "Recursion", place: "Salt Lake City, UT", ll: [-111.891, 40.761], kind: "biotech", text: "Phenomics at industrial scale." },
    { name: "Eli Lilly", place: "Indianapolis, IN", ll: [-86.158, 39.768], kind: "pharma", text: "LillyPod supercomputer; deals with Isomorphic, Chai, Insilico." },
    { name: "US FDA", place: "Silver Spring, MD", ll: [-76.98, 39.03], kind: "policy", text: "AI guidance; Elsa; first AI drug-development tool qualified." },
    { name: "HHMI Janelia", place: "Ashburn, VA", ll: [-77.46, 39.07], kind: "research", text: "$500M for AI-in-the-loop science." },
    { name: "Bristol Myers Squibb", place: "Princeton, NJ", ll: [-74.66, 40.35], kind: "pharma", text: "Claude for 30,000+ employees." },
    { name: "EMBL-EBI", place: "Hinxton, UK", ll: [0.19, 52.08], kind: "research", text: "Hosts the AlphaFold database." },
    { name: "AstraZeneca", place: "Cambridge, UK", ll: [0.14, 52.18], kind: "pharma", text: "Acquired Modella AI (2026)." },
    { name: "Roche & Novartis", place: "Basel, Switzerland", ll: [7.588, 47.559], kind: "pharma", text: "Lab in the loop; Isomorphic partnership." },
    { name: "EMA", place: "Amsterdam, Netherlands", ll: [4.87, 52.34], kind: "policy", text: "Joint AI principles with the FDA (2026)." },
    { name: "Cradle", place: "Amsterdam, Netherlands", ll: [4.9, 52.37], kind: "biotech", text: "Protein engineering platform." },
    { name: "Sanofi", place: "Paris, France", ll: [2.3, 48.87], kind: "pharma", text: "Company-wide AI, including Claude." },
    { name: "Novo Nordisk", place: "Bagsværd, Denmark", ll: [12.45, 55.76], kind: "pharma", text: "NovoScribe on Claude; Gefion supercomputer." },
    { name: "Insilico Medicine", place: "Hong Kong", ll: [114.21, 22.42], kind: "biotech", text: "First generative-AI drug in Phase 3." },
    { name: "XtalPi", place: "Shenzhen, China", ll: [114.06, 22.54], kind: "biotech", text: "AI plus robotic chemistry." },
    { name: "Takeda", place: "Tokyo, Japan", ll: [139.77, 35.68], kind: "pharma", text: "Zasocitinib, awaiting an FDA decision." },
    { name: "WHO Africa", place: "Brazzaville, Congo", ll: [15.28, -4.27], kind: "research", text: "Ebola situation reports in under an hour, with Claude." },
    { name: "INRB", place: "Kinshasa, DR Congo", ll: [15.31, -4.44], kind: "research", text: "Ebola genome assembly with Claude Science." },
  ];

  /* ── 9 · Responsible by design (field-wide) ── */
  const safeguards = [
    { name: "Blind tests keep everyone honest", text: "Since 1994, CASP has judged protein predictions against structures nobody had seen. AlphaFold's breakthrough was verified there, not announced.", src: src("Prediction Center — CASP", "https://predictioncenter.org/") },
    { name: "Open science as default", text: "The Protein Data Bank, GenBank and the AlphaFold database are free to all — used by 3M+ researchers in 190+ countries. Open models like OpenFold3 let anyone check the work.", src: S.afdb },
    { name: "Hard lessons, learned", text: "Watson for Oncology and a failed sepsis model taught the field to demand real-world data and independent validation. Prospective trials are now expected.", src: src("STAT (2018)", "https://www.statnews.com/2018/07/25/ibm-watson-recommended-unsafe-incorrect-treatments/") },
    { name: "Regulators are writing the rules", text: "The FDA and EMA agreed ten principles for AI in drug development in 2026, and the FDA qualified its first AI drug-development tool.", src: S.fdaEma },
    { name: "Biosecurity by design", text: "Frontier labs release their most capable biology tools through trusted access, with classifiers against misuse. Claude's most capable models have run with ASL-3 protections since 2025.", src: S.asl3 },
    { name: "Scientists stay in charge", text: "AI proposes; people decide. Human scientists run the bench work in Anthropic's lab, and results are measured by independent labs.", src: S.protein },
  ];

  /* ── 10 · Horizon ── */
  const timeline = [
    { date: "Jan 2026", title: "Rules of the road", text: "FDA and EMA agree ten principles for AI in drug development." },
    { date: "Mar 2026", title: "Evo 2 in Nature", text: "A genome model trained across all domains of life." },
    { date: "Jun 2026", title: "Claude Science", text: "A multi-agent workbench for research; Anthropic starts neglected-disease drug programs." },
    { date: "Aug 2026", title: "Proteins, validated", text: "354 Claude-designed binders confirmed by independent labs." },
    { date: "Sep 2026", title: "Phase 3 & a new enzyme", text: "Rentosertib enters Phase 3; 950 Claude agents surface a new enzyme family." },
    { date: "Late 2026", title: "Isomorphic in the clinic", text: "First trials of AlphaFold's drug-design successor expected.", future: true },
    { date: "Q1 2027", title: "A first FDA decision", text: "Zasocitinib, a computationally designed drug, awaits approval.", future: true },
    { date: "2028", title: "Toward a virtual cell", text: "Biohub plans a 10,000-GPU cluster to model cells.", future: true },
  ];

  const horizon = [
    { name: "Infectious disease", text: "Reliable prevention and treatment of nearly all natural infectious disease." },
    { name: "Cancer", text: "Mortality and incidence reduced by 95% or more." },
    { name: "Genetic disease", text: "Most genetic disease prevented, through better screening and treatment." },
    { name: "Alzheimer's", text: "Prevention of Alzheimer's and other neurodegenerative disease." },
    { name: "Chronic disease", text: "Far better treatment for diabetes, obesity and heart disease." },
    { name: "Healthy lifespan", text: "A plausible doubling of the healthy human lifespan." },
  ];

  window.STORY = { eras, milestones, explorers, accelerations, pipeline, loop, flow, frontiers, places, safeguards, timeline, horizon };
})();
