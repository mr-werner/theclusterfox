/*
  What each app's "free" actually means, keyed by app name.

  openSource:  source code is publicly licensed
  limits:      catches worth knowing (see freeLimits below); "tracking"
               means the service collects personal or usage data for ads,
               profiling, or model training
  note:        one short line explaining the catch
*/

export const freeLimits = {
  ads: { label: "Ads", filterLabel: "No ads" },
  freeTier: { label: "Free tier", filterLabel: "No paid tiers" },
  libraryCard: { label: "Library card", filterLabel: "No library card" },
  region: { label: "Region limits", filterLabel: "Available everywhere" },
  tracking: { label: "Data tracking", filterLabel: "No data tracking" },
};

const OS = { openSource: true };

export const freeAppDetails = {
  // Operating Systems
  Linux: OS,
  Ubuntu: OS,
  "Linux Mint": OS,
  Fedora: OS,
  Debian: OS,
  "Pop!_OS": OS,
  "Zorin OS": { ...OS, limits: ["freeTier"], note: "Core edition is free; Pro edition is paid." },
  "Raspberry Pi OS": OS,
  FreeBSD: OS,
  LineageOS: OS,
  GrapheneOS: OS,

  // Office & Productivity
  LibreOffice: OS,
  ONLYOFFICE: { ...OS, limits: ["freeTier"], note: "Desktop apps are free; cloud plans are paid." },
  CryptPad: { ...OS, limits: ["freeTier"], note: "Free accounts have limited storage." },
  Thunderbird: OS,
  Obsidian: { limits: ["freeTier"], note: "Sync and Publish are paid add-ons." },
  Joplin: { ...OS, limits: ["freeTier"], note: "Joplin Cloud is paid; other sync options are free." },
  Logseq: OS,
  Zotero: { ...OS, limits: ["freeTier"], note: "300 MB of free sync storage; more is paid." },
  Calibre: OS,
  "Actual Budget": OS,
  "Google Drive": { limits: ["freeTier", "tracking"], note: "15 GB free with a Google account, shared with Gmail and Photos." },

  // ArtCraft suite
  WordCraft: OS,
  GridCraft: OS,
  DeckCraft: OS,
  PdfCraft: OS,
  PhotoCraft: OS,
  VectorCraft: OS,
  LightCraft: OS,
  DesignCraft: OS,
  FigCraft: OS,
  FilmCraft: OS,
  EffectCraft: OS,
  SoundCraft: OS,
  CADCraft: OS,

  // Graphics & Design
  GIMP: OS,
  Photopea: { limits: ["ads", "freeTier", "tracking"], note: "Ad-supported; Premium removes ads." },
  Krita: OS,
  Inkscape: OS,
  darktable: OS,
  Penpot: { ...OS, limits: ["freeTier"], note: "Paid plans for larger teams; self-hosting is free." },
  Scribus: OS,
  "draw.io": OS,
  Excalidraw: { ...OS, limits: ["freeTier"], note: "Excalidraw+ adds paid collaboration features." },

  // Video & Audio
  "DaVinci Resolve": { limits: ["freeTier"], note: "Studio version is paid; the free version covers most needs." },
  Kdenlive: OS,
  Shotcut: OS,
  "OBS Studio": OS,
  HandBrake: OS,
  Audacity: OS,
  LMMS: OS,
  MuseScore: OS,
  VLC: OS,

  // 3D, CAD & Making
  Blender: OS,
  FreeCAD: OS,
  OpenSCAD: OS,
  KiCad: OS,
  OrcaSlicer: OS,

  // Games & Game Dev
  Godot: OS,
  "Unreal Engine": { limits: ["freeTier"], note: "5% royalty once a game earns over $1M." },
  Unity: { limits: ["freeTier"], note: "Personal plan is free under $200K yearly revenue." },
  Blockbench: OS,
  RetroArch: OS,
  Lutris: OS,
  Steam: { limits: ["freeTier"], note: "Free client and free-to-play games; most games are paid." },
  "Epic Games Store": { limits: ["freeTier"], note: "Weekly free games; most games are paid." },
  "itch.io": { limits: ["freeTier"], note: "Many games are free; some are paid or pay-what-you-want." },
  Lichess: OS,

  // Movies, TV & Video
  YouTube: { limits: ["ads", "freeTier", "tracking"], note: "Premium removes ads." },
  Tubi: { limits: ["ads", "region", "tracking"], note: "Available in the US and select countries." },
  "Pluto TV": { limits: ["ads", "region", "tracking"], note: "Channel lineup varies by country." },
  "The Roku Channel": { limits: ["ads", "region", "tracking"], note: "Available in the US and select countries." },
  Plex: { limits: ["ads", "freeTier", "tracking"], note: "Free movies and TV have ads; Plex Pass is paid." },
  Kanopy: { limits: ["libraryCard"], note: "Needs a card from a participating library." },
  PBS: { limits: ["freeTier", "region"], note: "US only; some shows need PBS Passport." },
  Twitch: { limits: ["ads", "freeTier", "tracking"], note: "Subscriptions remove ads on a channel." },

  // Music, Radio & Podcasts
  Spotify: { limits: ["ads", "freeTier", "tracking"], note: "Free tier has ads and limited skips on mobile." },
  "YouTube Music": { limits: ["ads", "freeTier", "tracking"], note: "No background play on mobile without Premium." },
  SoundCloud: { limits: ["ads", "freeTier", "tracking"], note: "Paid plans remove ads and add offline listening." },
  Pandora: { limits: ["ads", "freeTier", "region", "tracking"], note: "US only; paid plans remove ads." },
  Audiomack: { limits: ["ads", "freeTier", "tracking"], note: "Paid plan removes ads." },
  Bandcamp: { limits: ["freeTier"], note: "Stream for free; buying music supports artists." },
  iHeartRadio: { limits: ["ads", "freeTier", "tracking"], note: "Paid plans add on-demand playback." },
  "Radio Garden": {},
  AntennaPod: OS,
  "Pocket Casts": { ...OS, limits: ["freeTier"], note: "Plus adds desktop apps and extras." },

  // Books, Audiobooks & Comics
  Libby: { limits: ["libraryCard"], note: "Needs a card from a participating library." },
  Hoopla: { limits: ["libraryCard"], note: "Your library sets a monthly borrowing limit." },
  LibriVox: {},
  "Open Library": OS,
  WEBTOON: { limits: ["ads", "freeTier", "tracking"], note: "Some episodes cost coins to read early." },

  // Development
  "VS Code": { limits: ["tracking"], note: "Sends usage telemetry by default; VSCodium does not." },
  VSCodium: OS,
  Neovim: OS,
  "Notepad++": OS,
  Git: OS,
  GitHub: { limits: ["freeTier"], note: "Paid plans add CI minutes and team features." },
  Python: OS,
  "Node.js": OS,
  Docker: { ...OS, limits: ["freeTier"], note: "Docker Desktop is paid for large companies." },
  DBeaver: { ...OS, limits: ["freeTier"], note: "Community edition is free; Pro editions are paid." },
  Hoppscotch: OS,

  // Browsers & Search
  Firefox: OS,
  Brave: OS,
  LibreWolf: OS,
  Vivaldi: {},
  "Tor Browser": OS,
  DuckDuckGo: { limits: ["ads"], note: "Shows private, non-tracking search ads." },

  // Security & Privacy
  Bitwarden: { ...OS, limits: ["freeTier"], note: "Premium adds extras like 2FA codes." },
  KeePassXC: OS,
  "Proton VPN": { ...OS, limits: ["freeTier"], note: "Free plan has fewer servers and one device." },
  "Proton Mail": { ...OS, limits: ["freeTier"], note: "Free plan has limited storage." },
  Signal: OS,
  "uBlock Origin": OS,
  VeraCrypt: OS,
  Cryptomator: { ...OS, limits: ["freeTier"], note: "Desktop apps are free; mobile apps are paid." },
  Wireshark: OS,

  // Utilities
  "7-Zip": OS,
  LocalSend: OS,
  Syncthing: OS,
  qBittorrent: OS,
  VirtualBox: OS,
  Flameshot: OS,

  // Self-Hosting & Home Lab
  Nextcloud: OS,
  Jellyfin: OS,
  Immich: OS,
  "Home Assistant": { ...OS, limits: ["freeTier"], note: "Optional paid cloud subscription for remote access." },
  "Pi-hole": OS,
  "Proxmox VE": { ...OS, limits: ["freeTier"], note: "Paid subscriptions add enterprise updates and support." },
  TrueNAS: OS,

  // AI & Machine Learning
  Claude: { limits: ["freeTier", "tracking"], note: "Free plan has usage limits. Chats may train models unless you opt out." },
  ChatGPT: { limits: ["freeTier", "tracking"], note: "Free plan has usage limits. Chats may train models unless you opt out." },
  Gemini: { limits: ["freeTier", "tracking"], note: "Free plan has usage limits. Chats may train models unless you opt out." },
  "Microsoft Copilot": { limits: ["freeTier", "tracking"], note: "Free plan has usage limits. Chats may train models unless you opt out." },
  Perplexity: { limits: ["freeTier", "tracking"], note: "Unlimited basic searches; Pro searches are limited." },
  "Le Chat": { limits: ["freeTier", "tracking"], note: "Free plan has usage limits. Chats may train models unless you opt out." },
  DeepSeek: { limits: ["tracking"], note: "Free to use; models are open-weight. Servers are in China." },
  "Meta AI": { limits: ["region", "tracking"], note: "Available in select countries." },
  Grok: { limits: ["freeTier", "tracking"], note: "Free plan has usage limits. Chats may train models unless you opt out." },
  Ollama: OS,
  "LM Studio": {},
  "Hugging Face": { limits: ["freeTier"], note: "Paid plans add compute and private storage." },
  ArtCraft: { limits: ["freeTier"], note: "AI studio is free to start; heavy use needs credits." },
  Upscayl: OS,

  // Learning & Knowledge
  "Khan Academy": {},
  freeCodeCamp: OS,
  "The Odin Project": OS,
  Exercism: OS,
  "MDN Web Docs": OS,
  "MIT OpenCourseWare": {},
  Anki: { ...OS, limits: ["freeTier"], note: "Free everywhere except the paid iOS app." },
  Wikipedia: {},
  "Internet Archive": {},
  "Project Gutenberg": {},
  OpenStreetMap: OS,
};
