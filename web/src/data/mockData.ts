import {
  Customer,
  JobOrder,
  Invoice,
  Payment,
  Expense,
  InventoryItem,
  StockMovement,
  Supplier,
  PurchaseOrder,
  StaffMember,
  NeedsAttentionAlert,
  AIAssistantInsight
} from '../types/erp';

export const INITIAL_STAFF: StaffMember[] = [
  { id: 'st-1', name: 'Ahsan "Acko"', role: 'Lead Painter' },
  { id: 'st-2', name: 'Nabeel Rizvy', role: 'Wrap Specialist' },
  { id: 'st-3', name: 'Sham Hussain', role: 'Detailer' },
  { id: 'st-4', name: 'Moosa Latheef', role: 'Workshop Manager' },
  { id: 'st-5', name: 'Fayaz "Faaye"', role: 'Prep Tech' }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Ahmed Rauf',
    phone: '+960 778-4321',
    email: 'rauf.ahmed@outlook.com',
    type: 'Individual',
    island: "Male'",
    vehicles: [
      {
        plateNumber: 'AB1-8842',
        make: 'Toyota',
        model: 'Land Cruiser Prado TX',
        year: 2021,
        color: 'Pearl White',
        type: 'Car'
      }
    ],
    activeJobsCount: 1,
    totalInvoiced: 85000,
    outstandingBalance: 18500,
    lastPaymentDate: '2026-08-10',
    notes: 'Long-time customer. Prefers top-tier PPG ceramic clearcoat. Inquire before adding extra prep work.',
    createdAt: '2024-02-14'
  },
  {
    id: 'cust-2',
    name: 'Ibrahim Shaan',
    phone: '+960 790-1122',
    email: 'shaan.ib@gmail.com',
    type: 'VIP',
    island: "Hulhumale'",
    vehicles: [
      {
        plateNumber: 'A0B-4491',
        make: 'Toyota',
        model: 'GR Supra MK5',
        year: 2022,
        color: 'Yellow (Wrapping to Satin Black)',
        type: 'Car'
      }
    ],
    activeJobsCount: 1,
    totalInvoiced: 48000,
    outstandingBalance: 12000,
    lastPaymentDate: '2026-08-12',
    notes: 'Very detail-oriented car enthusiast. Full body wrap + ceramic coat over vinyl.',
    createdAt: '2024-06-20'
  },
  {
    id: 'cust-3',
    name: 'Ismail Ziyad',
    phone: '+960 766-9900',
    email: 'ziyad.marine@dhivehinet.net.mv',
    type: 'Individual',
    island: "Hulhumale' Phase 2",
    vehicles: [
      {
        plateNumber: 'SK-2041',
        make: 'Yamaha',
        model: 'FX Cruiser SVHO WaveRunner',
        year: 2023,
        color: 'Custom Metallic Candy Red & Silver',
        type: 'Speedboat/Jetski'
      }
    ],
    activeJobsCount: 1,
    totalInvoiced: 62000,
    outstandingBalance: 0,
    lastPaymentDate: '2026-08-18',
    notes: 'Saltwater resistant marine polyurethane clearcoat required.',
    createdAt: '2024-09-05'
  },
  {
    id: 'cust-4',
    name: 'Trans Maldivian Transfers (Fleet)',
    phone: '+960 332-9090',
    email: 'fleet@tma.com.mv',
    type: 'Fleet',
    island: "Hulhule / Male'",
    vehicles: [
      {
        plateNumber: 'C1A-9011',
        make: 'Toyota',
        model: 'Hiace Commuter Van (Unit #12)',
        year: 2020,
        color: 'Resort Fleet Navy Blue',
        type: 'Van/Truck'
      },
      {
        plateNumber: 'C1A-9014',
        make: 'Toyota',
        model: 'Hiace Commuter Van (Unit #15)',
        year: 2021,
        color: 'Resort Fleet Navy Blue',
        type: 'Van/Truck'
      }
    ],
    activeJobsCount: 2,
    totalInvoiced: 142000,
    outstandingBalance: 42700,
    lastPaymentDate: '2026-07-28',
    notes: 'Corporate account 30-day net terms. Requires formal MIRA GST tax invoices with PO ref.',
    createdAt: '2023-11-10'
  },
  {
    id: 'cust-5',
    name: 'Aishath Maya',
    phone: '+960 771-5544',
    email: 'maya.aishath@gmail.com',
    type: 'Individual',
    island: "Male'",
    vehicles: [
      {
        plateNumber: 'B0C-1290',
        make: 'Audi',
        model: 'A4 S-Line Quattro',
        year: 2020,
        color: 'Mythos Black Metallic',
        type: 'Car'
      }
    ],
    activeJobsCount: 1,
    totalInvoiced: 32000,
    outstandingBalance: 8000,
    lastPaymentDate: '2026-08-02',
    notes: '3-stage paint correction with 5-year Gyeon quartz ceramic coating.',
    createdAt: '2024-12-01'
  },
  {
    id: 'cust-6',
    name: 'Hassan Samah',
    phone: '+960 798-2233',
    email: 'samah.h@mohe.gov.mv',
    type: 'Individual',
    island: "Villimale'",
    vehicles: [
      {
        plateNumber: 'A1B-7721',
        make: 'Honda',
        model: 'Civic Turbo RS',
        year: 2019,
        color: 'Rallye Red',
        type: 'Car'
      }
    ],
    activeJobsCount: 0,
    totalInvoiced: 24500,
    outstandingBalance: 0,
    lastPaymentDate: '2026-07-15',
    notes: 'Front bumper and left fender scratch repair + blend.',
    createdAt: '2026-04-10'
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    sku: 'PNT-CLR-2K',
    name: 'PPG Deltron High-Gloss 2K Clearcoat (5L Can)',
    category: 'Clearcoats & Hardener',
    quantityOnHand: 2, // Low stock alert! Reorder level is 5
    unit: 'Tins (5L)',
    reorderLevel: 5,
    unitCost: 2850,
    sellingPrice: 4200,
    supplierId: 'sup-1',
    supplierName: 'ColorCraft Maldives Pvt Ltd',
    locationInShop: 'Paint Mixing Bay A - Shelf 2',
    stockStatus: 'Low Stock',
    lastRestockedDate: '2026-07-10'
  },
  {
    id: 'inv-2',
    sku: 'PNT-PRM-2K',
    name: 'Nippon Paint 2K Epoxy Anti-Corrosion Primer (4L)',
    category: 'Paints & Primers',
    quantityOnHand: 14,
    unit: 'Tins (4L)',
    reorderLevel: 4,
    unitCost: 1450,
    sellingPrice: 2200,
    supplierId: 'sup-1',
    supplierName: 'ColorCraft Maldives Pvt Ltd',
    locationInShop: 'Paint Mixing Bay A - Shelf 1',
    stockStatus: 'In Stock',
    lastRestockedDate: '2026-08-04'
  },
  {
    id: 'inv-3',
    sku: 'VNL-AVR-SBK',
    name: 'Avery Dennison SW900 Supreme Wrap - Satin Black (25m)',
    category: 'Vinyl & PPF Wraps',
    quantityOnHand: 1, // Critical low stock for incoming Supra wrap
    unit: 'Rolls (25m)',
    reorderLevel: 3,
    unitCost: 8200,
    sellingPrice: 12500,
    supplierId: 'sup-2',
    supplierName: 'Avery & 3M SG Direct (Via Sea Cargo)',
    locationInShop: 'Clean Wrap Studio - Rack 1',
    stockStatus: 'Low Stock',
    lastRestockedDate: '2026-06-22'
  },
  {
    id: 'inv-4',
    sku: 'VNL-STEK-PPF',
    name: 'STEK DynoShield Self-Healing Gloss PPF (15m)',
    category: 'Vinyl & PPF Wraps',
    quantityOnHand: 3,
    unit: 'Rolls (15m)',
    reorderLevel: 2,
    unitCost: 11400,
    sellingPrice: 17000,
    supplierId: 'sup-2',
    supplierName: 'Avery & 3M SG Direct (Via Sea Cargo)',
    locationInShop: 'Clean Wrap Studio - Rack 2',
    stockStatus: 'In Stock',
    lastRestockedDate: '2026-07-18'
  },
  {
    id: 'inv-5',
    sku: 'ABR-3M-P1500',
    name: '3M Hookit Wetordry Sandpaper Discs P1500 (Box of 50)',
    category: 'Abrasives & Sanding',
    quantityOnHand: 8,
    unit: 'Boxes (50pcs)',
    reorderLevel: 3,
    unitCost: 480,
    sellingPrice: 750,
    supplierId: 'sup-3',
    supplierName: 'Autofix Supplies Hulhumale',
    locationInShop: 'Prep Bay 1 - Tool Cabinet',
    stockStatus: 'In Stock',
    lastRestockedDate: '2026-08-01'
  },
  {
    id: 'inv-6',
    sku: 'ABR-3M-P2000',
    name: '3M Trizact Precision Sanding Disc P3000 (Box of 15)',
    category: 'Abrasives & Sanding',
    quantityOnHand: 1, // Low stock
    unit: 'Boxes (15pcs)',
    reorderLevel: 3,
    unitCost: 720,
    sellingPrice: 1100,
    supplierId: 'sup-3',
    supplierName: 'Autofix Supplies Hulhumale',
    locationInShop: 'Prep Bay 1 - Tool Cabinet',
    stockStatus: 'Low Stock',
    lastRestockedDate: '2026-07-05'
  },
  {
    id: 'inv-7',
    sku: 'FLR-BND-3L',
    name: 'Evercoat Rage Ultra Lightweight Body Filler (3L)',
    category: 'Fillers & Sealants',
    quantityOnHand: 6,
    unit: 'Tins (3L)',
    reorderLevel: 2,
    unitCost: 650,
    sellingPrice: 950,
    supplierId: 'sup-3',
    supplierName: 'Autofix Supplies Hulhumale',
    locationInShop: 'Prep Bay 2 - Shelf B',
    stockStatus: 'In Stock',
    lastRestockedDate: '2026-08-08'
  },
  {
    id: 'inv-8',
    sku: 'CMP-MNZ-400',
    name: 'Menzerna Heavy Cut Compound 400 Fast Gloss (1L)',
    category: 'Compounds & Detailing',
    quantityOnHand: 9,
    unit: 'Bottles (1L)',
    reorderLevel: 3,
    unitCost: 520,
    sellingPrice: 800,
    supplierId: 'sup-4',
    supplierName: 'Allied Hardware & Marine Supplies Male',
    locationInShop: 'Detailing Bay - Chemicals Cabinet',
    stockStatus: 'In Stock',
    lastRestockedDate: '2026-08-11'
  },
  {
    id: 'inv-9',
    sku: 'MSK-3M-24MM',
    name: '3M Automotive Yellow Masking Tape 24mm (Pack of 24)',
    category: 'Masking & Prep',
    quantityOnHand: 12,
    unit: 'Packs (24 rolls)',
    reorderLevel: 4,
    unitCost: 360,
    sellingPrice: 550,
    supplierId: 'sup-3',
    supplierName: 'Autofix Supplies Hulhumale',
    locationInShop: 'Prep Bay 1 - Supply Wall',
    stockStatus: 'In Stock',
    lastRestockedDate: '2026-08-05'
  }
];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'mov-1',
    itemId: 'inv-1',
    itemName: 'PPG Deltron High-Gloss 2K Clearcoat (5L Can)',
    type: 'Deducted (Job)',
    quantity: -1,
    unit: 'Tin',
    date: '2026-08-20 10:15',
    reference: 'IGN-0234',
    staffName: 'Ahsan "Acko"',
    notes: 'Used for Prado full clearcoat finishing pass'
  },
  {
    id: 'mov-2',
    itemId: 'inv-3',
    itemName: 'Avery Dennison SW900 Supreme Wrap - Satin Black (25m)',
    type: 'Deducted (Job)',
    quantity: -1,
    unit: 'Roll',
    date: '2026-08-19 14:30',
    reference: 'IGN-0235',
    staffName: 'Nabeel Rizvy',
    notes: 'Full body wrap on GR Supra'
  },
  {
    id: 'mov-3',
    itemId: 'inv-8',
    itemName: 'Menzerna Heavy Cut Compound 400 Fast Gloss (1L)',
    type: 'Received',
    quantity: 6,
    unit: 'Bottles',
    date: '2026-08-11 09:00',
    reference: 'PO-2026-039',
    staffName: 'Moosa Latheef',
    notes: 'Stock delivery from Allied Hardware Male'
  },
  {
    id: 'mov-4',
    itemId: 'inv-5',
    itemId2: 'ABR-3M-P1500',
    itemName: '3M Hookit Wetordry Sandpaper Discs P1500',
    type: 'Deducted (Job)',
    quantity: -2,
    unit: 'Boxes',
    date: '2026-08-18 11:20',
    reference: 'IGN-0234',
    staffName: 'Fayaz "Faaye"',
    notes: 'Surface flattening on Prado panels'
  } as any
];

export const INITIAL_JOBS: JobOrder[] = [
  {
    id: 'job-1',
    jobId: 'IGN-0234',
    customerId: 'cust-1',
    customerName: 'Ahmed Rauf',
    customerPhone: '+960 778-4321',
    vehicle: {
      plateNumber: 'AB1-8842',
      make: 'Toyota',
      model: 'Land Cruiser Prado TX',
      year: 2021,
      color: 'Pearl White',
      type: 'Car'
    },
    serviceType: 'Full Body Repaint',
    requestedWork: 'Full exterior teardown, dent rectification on rear quarter, 3-layer PPG Pearl White 070 repaint with 2K high-solids clearcoat + 9H ceramic coating.',
    specialInstructions: 'Customer requested photo updates on primer coat before final color spray.',
    quotedAmount: 48500,
    depositPaid: 30000,
    balanceDue: 18500,
    assignedStaff: [INITIAL_STAFF[0], INITIAL_STAFF[4]], // Ahsan + Fayaz
    status: 'In Progress',
    priority: 'High',
    startDate: '2026-08-14',
    expectedCompletionDate: '2026-08-25',
    materialsUsed: [
      {
        id: 'mat-1',
        inventoryId: 'inv-1',
        itemName: 'PPG Deltron High-Gloss 2K Clearcoat (5L Can)',
        quantity: 2,
        unit: 'Tins',
        unitCost: 2850,
        totalCost: 5700,
        addedAt: '2026-08-16'
      },
      {
        id: 'mat-2',
        inventoryId: 'inv-2',
        itemName: 'Nippon 2K Epoxy Primer (4L)',
        quantity: 2,
        unit: 'Tins',
        unitCost: 1450,
        totalCost: 2900,
        addedAt: '2026-08-15'
      },
      {
        id: 'mat-3',
        inventoryId: 'inv-7',
        itemName: 'Evercoat Lightweight Body Filler',
        quantity: 1,
        unit: 'Tin',
        unitCost: 650,
        totalCost: 650,
        addedAt: '2026-08-15'
      },
      {
        id: 'mat-4',
        inventoryId: 'inv-9',
        itemName: '3M Automotive Masking Tape 24mm',
        quantity: 2,
        unit: 'Packs',
        unitCost: 360,
        totalCost: 720,
        addedAt: '2026-08-16'
      }
    ],
    estimatedMaterialCost: 8500,
    actualMaterialCost: 9970, // Exceeded estimate slightly (AI insight trigger!)
    laborCostEstimate: 14000,
    targetMarginPercentage: 53.6,
    actualProfit: 24530,
    bayNumber: 'Spray Booth Bay 1 (Bake Oven)',
    linkedInvoiceId: 'inv-084'
  },
  {
    id: 'job-2',
    jobId: 'IGN-0235',
    customerId: 'cust-2',
    customerName: 'Ibrahim Shaan',
    customerPhone: '+960 790-1122',
    vehicle: {
      plateNumber: 'A0B-4491',
      make: 'Toyota',
      model: 'GR Supra MK5',
      year: 2022,
      color: 'Yellow (Original)',
      type: 'Car'
    },
    serviceType: 'Vinyl Wrap Installation',
    requestedWork: 'Full vehicle color change wrap using Avery Dennison Satin Black + Gloss Carbon Fibre roof & spoiler accents. Door jamb wrap included.',
    specialInstructions: 'Disassemble wing mirrors and door handles carefully. No cuts on paint.',
    quotedAmount: 36000,
    depositPaid: 24000,
    balanceDue: 12000,
    assignedStaff: [INITIAL_STAFF[1]], // Nabeel
    status: 'In Progress',
    priority: 'High',
    startDate: '2026-08-17',
    expectedCompletionDate: '2026-08-24',
    materialsUsed: [
      {
        id: 'mat-5',
        inventoryId: 'inv-3',
        itemName: 'Avery Dennison SW900 Satin Black (25m)',
        quantity: 1,
        unit: 'Roll',
        unitCost: 8200,
        totalCost: 8200,
        addedAt: '2026-08-18'
      },
      {
        id: 'mat-6',
        inventoryId: 'inv-9',
        itemName: '3M Precision Masking Tape',
        quantity: 1,
        unit: 'Pack',
        unitCost: 360,
        totalCost: 360,
        addedAt: '2026-08-18'
      }
    ],
    estimatedMaterialCost: 8800,
    actualMaterialCost: 8560,
    laborCostEstimate: 9500,
    targetMarginPercentage: 49.8,
    actualProfit: 17940,
    bayNumber: 'Clean Wrap Bay 1'
  },
  {
    id: 'job-3',
    jobId: 'IGN-0236',
    customerId: 'cust-3',
    customerName: 'Ismail Ziyad',
    customerPhone: '+960 766-9900',
    vehicle: {
      plateNumber: 'SK-2041',
      make: 'Yamaha',
      model: 'FX Cruiser SVHO WaveRunner',
      year: 2023,
      color: 'Custom Metallic Red',
      type: 'Speedboat/Jetski'
    },
    serviceType: 'Custom Paint',
    requestedWork: 'Custom candy red flake top deck repaint + silver pearl bottom hull anti-fouling clearcoat and custom vinyl registration graphics.',
    specialInstructions: 'Marine UV & saltwater grade clearcoat bake.',
    quotedAmount: 28000,
    depositPaid: 28000,
    balanceDue: 0,
    assignedStaff: [INITIAL_STAFF[0], INITIAL_STAFF[2]], // Ahsan + Sham
    status: 'Completed',
    priority: 'Normal',
    startDate: '2026-08-08',
    expectedCompletionDate: '2026-08-18',
    completedDate: '2026-08-18',
    materialsUsed: [
      {
        id: 'mat-7',
        inventoryId: 'inv-1',
        itemName: 'PPG 2K Clearcoat (Marine Blend)',
        quantity: 1,
        unit: 'Tin',
        unitCost: 2850,
        totalCost: 2850,
        addedAt: '2026-08-10'
      },
      {
        id: 'mat-8',
        inventoryId: 'inv-2',
        itemName: 'Nippon Epoxy Marine Primer',
        quantity: 1,
        unit: 'Tin',
        unitCost: 1450,
        totalCost: 1450,
        addedAt: '2026-08-09'
      }
    ],
    estimatedMaterialCost: 4500,
    actualMaterialCost: 4300,
    laborCostEstimate: 7000,
    targetMarginPercentage: 59.6,
    actualProfit: 16700,
    bayNumber: 'Prep Bay 2'
  },
  {
    id: 'job-4',
    jobId: 'IGN-0237',
    customerId: 'cust-4',
    customerName: 'Trans Maldivian Transfers (Fleet)',
    customerPhone: '+960 332-9090',
    vehicle: {
      plateNumber: 'C1A-9011',
      make: 'Toyota',
      model: 'Hiace Commuter (Unit #12)',
      year: 2020,
      color: 'Fleet Navy Blue',
      type: 'Van/Truck'
    },
    serviceType: 'Panel Repaint',
    requestedWork: 'Accident damage repair on passenger slide door, left rocker panel pull and respray to match TMA fleet color code.',
    quotedAmount: 16500,
    depositPaid: 0,
    balanceDue: 16500,
    assignedStaff: [INITIAL_STAFF[4], INITIAL_STAFF[0]],
    status: 'Waiting for Material', // Waiting for OEM passenger door rubber seal
    priority: 'Urgent',
    startDate: '2026-08-19',
    expectedCompletionDate: '2026-08-26',
    materialsUsed: [
      {
        id: 'mat-9',
        inventoryId: 'inv-7',
        itemName: 'Evercoat Body Filler',
        quantity: 1,
        unit: 'Tin',
        unitCost: 650,
        totalCost: 650,
        addedAt: '2026-08-19'
      }
    ],
    estimatedMaterialCost: 2800,
    actualMaterialCost: 650,
    laborCostEstimate: 4500,
    targetMarginPercentage: 55.7,
    actualProfit: 11350,
    bayNumber: 'Body Pull Bay 3'
  },
  {
    id: 'job-5',
    jobId: 'IGN-0238',
    customerId: 'cust-5',
    customerName: 'Aishath Maya',
    customerPhone: '+960 771-5544',
    vehicle: {
      plateNumber: 'B0C-1290',
      make: 'Audi',
      model: 'A4 S-Line Quattro',
      year: 2020,
      color: 'Mythos Black Metallic',
      type: 'Car'
    },
    serviceType: 'Ceramic & Detailing',
    requestedWork: 'Heavy swirl mark removal (3-stage polish with Menzerna 400 + 3800), Gyeon Quartz 5-year ceramic coating on paint, wheels & calipers + glass hydrophobic treatment.',
    quotedAmount: 18000,
    depositPaid: 10000,
    balanceDue: 8000,
    assignedStaff: [INITIAL_STAFF[2]], // Sham
    status: 'In Progress',
    priority: 'Normal',
    startDate: '2026-08-20',
    expectedCompletionDate: '2026-08-23',
    materialsUsed: [
      {
        id: 'mat-10',
        inventoryId: 'inv-8',
        itemName: 'Menzerna Compound 400 (1L)',
        quantity: 1,
        unit: 'Bottle',
        unitCost: 520,
        totalCost: 520,
        addedAt: '2026-08-20'
      }
    ],
    estimatedMaterialCost: 1800,
    actualMaterialCost: 1200,
    laborCostEstimate: 4500,
    targetMarginPercentage: 68.3,
    actualProfit: 12300,
    bayNumber: 'Detailing Bay A (LED Tunnel)'
  },
  {
    id: 'job-6',
    jobId: 'IGN-0239',
    customerId: 'cust-4',
    customerName: 'Trans Maldivian Transfers (Fleet)',
    customerPhone: '+960 332-9090',
    vehicle: {
      plateNumber: 'C1A-9014',
      make: 'Toyota',
      model: 'Hiace Commuter (Unit #15)',
      year: 2021,
      color: 'Fleet Navy Blue',
      type: 'Van/Truck'
    },
    serviceType: 'Vinyl Wrap Installation',
    requestedWork: 'Full promotional side livery re-wrap with new resort partnership branding (Waldorf Astoria Maldives logos).',
    quotedAmount: 26200,
    depositPaid: 0,
    balanceDue: 26200,
    assignedStaff: [INITIAL_STAFF[1]],
    status: 'Awaiting Approval',
    priority: 'Normal',
    startDate: '2026-08-25',
    expectedCompletionDate: '2026-08-30',
    materialsUsed: [],
    estimatedMaterialCost: 6500,
    actualMaterialCost: 0,
    laborCostEstimate: 7000,
    targetMarginPercentage: 48.4,
    actualProfit: 12700,
    bayNumber: 'Wrap Studio Bay 2'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-081',
    customerId: 'cust-4',
    customerName: 'Trans Maldivian Transfers (Fleet)',
    customerPhone: '+960 332-9090',
    customerIsland: 'Hulhule / Male',
    linkedJobId: 'job-prev-1',
    linkedJobNumber: 'IGN-0229',
    date: '2026-07-25',
    dueDate: '2026-08-10', // Overdue by 13 days!
    items: [
      {
        id: 'li-1',
        description: 'Complete Side Repaint & Dent Removal - Hiace #09',
        quantity: 1,
        unitPrice: 22000,
        amount: 22000,
        category: 'Labor/Service'
      },
      {
        id: 'li-2',
        description: 'Fleet Decal Replacement & UV Coating',
        quantity: 1,
        unitPrice: 17537,
        amount: 17537,
        category: 'Material/Part'
      }
    ],
    subtotal: 39537,
    gstRate: 0.08,
    gstAmount: 3163,
    totalAmount: 42700,
    amountPaid: 0,
    balanceDue: 42700,
    status: 'Overdue',
    notes: 'PO Ref: TMA-OPS-2026-442. 30-day net terms exceeded.',
    bankDetails: 'Bank of Maldives (BML) Account: 7730000189201 MVR'
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-2026-084',
    customerId: 'cust-1',
    customerName: 'Ahmed Rauf',
    customerPhone: '+960 778-4321',
    customerIsland: "Male'",
    linkedJobId: 'job-1',
    linkedJobNumber: 'IGN-0234',
    date: '2026-08-14',
    dueDate: '2026-08-25',
    items: [
      {
        id: 'li-3',
        description: 'Full Body Paint Restoration & Teardown (Land Cruiser Prado)',
        quantity: 1,
        unitPrice: 32000,
        amount: 32000,
        category: 'Labor/Service'
      },
      {
        id: 'li-4',
        description: 'PPG 2K High Solids Clearcoat & Multi-Layer Pearl Coat',
        quantity: 1,
        unitPrice: 8907.41,
        amount: 8907.41,
        category: 'Material/Part'
      },
      {
        id: 'li-5',
        description: '9H Ceramic Coating Protection Package',
        quantity: 1,
        unitPrice: 4000,
        amount: 4000,
        category: 'Labor/Service'
      }
    ],
    subtotal: 44907.41,
    gstRate: 0.08,
    gstAmount: 3592.59,
    totalAmount: 48500,
    amountPaid: 30000,
    balanceDue: 18500,
    status: 'Partially Paid',
    notes: 'Deposit of MVR 30,000 received via BML on 14 August 2026. Balance due upon delivery.',
    bankDetails: 'Bank of Maldives (BML) Account: 7730000189201 MVR'
  },
  {
    id: 'inv-3',
    invoiceNumber: 'INV-2026-085',
    customerId: 'cust-2',
    customerName: 'Ibrahim Shaan',
    customerPhone: '+960 790-1122',
    customerIsland: "Hulhumale'",
    linkedJobId: 'job-2',
    linkedJobNumber: 'IGN-0235',
    date: '2026-08-17',
    dueDate: '2026-08-24',
    items: [
      {
        id: 'li-6',
        description: 'Avery SW900 Full Vehicle Wrap (GR Supra MK5)',
        quantity: 1,
        unitPrice: 28000,
        amount: 28000,
        category: 'Labor/Service'
      },
      {
        id: 'li-7',
        description: 'Gloss Carbon Roof & Spoiler Accent Package',
        quantity: 1,
        unitPrice: 5333.33,
        amount: 5333.33,
        category: 'Material/Part'
      }
    ],
    subtotal: 33333.33,
    gstRate: 0.08,
    gstAmount: 2666.67,
    totalAmount: 36000,
    amountPaid: 24000,
    balanceDue: 12000,
    status: 'Partially Paid',
    notes: 'Deposit received. Final payment due upon vehicle inspection.',
    bankDetails: 'Bank of Maldives (BML) Account: 7730000189201 MVR'
  },
  {
    id: 'inv-4',
    invoiceNumber: 'INV-2026-086',
    customerId: 'cust-3',
    customerName: 'Ismail Ziyad',
    customerPhone: '+960 766-9900',
    customerIsland: "Hulhumale' Phase 2",
    linkedJobId: 'job-3',
    linkedJobNumber: 'IGN-0236',
    date: '2026-08-08',
    dueDate: '2026-08-18',
    items: [
      {
        id: 'li-8',
        description: 'Yamaha FX SVHO Custom Marine Paint & Hull Seal',
        quantity: 1,
        unitPrice: 25925.93,
        amount: 25925.93,
        category: 'Labor/Service'
      }
    ],
    subtotal: 25925.93,
    gstRate: 0.08,
    gstAmount: 2074.07,
    totalAmount: 28000,
    amountPaid: 28000,
    balanceDue: 0,
    status: 'Paid',
    notes: 'Fully settled via BML Transfer on 18 August 2026.',
    bankDetails: 'Bank of Maldives (BML) Account: 7730000189201 MVR'
  },
  {
    id: 'inv-5',
    invoiceNumber: 'INV-2026-087',
    customerId: 'cust-5',
    customerName: 'Aishath Maya',
    customerPhone: '+960 771-5544',
    customerIsland: "Male'",
    linkedJobId: 'job-5',
    linkedJobNumber: 'IGN-0238',
    date: '2026-08-20',
    dueDate: '2026-08-23',
    items: [
      {
        id: 'li-9',
        description: 'Audi A4 3-Stage Paint Correction & Gyeon Ceramic Coating',
        quantity: 1,
        unitPrice: 16666.67,
        amount: 16666.67,
        category: 'Labor/Service'
      }
    ],
    subtotal: 16666.67,
    gstRate: 0.08,
    gstAmount: 1333.33,
    totalAmount: 18000,
    amountPaid: 10000,
    balanceDue: 8000,
    status: 'Partially Paid',
    notes: '50% advance received. Completion certificate will be provided.',
    bankDetails: 'Bank of Maldives (BML) Account: 7730000189201 MVR'
  }
];

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    paymentNumber: 'PAY-1090',
    invoiceId: 'inv-4',
    invoiceNumber: 'INV-2026-086',
    customerId: 'cust-3',
    customerName: 'Ismail Ziyad',
    amount: 28000,
    paymentDate: '2026-08-18',
    method: 'BML Transfer',
    referenceNumber: 'BML-TXN-984421-MV',
    status: 'Verified',
    notes: 'Jetski full payment verified via BML mobile banking'
  },
  {
    id: 'pay-2',
    paymentNumber: 'PAY-1089',
    invoiceId: 'inv-3',
    invoiceNumber: 'INV-2026-085',
    customerId: 'cust-2',
    customerName: 'Ibrahim Shaan',
    amount: 24000,
    paymentDate: '2026-08-17',
    method: 'BML Transfer',
    referenceNumber: 'BML-TRF-332901-SHAAN',
    status: 'Verified',
    notes: 'Supra wrap booking deposit'
  },
  {
    id: 'pay-3',
    paymentNumber: 'PAY-1088',
    invoiceId: 'inv-2',
    invoiceNumber: 'INV-2026-084',
    customerId: 'cust-1',
    customerName: 'Ahmed Rauf',
    amount: 30000,
    paymentDate: '2026-08-14',
    method: 'BML Transfer',
    referenceNumber: 'BML-TXN-110948-RAUF',
    status: 'Verified',
    notes: 'Prado paint job deposit'
  },
  {
    id: 'pay-4',
    paymentNumber: 'PAY-1091',
    invoiceId: 'inv-5',
    invoiceNumber: 'INV-2026-087',
    customerId: 'cust-5',
    customerName: 'Aishath Maya',
    amount: 10000,
    paymentDate: '2026-08-20',
    method: 'POS Card',
    referenceNumber: 'BML-POS-84491-01',
    status: 'Verified',
    notes: 'BML card machine at reception counter'
  },
  {
    id: 'pay-5',
    paymentNumber: 'PAY-1092',
    invoiceId: 'inv-1',
    invoiceNumber: 'INV-2026-081',
    customerId: 'cust-4',
    customerName: 'Trans Maldivian Transfers (Fleet)',
    amount: 15000,
    paymentDate: '2026-08-22',
    method: 'MIB Transfer',
    referenceNumber: 'MIB-FT-20260822-88',
    status: 'Pending Reconciliation', // Pending slip match!
    notes: 'Partial payment slip received on Viber, pending accountant bank statement reconciliation'
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'ColorCraft Maldives Pvt Ltd',
    contactPerson: 'Mohamed Nazim',
    phone: '+960 334-1188',
    email: 'sales@colorcraft.mv',
    address: 'M. Fandiyaaru Goalhi, Male',
    islandOrCountry: "Male', Maldives",
    category: 'Paints, Primers & High-Solids Clearcoats (PPG & Nippon Authorized)',
    outstandingPayable: 14250,
    leadTimeDays: 1,
    rating: 4.9
  },
  {
    id: 'sup-2',
    name: 'Avery & 3M SG Direct (Via Sea Cargo)',
    contactPerson: 'Dennis Tan',
    phone: '+65 6749 2210',
    email: 'orders.apac@averydennison.sg',
    address: 'Tuas Industrial Ave 3, Singapore',
    islandOrCountry: 'Singapore / Male Port Transit',
    category: 'Premium Vinyl Cast Wraps, PPF Rolls & Cutting Tools',
    outstandingPayable: 22800,
    leadTimeDays: 10,
    rating: 4.8
  },
  {
    id: 'sup-3',
    name: 'Autofix Supplies Hulhumale',
    contactPerson: 'Ali Rasheed',
    phone: '+960 779-6611',
    email: 'autofix.mv@gmail.com',
    address: 'Lot 10428, Hithigas Magu, Hulhumale',
    islandOrCountry: "Hulhumale', Maldives",
    category: '3M Abrasives, Masking Tapes, Fillers & Buffing Pads',
    outstandingPayable: 8350,
    leadTimeDays: 1,
    rating: 4.7
  },
  {
    id: 'sup-4',
    name: 'Allied Hardware & Marine Supplies Male',
    contactPerson: 'Ibrahim Waheed',
    phone: '+960 331-5050',
    email: 'marine@alliedhardware.mv',
    address: 'Boduthakurufaanu Magu, Male',
    islandOrCountry: "Male', Maldives",
    category: 'Menzerna Compounds, Spray Guns, Solvents & PPE',
    outstandingPayable: 7000,
    leadTimeDays: 1,
    rating: 4.6
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-1',
    poNumber: 'PO-2026-041',
    supplierId: 'sup-1',
    supplierName: 'ColorCraft Maldives Pvt Ltd',
    orderDate: '2026-08-18',
    expectedDeliveryDate: '2026-08-24', // Due tomorrow!
    items: [
      {
        id: 'poi-1',
        inventoryId: 'inv-1',
        itemName: 'PPG Deltron High-Gloss 2K Clearcoat (5L Can)',
        quantity: 4,
        unit: 'Tins (5L)',
        unitCost: 2850,
        totalCost: 11400,
        receivedQuantity: 0
      },
      {
        id: 'poi-2',
        inventoryId: 'inv-2',
        itemName: 'Nippon Paint 2K Epoxy Primer (4L)',
        quantity: 2,
        unit: 'Tins (4L)',
        unitCost: 1450,
        totalCost: 2900,
        receivedQuantity: 0
      }
    ],
    subtotal: 14300,
    gstAmount: 1144,
    totalAmount: 15444,
    status: 'Sent',
    paymentStatus: 'Unpaid',
    notes: 'Urgent restocking for garage bays. Deliver to Hulhumale Phase 2 workshop.'
  },
  {
    id: 'po-2',
    poNumber: 'PO-2026-042',
    supplierId: 'sup-2',
    supplierName: 'Avery & 3M SG Direct (Via Sea Cargo)',
    orderDate: '2026-08-10',
    expectedDeliveryDate: '2026-08-28',
    items: [
      {
        id: 'poi-3',
        inventoryId: 'inv-3',
        itemName: 'Avery Dennison SW900 Supreme Wrap - Satin Black (25m)',
        quantity: 3,
        unit: 'Rolls (25m)',
        unitCost: 8200,
        totalCost: 24600,
        receivedQuantity: 0
      }
    ],
    subtotal: 24600,
    gstAmount: 1968,
    totalAmount: 26568,
    status: 'Sent',
    paymentStatus: 'Partially Paid',
    notes: 'Shipped via Centurion Air/Sea freight to Male Port. Awaiting customs clearance.'
  },
  {
    id: 'po-3',
    poNumber: 'PO-2026-039',
    supplierId: 'sup-4',
    supplierName: 'Allied Hardware & Marine Supplies Male',
    orderDate: '2026-08-08',
    expectedDeliveryDate: '2026-08-11',
    items: [
      {
        id: 'poi-4',
        inventoryId: 'inv-8',
        itemName: 'Menzerna Heavy Cut Compound 400 Fast Gloss (1L)',
        quantity: 6,
        unit: 'Bottles (1L)',
        unitCost: 520,
        totalCost: 3120,
        receivedQuantity: 6
      }
    ],
    subtotal: 3120,
    gstAmount: 249.6,
    totalAmount: 3369.6,
    status: 'Received & Stocked',
    paymentStatus: 'Paid',
    notes: 'Stock received and inspected by Moosa.'
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    expenseNumber: 'EXP-2026-051',
    category: 'Workshop Rent (Hulhumale)',
    payee: 'HDC (Housing Development Corporation)',
    description: 'Monthly workshop premises lease - Lot 11492 Phase 2 Garage Zone',
    amount: 32000,
    date: '2026-08-01',
    paymentMethod: 'BML Transfer',
    receiptRef: 'HDC-RCP-2026-9912',
    status: 'Paid'
  },
  {
    id: 'exp-2',
    expenseNumber: 'EXP-2026-052',
    category: 'Electricity & Spray Booth',
    payee: 'STELCO (State Electric Company)',
    description: '3-phase commercial electricity for bake oven, infrared lamps & 15HP air compressor',
    amount: 14850,
    date: '2026-08-05',
    paymentMethod: 'BML Transfer',
    receiptRef: 'STELCO-MVR-88402',
    status: 'Paid'
  },
  {
    id: 'exp-3',
    expenseNumber: 'EXP-2026-053',
    category: 'Equipment Maintenance',
    payee: 'Pneumatic Tech Maldives',
    description: 'Binks spray gun ultrasonic clean & compressor oil / filter replacement',
    amount: 3400,
    date: '2026-08-12',
    paymentMethod: 'Cash',
    receiptRef: 'PTM-INV-109',
    status: 'Paid'
  },
  {
    id: 'exp-4',
    expenseNumber: 'EXP-2026-054',
    category: 'Consumables & Tools',
    payee: 'Autofix Supplies Hulhumale',
    description: 'SATA spray gun disposable cup liners (Box of 100), nitrile gloves & tack cloths',
    amount: 2150,
    date: '2026-08-16',
    paymentMethod: 'POS Card',
    receiptRef: 'AFS-CSH-441',
    status: 'Paid'
  }
];

export const INITIAL_ALERTS: NeedsAttentionAlert[] = [
  {
    id: 'alt-1',
    type: 'overdue_invoice',
    title: 'Invoice INV-2026-081 overdue by 13 days',
    description: 'Trans Maldivian Transfers (Fleet) has an unpaid balance of MVR 42,700.',
    amount: 42700,
    urgency: 'critical',
    actionLabel: 'View Invoice',
    targetTab: 'invoices',
    targetId: 'inv-1'
  },
  {
    id: 'alt-2',
    type: 'low_stock',
    title: 'PPG 2K Clearcoat & Avery Wrap below reorder level',
    description: 'Only 2 cans of Clearcoat and 1 roll of Satin Black remain. 2 active jobs pending final coats.',
    urgency: 'critical',
    actionLabel: 'Create PO',
    targetTab: 'purchasing'
  },
  {
    id: 'alt-3',
    type: 'supplier_due',
    title: 'Supplier Bill ColorCraft due tomorrow',
    description: 'PO-2026-041 for MVR 15,444 is scheduled for dispatch tomorrow morning.',
    amount: 15444,
    urgency: 'warning',
    actionLabel: 'Check PO',
    targetTab: 'purchasing',
    targetId: 'po-1'
  },
  {
    id: 'alt-4',
    type: 'job_waiting',
    title: 'Job IGN-0237 waiting for OEM door seal',
    description: 'TMA Hiace van slide door repainted but waiting for weatherstrip assembly to assemble.',
    urgency: 'warning',
    actionLabel: 'Open Job Card',
    targetTab: 'jobs',
    targetId: 'job-4'
  },
  {
    id: 'alt-5',
    type: 'payment_unreconciled',
    title: 'Customer payment pending BML/MIB slip match',
    description: 'MVR 15,000 received via MIB transfer from TMA, pending accountant verification.',
    amount: 15000,
    urgency: 'info',
    actionLabel: 'Reconcile',
    targetTab: 'payments',
    targetId: 'pay-5'
  }
];

export const INITIAL_AI_INSIGHTS: AIAssistantInsight[] = [
  {
    id: 'ai-1',
    title: 'Receivables Risk & Working Capital',
    category: 'Receivables',
    impact: 'MVR 42,700 Delayed',
    description: 'Corporate client Trans Maldivian Transfers (Fleet) has exceeded 30-day terms on INV-2026-081. They have 2 additional active jobs currently in queue (IGN-0237 & IGN-0239).',
    recommendedAction: 'Send automated WhatsApp / Viber statement reminder before releasing next vehicle.',
    actionButtonLabel: 'Follow up on Overdue',
    actionPayload: {
      actionType: 'filter_overdue',
      targetId: 'inv-1'
    }
  },
  {
    id: 'ai-2',
    title: 'Stock Depletion Forecast',
    category: 'Inventory',
    impact: 'Stockout in 4 Days',
    description: 'PPG 2K Clearcoat inventory is currently at 2 tins. Based on active job IGN-0234 and upcoming Prado respray, paint bays will halt without immediate restocking.',
    recommendedAction: 'Draft a quick Purchase Order to ColorCraft Maldives for 4 additional 5L cans.',
    actionButtonLabel: 'Quick Draft PO',
    actionPayload: {
      actionType: 'open_po_draft'
    }
  },
  {
    id: 'ai-3',
    title: 'Job Cost Variance Alert',
    category: 'Job Margin',
    impact: '+17.3% Material Variance',
    description: 'Job IGN-0234 (Toyota Prado Repaint) has used MVR 9,970 in materials vs MVR 8,500 estimated due to extra pearl basecoat layering. Gross margin remains healthy at 50.6%.',
    recommendedAction: 'Review materials used log and adjust quoting template for pearl paint codes.',
    actionButtonLabel: 'Inspect Job Margin',
    actionPayload: {
      actionType: 'view_job_margin',
      targetId: 'job-1'
    }
  },
  {
    id: 'ai-4',
    title: 'Cash Inflow Projection',
    category: 'Cash Flow',
    impact: 'MVR 38,500 Expected this Week',
    description: '3 work orders (IGN-0234 Prado, IGN-0235 Supra, IGN-0238 Audi A4) are scheduled for customer delivery within 72 hours with collective balance dues of MVR 38,500.',
    recommendedAction: 'Prepare final GST tax invoices and coordinate vehicle inspection times.',
    actionButtonLabel: 'View Active Jobs',
    actionPayload: {
      actionType: 'view_job_margin'
    }
  }
];

export const MONTHLY_SALES_CHART_DATA = [
  { month: 'Mar', revenue: 142000, expenses: 78000, profit: 64000 },
  { month: 'Apr', revenue: 168000, expenses: 84000, profit: 84000 },
  { month: 'May', revenue: 155000, expenses: 81000, profit: 74000 },
  { month: 'Jun', revenue: 198000, expenses: 96000, profit: 102000 },
  { month: 'Jul', revenue: 215000, expenses: 102000, profit: 113000 },
  { month: 'Aug (MTD)', revenue: 173700, expenses: 88400, profit: 85300 }
];

export const SERVICE_BREAKDOWN_DATA = [
  { name: 'Full Body Repaint', value: 42, color: '#3b82f6' },
  { name: 'Vinyl Wraps & Liveries', value: 28, color: '#8b5cf6' },
  { name: 'Ceramic & Detailing', value: 16, color: '#10b981' },
  { name: 'Panel & Scratch Repair', value: 14, color: '#f59e0b' }
];

// ----------------------------------------------------
// MULTI-TENANT ORGANISATIONS (Maldives SMEs)
// ----------------------------------------------------
export const INITIAL_TENANTS: import('../types/erp').OrganisationTenant[] = [
  {
    id: 'tenant-starq',
    name: 'Starq Technologies',
    slug: 'starq-tech',
    legalName: 'Starq Technologies LLP',
    industry: 'Software & Engineering Services',
    currency: 'MVR',
    currencySymbol: 'Rf',
    tinNumber: '',
    gstStatus: 'not_registered',
    gstRate: 0,
    financialYearStart: '01-01',
    financialYearEnd: '12-31',
    phone: '+960 778-1234',
    email: 'accounts@starq.mv',
    address: 'H. Starq Tower, Level 4, Boduthakurufaanu Magu',
    island: "Male'",
    atoll: 'Kaafu Atoll',
    bmlAccount: '7730000100201 (BML MVR Corporate)',
    mibAccount: '9901001002011 (MIB Corporate Current)',
    logoIcon: 'Layers',
    logoUrl: '/starq-logo.png',
    themeColor: '#4f46e5',
    createdAt: '2024-01-01',
    outlets: [
      {
        id: 'out-starq-dyn',
        tenantId: 'tenant-starq',
        name: 'Starq Dynamics',
        code: 'DYN',
        tradingBrand: 'Starq Dynamics Engineering',
        island: "Male'",
        isPrimary: true,
      },
      {
        id: 'out-starq-acad',
        tenantId: 'tenant-starq',
        name: 'Starq Academy',
        code: 'ACAD',
        tradingBrand: 'Starq Academy Maldives',
        island: "Male'",
        isPrimary: false,
      },
    ],
    enabledModules: [
      'dashboard',
      'jobs',
      'invoices',
      'payments',
      'expenses',
      'inventory',
      'purchasing',
      'suppliers',
      'reports',
      'audit',
      'workflows',
      'roles',
      'users',
      'settings',
    ],
  },
  {
    id: 'tenant-ignition',
    name: 'Club Ignition Garage Pvt Ltd',
    slug: 'club-ignition',
    legalName: 'Club Ignition Garage Private Limited',
    industry: 'Automotive & Body Repair',
    currency: 'MVR',
    currencySymbol: 'Rf',
    tinNumber: '1004829GST001',
    gstStatus: 'registered',
    gstRate: 8,
    financialYearStart: '01-01',
    financialYearEnd: '12-31',
    phone: '+960 778-9900',
    email: 'accounts@ignitionink.mv',
    address: 'Lot 11492, Industrial Zone, Phase 2',
    island: "Hulhumale'",
    atoll: 'Kaafu Atoll',
    bmlAccount: '7730000189201 (BML MVR Main Account)',
    mibAccount: '9901004829101 (MIB MVR Current)',
    logoIcon: 'Flame',
    logoUrl: '/club-ignition-logo.png',
    themeColor: '#2563eb',
    createdAt: '2023-01-15',
    outlets: [
      {
        id: 'out-ign-ink',
        tenantId: 'tenant-ignition',
        name: 'Ignition Ink Garage',
        code: 'INK',
        tradingBrand: 'Ignition Ink Body & Wrap',
        island: "Hulhumale'",
        isPrimary: true,
      },
    ],
    enabledModules: [
      'dashboard',
      'jobs',
      'invoices',
      'payments',
      'expenses',
      'inventory',
      'purchasing',
      'suppliers',
      'reports',
      'audit',
      'workflows',
      'roles',
      'users',
      'settings',
    ],
  },
  {
    id: 'tenant-1',
    name: 'Ignition Ink Garage Pvt Ltd',
    slug: 'ignition-ink',
    legalName: 'Ignition Ink Garage Private Limited',
    industry: 'Automotive & Body Repair',
    currency: 'MVR',
    currencySymbol: 'Rf',
    tinNumber: '1004829GST001',
    gstStatus: 'registered',
    gstRate: 8,
    financialYearStart: '01-01',
    financialYearEnd: '12-31',
    phone: '+960 778-9900',
    email: 'accounts@ignitionink.mv',
    address: 'Lot 11492, Industrial Zone, Phase 2',
    island: "Hulhumale'",
    atoll: 'Kaafu Atoll',
    bmlAccount: '7730000189201 (BML MVR Main Account)',
    mibAccount: '9901004829101 (MIB MVR Current)',
    logoIcon: 'Flame',
    themeColor: '#2563eb',
    createdAt: '2023-01-15',
    outlets: [
      {
        id: 'out-ign-main',
        tenantId: 'tenant-1',
        name: 'Ignition Ink Garage',
        code: 'INK',
        tradingBrand: 'Ignition Ink Body & Wrap',
        island: "Hulhumale'",
        isPrimary: true,
      },
    ],
    enabledModules: [
      'dashboard',
      'jobs',
      'invoices',
      'payments',
      'expenses',
      'inventory',
      'purchasing',
      'suppliers',
      'reports',
      'audit',
      'workflows',
      'roles',
      'users',
      'settings',
    ],
  },
  {
    id: 'tenant-2',
    name: 'Alif Marine & Speedboat Yard',
    slug: 'alif-marine',
    legalName: 'Alif Marine Engineering Pvt Ltd',
    industry: 'Marine & Boatyard',
    currency: 'MVR',
    currencySymbol: 'Rf',
    tinNumber: '',
    gstStatus: 'not_registered',
    gstRate: 8,
    financialYearStart: '01-01',
    financialYearEnd: '12-31',
    phone: '+960 791-4455',
    email: 'dockmaster@alifmarine.mv',
    address: 'Plot 48, Maritime Slipway & Dry Dock',
    island: 'Thilafushi',
    atoll: 'Kaafu Atoll',
    bmlAccount: '7730000294811 (BML Corporate Marine)',
    mibAccount: '9901005829188 (MIB Business)',
    logoIcon: 'Ship',
    themeColor: '#0284c7',
    createdAt: '2023-06-10'
  },
  {
    id: 'tenant-3',
    name: 'Medilink Clinic & Diagnostic Centre',
    slug: 'medilink-clinic',
    legalName: 'Medilink Health Services LLP',
    industry: 'Medical Clinic & Diagnostics',
    currency: 'MVR',
    currencySymbol: 'Rf',
    tinNumber: '',
    gstStatus: 'not_registered',
    gstRate: 8,
    financialYearStart: '01-01',
    financialYearEnd: '12-31',
    phone: '+960 330-8800',
    email: 'admin@medilink.mv',
    address: 'H. Coral Haven, 2nd Floor, Sosun Magu',
    island: "Male'",
    atoll: 'Kaafu Atoll',
    bmlAccount: '7730000381920 (BML Healthcare Main)',
    logoIcon: 'Activity',
    themeColor: '#059669',
    createdAt: '2024-01-01'
  },
  {
    id: 'tenant-4',
    name: 'Horizon Hardware & Marine Supplies',
    slug: 'horizon-supplies',
    legalName: 'Horizon Wholesale & Trading Pvt Ltd',
    industry: 'Retail & Wholesale Trading',
    currency: 'MVR',
    currencySymbol: 'Rf',
    tinNumber: '',
    gstStatus: 'not_registered',
    gstRate: 8,
    financialYearStart: '01-01',
    financialYearEnd: '12-31',
    phone: '+960 334-1212',
    email: 'sales@horizonsupplies.mv',
    address: 'M. Silverline, Boduthakurufaanu Magu',
    island: "Male'",
    atoll: 'Kaafu Atoll',
    bmlAccount: '7730000492100 (BML Trading)',
    logoIcon: 'Boxes',
    themeColor: '#d97706',
    createdAt: '2024-03-20'
  }
];

// ----------------------------------------------------
// ROLES & GRANULAR PERMISSIONS MATRIX
// ----------------------------------------------------
export const INITIAL_ROLES: import('../types/erp').UserRole[] = [
  {
    id: 'role-superadmin',
    tenantId: 'tenant-1',
    name: 'Super Administrator',
    description: 'Complete unrestricted capabilities across all system modules, billing, settings, and user authorization.',
    color: 'purple',
    isSystemAdmin: true,
    permissions: {
      dashboard: ['view', 'export'],
      jobs: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
      invoices: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
      payments: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
      expenses: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
      inventory: ['view', 'create', 'edit', 'delete', 'manage', 'export'],
      purchasing: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
      suppliers: ['view', 'create', 'edit', 'delete', 'export'],
      reports: ['view', 'export'],
      audit: ['view', 'export'],
      workflows: ['view', 'edit', 'manage'],
      roles: ['view', 'create', 'edit', 'delete', 'manage'],
      users: ['view', 'create', 'edit', 'delete', 'approve', 'manage'],
      settings: ['view', 'edit', 'manage']
    }
  },
  {
    id: 'role-manager',
    tenantId: 'tenant-1',
    name: 'Workshop / Operations Manager',
    description: 'Supervises shop floor, approves estimates, assigns jobs, reviews stock, and manages staff.',
    color: 'blue',
    isSystemAdmin: false,
    permissions: {
      dashboard: ['view'],
      jobs: ['view', 'create', 'edit', 'approve', 'export'],
      invoices: ['view', 'create', 'approve'],
      payments: ['view'],
      expenses: ['view', 'create'],
      inventory: ['view', 'create', 'edit', 'manage'],
      purchasing: ['view', 'create', 'approve'],
      suppliers: ['view', 'create'],
      reports: ['view'],
      audit: ['view'],
      workflows: ['view', 'edit'],
      roles: ['view'],
      users: ['view', 'approve'],
      settings: ['view']
    }
  },
  {
    id: 'role-accountant',
    tenantId: 'tenant-1',
    name: 'Financial Controller / Accountant',
    description: 'Manages Tax Invoices, BML bank slip reconciliation, MIRA GST reporting, and vendor payouts.',
    color: 'emerald',
    isSystemAdmin: false,
    permissions: {
      dashboard: ['view', 'export'],
      jobs: ['view'],
      invoices: ['view', 'create', 'edit', 'approve', 'export'],
      payments: ['view', 'create', 'edit', 'approve', 'export'],
      expenses: ['view', 'create', 'edit', 'approve', 'export'],
      inventory: ['view'],
      purchasing: ['view', 'approve'],
      suppliers: ['view', 'create', 'edit'],
      reports: ['view', 'export'],
      audit: ['view', 'export'],
      workflows: ['view'],
      roles: ['view'],
      users: ['view'],
      settings: ['view']
    }
  },
  {
    id: 'role-lead-tech',
    tenantId: 'tenant-1',
    name: 'Lead Technician / Spray Specialist',
    description: 'Logs job progress, transitions pipeline stages, records paint and material usage, and inspects quality.',
    color: 'amber',
    isSystemAdmin: false,
    permissions: {
      dashboard: ['view'],
      jobs: ['view', 'edit'],
      invoices: [],
      payments: [],
      expenses: [],
      inventory: ['view', 'manage'],
      purchasing: ['view', 'create'],
      suppliers: [],
      reports: [],
      audit: [],
      workflows: ['view'],
      roles: [],
      users: [],
      settings: []
    }
  },
  {
    id: 'role-sales',
    tenantId: 'tenant-1',
    name: 'Service Advisor / Customer Front Desk',
    description: 'Intakes customers, books job estimates, issues receipts, and collects deposits.',
    color: 'rose',
    isSystemAdmin: false,
    permissions: {
      dashboard: ['view'],
      jobs: ['view', 'create', 'edit'],
      invoices: ['view', 'create'],
      payments: ['view', 'create'],
      expenses: [],
      inventory: ['view'],
      purchasing: [],
      suppliers: [],
      reports: [],
      audit: [],
      workflows: ['view'],
      roles: [],
      users: [],
      settings: []
    }
  },
  {
    id: 'role-apprentice',
    tenantId: 'tenant-1',
    name: 'Apprentice / Shop Assistant',
    description: 'Read-only access to assigned tasks, basic material requests.',
    color: 'slate',
    isSystemAdmin: false,
    permissions: {
      dashboard: ['view'],
      jobs: ['view'],
      invoices: [],
      payments: [],
      expenses: [],
      inventory: ['view'],
      purchasing: [],
      suppliers: [],
      reports: [],
      audit: [],
      workflows: [],
      roles: [],
      users: [],
      settings: []
    }
  }
];

// ----------------------------------------------------
// USERS & APPROVAL STATUSES
// ----------------------------------------------------
export const INITIAL_USERS: import('../types/erp').AppUser[] = [
  {
    id: 'user-1',
    tenantId: 'tenant-1',
    name: 'Ali Musthaq',
    email: 'a.musthaq@gmail.com',
    phone: '+960 778-9900',
    roleId: 'role-superadmin',
    roleName: 'Super Administrator',
    status: 'Active',
    invitedAt: '2023-01-15 09:00',
    authorizedBy: 'System Bootstrapper',
    authorizedAt: '2023-01-15 09:00',
    lastActiveAt: 'Just now',
    jobTitle: 'Managing Director & Founder',
    mfaEnabled: true,
    mfaRequired: true,
    mfaEnrolledAt: '2026-08-01 10:00',
    mfaSecret: 'JBSWY3DPEHPK3PXP',
    recoveryCodes: ['REC1-9921', 'REC2-4412', 'REC3-8871', 'REC4-3319', 'REC5-7762', 'REC6-1184', 'REC7-5509', 'REC8-2234']
  },
  {
    id: 'user-2',
    tenantId: 'tenant-1',
    name: 'Aishath Niuma',
    email: 'niuma.acc@ignitionink.mv',
    phone: '+960 790-2211',
    roleId: 'role-accountant',
    roleName: 'Financial Controller / Accountant',
    status: 'Active',
    invitedAt: '2023-03-01 10:30',
    authorizedBy: 'Ali Musthaq',
    authorizedAt: '2023-03-01 11:00',
    lastActiveAt: '12 mins ago',
    jobTitle: 'Senior Chief Accountant',
    mfaEnabled: false,
    mfaRequired: false
  },
  {
    id: 'user-3',
    tenantId: 'tenant-1',
    name: 'Ahsan "Acko"',
    email: 'acko.painter@ignitionink.mv',
    phone: '+960 766-3344',
    roleId: 'role-lead-tech',
    roleName: 'Lead Technician / Spray Specialist',
    status: 'Active',
    invitedAt: '2023-02-10 14:00',
    authorizedBy: 'Ali Musthaq',
    authorizedAt: '2023-02-10 14:15',
    lastActiveAt: '35 mins ago',
    jobTitle: 'Master Paint & Wrap Technician'
  },
  {
    id: 'user-4',
    tenantId: 'tenant-1',
    name: 'Moosa Latheef',
    email: 'moosa.ops@ignitionink.mv',
    phone: '+960 772-5500',
    roleId: 'role-manager',
    roleName: 'Workshop / Operations Manager',
    status: 'Active',
    invitedAt: '2023-02-01 08:30',
    authorizedBy: 'Ali Musthaq',
    authorizedAt: '2023-02-01 08:45',
    lastActiveAt: '1 hour ago',
    jobTitle: 'Operations & Bay Floor Lead'
  },
  {
    id: 'user-5',
    tenantId: 'tenant-1',
    name: 'Ibrahim Nabeel',
    email: 'nabeel.frontdesk@ignitionink.mv',
    phone: '+960 744-8899',
    roleId: 'role-sales',
    roleName: 'Service Advisor / Customer Front Desk',
    status: 'Active',
    invitedAt: '2024-01-10 09:30',
    authorizedBy: 'Moosa Latheef',
    authorizedAt: '2024-01-10 10:00',
    lastActiveAt: '2 hours ago',
    jobTitle: 'Customer Relationship Lead'
  },
  {
    id: 'user-6',
    tenantId: 'tenant-1',
    name: 'Mohamed Ziyan',
    email: 'ziyan.auto@gmail.com',
    phone: '+960 788-1234',
    roleId: 'role-lead-tech',
    roleName: 'Lead Technician / Spray Specialist',
    status: 'Pending Approval',
    invitedAt: '2026-08-20 16:45',
    lastActiveAt: 'Logged in (Awaiting Authorization)',
    jobTitle: 'Ceramic Coating Specialist (New Hire)'
  },
  {
    id: 'user-7',
    tenantId: 'tenant-1',
    name: 'Mariyam Shifa',
    email: 'shifa.m@gmail.com',
    phone: '+960 799-5566',
    roleId: 'role-sales',
    roleName: 'Service Advisor / Customer Front Desk',
    status: 'Pending Approval',
    invitedAt: '2026-08-21 11:20',
    lastActiveAt: 'Invited via Email Link',
    jobTitle: 'Front Desk Assistant'
  },
  {
    id: 'user-8',
    tenantId: 'tenant-1',
    name: 'Hassan Jinah',
    email: 'jinah.old@gmail.com',
    phone: '+960 733-4411',
    roleId: 'role-apprentice',
    roleName: 'Apprentice / Shop Assistant',
    status: 'Suspended',
    invitedAt: '2024-04-12 10:00',
    authorizedBy: 'Ali Musthaq',
    authorizedAt: '2024-04-12 10:30',
    lastActiveAt: 'Suspended on 2026-07-30',
    jobTitle: 'Former Workshop Trainee'
  }
];

// ----------------------------------------------------
// CONFIGURABLE WORKFLOW PIPELINE STAGES
// ----------------------------------------------------
export const INITIAL_WORKFLOW_STAGES: import('../types/erp').WorkflowStage[] = [
  {
    id: 'stage-1',
    tenantId: 'tenant-1',
    name: 'Check-in & Inspection',
    code: 'CHECK_IN',
    description: 'Vehicle received at bay, photos logged, 8-point body damage & intake checklist confirmed with client.',
    color: 'blue',
    order: 1,
    allowedRoleIds: ['role-superadmin', 'role-manager', 'role-sales'],
    slaHours: 4,
    requiresChecklist: true,
    checklistItems: [
      '1. Vehicle registration & plate number match',
      '2. Odometer reading & fuel level recorded',
      '3. 360-degree walkaround damage photos captured',
      '4. Customer personal belongings cleared',
      '5. Existing dents, chips & panel scratches documented',
      '6. Tyre condition & wheel rim check',
      '7. Quoted repair scope & paint code verified',
      '8. Customer intake authorization & consent signed'
    ],
    isInitial: true
  },
  {
    id: 'stage-2',
    tenantId: 'tenant-1',
    name: 'Surface Prep & Sanding',
    code: 'SURFACE_PREP',
    description: 'Disassembly of trims, body filler curing, guide coat sanding, and primer surfacer application.',
    color: 'amber',
    order: 2,
    allowedRoleIds: ['role-superadmin', 'role-manager', 'role-lead-tech'],
    slaHours: 24,
    requiresNotes: true
  },
  {
    id: 'stage-3',
    tenantId: 'tenant-1',
    name: 'Spray Booth / Wrap Studio',
    code: 'PAINT_BOOTH',
    description: 'Masking, basecoat mixing with spectrometer, 2K clearcoat application, and 60°C infrared bake cycle.',
    color: 'purple',
    order: 3,
    allowedRoleIds: ['role-superadmin', 'role-lead-tech', 'role-manager'],
    slaHours: 36,
    requiresNotes: true
  },
  {
    id: 'stage-4',
    tenantId: 'tenant-1',
    name: 'Detailing, QC & Assembly',
    code: 'QC_DETAIL',
    description: 'Denibbing, compound cut & polish, trim reassembly, electronics diagnostics, and 6-point final QC sign-off.',
    color: 'cyan',
    order: 4,
    allowedRoleIds: ['role-superadmin', 'role-manager', 'role-lead-tech'],
    slaHours: 12,
    requiresChecklist: true,
    checklistItems: [
      '1. Paint film thickness & shade match verified',
      '2. Panel gap alignment & trim reassembly confirmed',
      '3. Clearcoat gloss, curing & orange-peel inspection passed',
      '4. Electrical, lighting & dash diagnostics checked',
      '5. Interior vacuumed, windows cleaned & vehicle sanitized',
      '6. Final road test & QC inspector sign-off'
    ]
  },
  {
    id: 'stage-5',
    tenantId: 'tenant-1',
    name: 'Ready for Customer Delivery',
    code: 'READY_DELIVERY',
    description: 'Quality manager passed inspection. SMS/WhatsApp notification dispatched to vehicle owner.',
    color: 'emerald',
    order: 5,
    allowedRoleIds: ['role-superadmin', 'role-manager', 'role-sales'],
    slaHours: 6,
    isCompletedStage: true
  },
  {
    id: 'stage-6',
    tenantId: 'tenant-1',
    name: 'Tax Invoiced & Settled',
    code: 'INVOICED_SETTLED',
    description: 'Official MIRA Tax Invoice issued, deposit reconciled, and final balance settled via BML or cash.',
    color: 'slate',
    order: 6,
    allowedRoleIds: ['role-superadmin', 'role-accountant'],
    slaHours: 2,
    isBillingStage: true
  }
];

// Presets for other industries
export const CLINIC_WORKFLOW_PRESET: Omit<import('../types/erp').WorkflowStage, 'id' | 'tenantId'>[] = [
  {
    name: 'Patient Triage & Registration',
    code: 'TRIAGE',
    description: 'Vitals logged, national ID/Passport verified, primary symptom triage.',
    color: 'blue',
    order: 1,
    allowedRoleIds: ['role-superadmin', 'role-sales'],
    slaHours: 1,
    isInitial: true
  },
  {
    name: 'Doctor Consultation',
    code: 'CONSULT',
    description: 'Physician physical examination, prescription notes and diagnosis entry.',
    color: 'purple',
    order: 2,
    allowedRoleIds: ['role-superadmin', 'role-lead-tech'],
    slaHours: 1
  },
  {
    name: 'Diagnostic Lab / X-Ray',
    code: 'LAB_WORK',
    description: 'Sample collection, blood analysis or imaging diagnostics.',
    color: 'amber',
    order: 3,
    allowedRoleIds: ['role-superadmin', 'role-lead-tech'],
    slaHours: 4
  },
  {
    name: 'Pharmacy & Billing',
    code: 'PHARMACY_BILL',
    description: 'Medication dispensing, Aasandha / Allied insurance verification and tax invoice.',
    color: 'emerald',
    order: 4,
    allowedRoleIds: ['role-superadmin', 'role-accountant'],
    slaHours: 1,
    isBillingStage: true
  },
  {
    name: 'Discharged / Follow-up Scheduled',
    code: 'DISCHARGED',
    description: 'Patient discharged with follow-up booking in 7 days.',
    color: 'slate',
    order: 5,
    allowedRoleIds: ['role-superadmin', 'role-manager'],
    slaHours: 1,
    isCompletedStage: true
  }
];

export const BOATYARD_WORKFLOW_PRESET: Omit<import('../types/erp').WorkflowStage, 'id' | 'tenantId'>[] = [
  {
    name: 'Slipway Hoisting & Drydock Entry',
    code: 'SLIPWAY_HOIST',
    description: 'Vessel safely hauled up on marine rails, keel blocks placed.',
    color: 'blue',
    order: 1,
    allowedRoleIds: ['role-superadmin', 'role-manager'],
    slaHours: 6,
    isInitial: true
  },
  {
    name: 'Hull Pressure Wash & Hydroblasting',
    code: 'HULL_WASH',
    description: 'Barnacle removal, anti-fouling strip, and hull osmosis moisture check.',
    color: 'cyan',
    order: 2,
    allowedRoleIds: ['role-superadmin', 'role-lead-tech'],
    slaHours: 18
  },
  {
    name: 'Fiberglass Layup & Gelcoat Refit',
    code: 'FIBERGLASS_REFIT',
    description: 'Structural repairs, epoxy resin infusion, and polyurethane marine paint coating.',
    color: 'purple',
    order: 3,
    allowedRoleIds: ['role-superadmin', 'role-lead-tech'],
    slaHours: 48
  },
  {
    name: 'Engine Shaft Alignment & Sea Trial',
    code: 'SEA_TRIAL',
    description: 'Outboard mount torqued, harbor sea trial at full knot speed.',
    color: 'emerald',
    order: 4,
    allowedRoleIds: ['role-superadmin', 'role-lead-tech', 'role-manager'],
    slaHours: 12,
    isCompletedStage: true
  },
  {
    name: 'Marine Port Clearance & Invoiced',
    code: 'PORT_CLEARANCE',
    description: 'Transport Authority seaworthiness pass and tax billing clearance.',
    color: 'slate',
    order: 5,
    allowedRoleIds: ['role-superadmin', 'role-accountant'],
    slaHours: 4,
    isBillingStage: true
  }
];

// ----------------------------------------------------
// ACTIVITY & AUDIT TRAIL LOGS (The Owner's Evidence)
// Fabricated seed data removed — real audit events come from backend audit_events table.
// ----------------------------------------------------
export const INITIAL_AUDIT_LOGS: import('../types/erp').AuditLogEntry[] = [];
