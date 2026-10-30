/* =========================================================
   Nadirion product catalog: the commercial record for every
   module the site sells. Names and categories must match the
   cards on modules.html (they share these ids).

   Prices: a number shows on the module cards, the license tray,
   the pricing page, and the quote form. Leave a price as null to
   sell that item on quote; nothing price-shaped renders for it,
   and the tray only shows a total when every item in it is priced.
   ========================================================= */
window.NADIRION_CATALOG = {
  currency: "USD",
  // Shown after any price, e.g. "$0 per seat".
  priceUnit: "per seat",

  desktop: { name: "Nadirion Desktop", price: null },

  modules: {
    // Intelligence
    tip: { name: "Intelligence Processor", category: "Intelligence", price: null },
    ioc_vault: { name: "IOC Vault", category: "Intelligence", price: null },
    news: { name: "Intelligence Feed", category: "Intelligence", price: null },

    // Forensics
    file_review: { name: "File Analysis", category: "Forensics", price: null },
    email_review: { name: "Email Analysis", category: "Forensics", price: null },
    process_checker: { name: "Process Analysis", category: "Forensics", price: null },
    browser_analysis: { name: "Browser Analysis", category: "Forensics", price: null },
    service_analysis: { name: "Service Analysis", category: "Forensics", price: null },
    scheduled_task_analysis: { name: "Scheduled Task Analysis", category: "Forensics", price: null },
    registry_persistence: { name: "Registry & Persistence Analysis", category: "Forensics", price: null },
    execution_evidence: { name: "Execution Evidence Analysis", category: "Forensics", price: null },
    event_log_logon: { name: "Event Log & Logon Analysis", category: "Forensics", price: null },
    ai_analysis: { name: "AI Analysis", category: "Forensics", price: null },
    network_connections: { name: "Network Connection Forensics", category: "Forensics", price: null },

    // Triage
    malware_scan: { name: "Malware Scan", category: "Triage", price: null },
    secure_host: { name: "Secure Host", category: "Triage", price: null },
    triage_kit_usb: { name: "Triage Kit USB", category: "Triage", price: null },
    usb_iso_burner: { name: "USB ISO Burner", category: "Triage", price: null },

    // Cryptography
    decoder: { name: "Decoder", category: "Cryptography", price: null },

    // Quantum
    crypto_inventory: { name: "Cryptographic Inventory", category: "Quantum", price: null },

    // Identity
    persona_manager: { name: "Persona Manager", category: "Identity", price: null },
    identity_lookup: { name: "Identity Lookup", category: "Identity", price: null },

    // Network
    uptime: { name: "Uptime Monitor", category: "Network", price: null },
    traceroute: { name: "Route Mapper", category: "Network", price: null },
    net_mapper: { name: "Network Mapper", category: "Network", price: null },

    // Host Utilities
    driver_manager: { name: "Driver Update Manager", category: "Host Utilities", price: null },
    file_organizer: { name: "File Organizer", category: "Host Utilities", price: null },
    startup_manager: { name: "Startup Manager", category: "Host Utilities", price: null },
    system_health: { name: "System Health Snapshot", category: "Host Utilities", price: null },
    disk_space_analyzer: { name: "Disk Space Analyzer", category: "Host Utilities", price: null },
    duplicate_finder: { name: "Duplicate File Finder", category: "Host Utilities", price: null },
    software_inventory: { name: "Software Inventory & Patch Checker", category: "Host Utilities", price: null },
    file_converter: { name: "File Conversion Kit", category: "Host Utilities", price: null }
  }
};
