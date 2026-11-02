/* =========================================================
   Nadirion product catalog: the commercial record for every
   module the site sells. Names and categories must match the
   cards on modules.html (they share these ids).

   Prices: every price on the site comes from this file. The
   module cards, the license tray, and the quote form read it;
   the price list on pricing.html reads it too, and its static
   text (shown only without JavaScript) should match.

   - Subscriptions are annual, per user, in US dollars.
   - Nadirion Desktop is required and includes every module in
     the "included" tier. Every other module is an add-on priced
     by its tier.
   - A price left as null renders as the pending label below,
     and the running total shows that label until it is set.
   - Set preview: true on a module to mark it "Preview" (newer or
     less tested). No module is in Preview today. A Preview module
     keeps its tier price in the running total; the Preview discount
     described below is applied on the quote.
   ========================================================= */
window.NADIRION_CATALOG = {
  currency: "USD",
  // Shown after every price.
  priceUnit: "/user/yr",
  // Shown wherever a price is still null.
  pendingLabel: "[VERIFY: $__]",

  // The base license every add-on runs in.
  desktop: { name: "Nadirion Desktop", price: 150 },

  tiers: {
    included: { name: "Included with Desktop", price: 0 },
    standard: { name: "Add-on", price: 50 },
    premium: { name: "Premium", price: 100 }
  },

  // The Preview discount, shown on the price list and the quote form.
  preview: { note: "30% off for our first 25 customers" },

  modules: {
    // Intelligence
    tip: { name: "Intelligence Processor", category: "Intelligence", tier: "standard" },
    ioc_vault: { name: "IOC Vault", category: "Intelligence", tier: "premium" },
    news: { name: "Intelligence Feed", category: "Intelligence", tier: "standard" },

    // Forensics
    file_review: { name: "File Analysis", category: "Forensics", tier: "standard" },
    email_review: { name: "Email Analysis", category: "Forensics", tier: "standard" },
    process_checker: { name: "Process Analysis", category: "Forensics", tier: "standard" },
    browser_analysis: { name: "Browser Analysis", category: "Forensics", tier: "standard" },
    service_analysis: { name: "Service Analysis", category: "Forensics", tier: "standard" },
    scheduled_task_analysis: { name: "Scheduled Task Analysis", category: "Forensics", tier: "standard" },
    registry_persistence: { name: "Registry & Persistence Analysis", category: "Forensics", tier: "standard" },
    execution_evidence: { name: "Execution Evidence Analysis", category: "Forensics", tier: "standard" },
    event_log_logon: { name: "Event Log & Logon Analysis", category: "Forensics", tier: "standard" },
    ai_analysis: { name: "AI Analysis", category: "Forensics", tier: "standard" },
    network_connections: { name: "Network Connection Forensics", category: "Forensics", tier: "standard" },

    // Triage: included with Nadirion Desktop.
    malware_scan: { name: "Malware Scan", category: "Triage", tier: "included" },
    secure_host: { name: "Secure Host", category: "Triage", tier: "included" },
    triage_kit_usb: { name: "Triage Kit USB", category: "Triage", tier: "included" },
    usb_iso_burner: { name: "USB ISO Burner", category: "Triage", tier: "included" },

    // Cryptography
    decoder: { name: "Decoder", category: "Cryptography", tier: "standard" },

    // Quantum
    crypto_inventory: { name: "Cryptographic Inventory", category: "Quantum", tier: "premium" },

    // Identity
    persona_manager: { name: "Persona Manager", category: "Identity", tier: "standard" },
    identity_lookup: { name: "Identity Lookup", category: "Identity", tier: "standard" },

    // Network
    uptime: { name: "Uptime Monitor", category: "Network", tier: "standard" },
    traceroute: { name: "Route Mapper", category: "Network", tier: "standard" },
    net_mapper: { name: "Network Mapper", category: "Network", tier: "standard" },

    // Host Utilities: included with Nadirion Desktop.
    driver_manager: { name: "Driver Update Manager", category: "Host Utilities", tier: "included" },
    file_organizer: { name: "File Organizer", category: "Host Utilities", tier: "included" },
    startup_manager: { name: "Startup Manager", category: "Host Utilities", tier: "included" },
    system_health: { name: "System Health Snapshot", category: "Host Utilities", tier: "included" },
    disk_space_analyzer: { name: "Disk Space Analyzer", category: "Host Utilities", tier: "included" },
    duplicate_finder: { name: "Duplicate File Finder", category: "Host Utilities", tier: "included" },
    software_inventory: { name: "Software Inventory & Patch Checker", category: "Host Utilities", tier: "included" },
    file_converter: { name: "File Conversion Kit", category: "Host Utilities", tier: "included" }
  }
};
