/* =========================================================
   Nadirion product catalog: the commercial record for every
   module the site sells. Names and categories must match the
   cards on modules.html (they share these ids).

   Prices: every price on the site comes from this file. The
   module cards, the license tray, the pricing page's price list,
   and the quote form all read it.

   - Subscriptions are annual. Prices are per seat unless an item
     says unit: "org" (licensed once per organization).
   - A price left as null renders as the pending label below,
     a visible [VERIFY] placeholder, and the running total shows
     that placeholder until every price it needs is set.
   - Modules are priced by tier. Host Utilities are sold only as
     one bundle of all eight; adding any of them adds all eight.
   - The tray and quote form apply a bundle automatically when it
     costs less than the modules picked one by one.
   - Set preview: true on a module to mark it "Preview" (newer or
     less tested). The preview block below sets how it is priced.
   ========================================================= */
window.NADIRION_CATALOG = {
  currency: "USD",
  // Shown after per-seat and per-organization prices.
  priceUnit: "/seat/yr",
  orgUnit: "/org/yr",
  // Shown wherever a price is still null.
  pendingLabel: "[VERIFY: $__]",

  // Founding customer pricing, per module, per seat, per year.
  tiers: {
    core: { name: "Core", price: null },         // [VERIFY: $__]
    standard: { name: "Standard", price: null }, // [VERIFY: $__]
    light: { name: "Light", price: null }        // [VERIFY: $__]
  },

  // Included with any paid module. This price applies only when
  // Nadirion Desktop is bought on its own; leave null if it is not
  // sold standalone.
  desktop: { name: "Nadirion Desktop", price: null }, // [VERIFY: $__ standalone, or not sold standalone]

  bundles: {
    // Sold only as a bundle: the eight Host Utilities are never priced one by one.
    host_utilities: { name: "Host Utilities bundle", price: null, categories: ["Host Utilities"], only: true }, // [VERIFY: $__]
    dfir_suite: { name: "DFIR Suite", price: null, categories: ["Forensics", "Triage"] },                       // [VERIFY: $__]
    // Every per-seat module. Per-organization items (Cryptographic
    // Inventory) are not included unless includeOrg is true.
    all_access: { name: "All-Access", price: null, everything: true, includeOrg: false }                        // [VERIFY: $__; does it include Cryptographic Inventory?]
  },

  // How modules marked preview: true are priced.
  // mode: "free" (no charge) or "discount" (discount is a fraction, e.g. 0.5 for half price).
  preview: { mode: null, discount: null }, // [VERIFY: discounted (by how much) or included free]

  modules: {
    // Intelligence
    tip: { name: "Intelligence Processor", category: "Intelligence", tier: "core" },
    ioc_vault: { name: "IOC Vault", category: "Intelligence", tier: "core" },
    news: { name: "Intelligence Feed", category: "Intelligence", tier: "light" },

    // Forensics
    file_review: { name: "File Analysis", category: "Forensics", tier: "standard" },
    email_review: { name: "Email Analysis", category: "Forensics", tier: "core" },
    process_checker: { name: "Process Analysis", category: "Forensics", tier: "standard" },
    browser_analysis: { name: "Browser Analysis", category: "Forensics", tier: "standard" },
    service_analysis: { name: "Service Analysis", category: "Forensics", tier: "standard" },
    scheduled_task_analysis: { name: "Scheduled Task Analysis", category: "Forensics", tier: "standard" },
    registry_persistence: { name: "Registry & Persistence Analysis", category: "Forensics", tier: "standard" },
    execution_evidence: { name: "Execution Evidence Analysis", category: "Forensics", tier: "standard" },
    event_log_logon: { name: "Event Log & Logon Analysis", category: "Forensics", tier: "core" },
    ai_analysis: { name: "AI Analysis", category: "Forensics", tier: "standard" },
    network_connections: { name: "Network Connection Forensics", category: "Forensics", tier: "standard" },

    // Triage
    malware_scan: { name: "Malware Scan", category: "Triage", tier: "core" },
    secure_host: { name: "Secure Host", category: "Triage", tier: "standard" },
    triage_kit_usb: { name: "Triage Kit USB", category: "Triage", tier: "core" },
    usb_iso_burner: { name: "USB ISO Burner", category: "Triage", tier: "light" },

    // Cryptography
    decoder: { name: "Decoder", category: "Cryptography", tier: "light" },

    // Quantum: licensed per organization, not per seat.
    crypto_inventory: { name: "Cryptographic Inventory", category: "Quantum", unit: "org", price: null }, // [VERIFY: $__ per organization per year]

    // Identity
    persona_manager: { name: "Persona Manager", category: "Identity", tier: "light" },
    identity_lookup: { name: "Identity Lookup", category: "Identity", tier: "light" },

    // Network
    uptime: { name: "Uptime Monitor", category: "Network", tier: "light" },
    traceroute: { name: "Route Mapper", category: "Network", tier: "light" },
    net_mapper: { name: "Network Mapper", category: "Network", tier: "light" },

    // Host Utilities: sold only as the Host Utilities bundle.
    driver_manager: { name: "Driver Update Manager", category: "Host Utilities", bundle: "host_utilities" },
    file_organizer: { name: "File Organizer", category: "Host Utilities", bundle: "host_utilities" },
    startup_manager: { name: "Startup Manager", category: "Host Utilities", bundle: "host_utilities" },
    system_health: { name: "System Health Snapshot", category: "Host Utilities", bundle: "host_utilities" },
    disk_space_analyzer: { name: "Disk Space Analyzer", category: "Host Utilities", bundle: "host_utilities" },
    duplicate_finder: { name: "Duplicate File Finder", category: "Host Utilities", bundle: "host_utilities" },
    software_inventory: { name: "Software Inventory & Patch Checker", category: "Host Utilities", bundle: "host_utilities" },
    file_converter: { name: "File Conversion Kit", category: "Host Utilities", bundle: "host_utilities" }
  }
};
