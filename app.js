const STORAGE_KEY = "chemLabInventory.v1";

const seedItems = [
  {
    id: "CL-1001",
    name: "Sodium Chloride",
    cas: "7647-14-5",
    category: "Chemical",
    hazard: "Low",
    quantity: 3,
    unit: "500 g bottles",
    cabinet: "A-01",
    shelf: "Shelf 2",
    expiry: "2027-02-14",
    notes: "General reagent stock.",
    createdAt: "2026-04-28",
  },
  {
    id: "CL-1002",
    name: "Hydrochloric Acid",
    cas: "7647-01-0",
    category: "Chemical",
    hazard: "High",
    quantity: 1,
    unit: "1 L bottle",
    cabinet: "B-02",
    shelf: "Shelf 1",
    expiry: "2026-06-16",
    notes: "Corrosive. Store in acid cabinet.",
    createdAt: "2026-04-30",
  },
  {
    id: "CL-1003",
    name: "Nitrile Gloves",
    cas: "PPE-442",
    category: "Material",
    hazard: "None",
    quantity: 8,
    unit: "boxes",
    cabinet: "D-01",
    shelf: "Shelf 3",
    expiry: "",
    notes: "Medium and large sizes.",
    createdAt: "2026-05-02",
  },
  {
    id: "CL-1004",
    name: "Silver Nitrate",
    cas: "7761-88-8",
    category: "Chemical",
    hazard: "Critical",
    quantity: 0.2,
    unit: "100 g bottle",
    cabinet: "C-03",
    shelf: "Shelf 4",
    expiry: "2026-05-20",
    notes: "Light-sensitive oxidizer.",
    createdAt: "2026-05-04",
  },
  {
    id: "CL-1005",
    name: "Digital Balance",
    cas: "EQ-210",
    category: "Equipment",
    hazard: "None",
    quantity: 2,
    unit: "units",
    cabinet: "E-01",
    shelf: "Shelf 1",
    expiry: "",
    notes: "Calibration due quarterly.",
    createdAt: "2026-05-05",
  },
];

let items = loadItems();
let activeCabinetGroup = "A";
let activeCabinet = "A-01";
let activeShelf = "Shelf 1";
let parsedRows = [];
let selectedItemId = items[0]?.id || "";

const shelfCountsByGroup = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
};

const cabinetGroups = Object.keys(shelfCountsByGroup);
const cabinetCountsByGroup = {
  A: 4,
  B: 15,
  C: 2,
  D: 6,
  E: 8,
};

const MEASUREMENT_UNIT_WORDS = "uL|µL|microliters?|mL|ml|ML|milliliters?|L|l|liters?|mg|milligrams?|g|grams?|kg|kilograms?";
const COUNT_UNIT_WORDS =
  "bottles?|boxes?|packs?|packets?|units?|pcs|pieces?|vials?|jars?|bags?|flasks?|beakers?|tubes?|test\\s*tubes?|containers?|cans?|drums?|racks?|trays?|rolls?|cases?|cartons?|syringes?|pipettes?";
const DEFAULT_IMPORT_SHELF_CAPACITY = 10;
const CATEGORY_STORAGE_GROUPS = {
  Chemical: "E",
  Equipment: "D",
  Material: "B",
  Other: "A",
};

const views = document.querySelectorAll(".view");
const tabs = document.querySelectorAll(".tab");
const itemDialog = document.querySelector("#itemDialog");
const itemForm = document.querySelector("#itemForm");

function normalizeItemRecord(item = {}, index = 0) {
  const quantity = Number(item.quantity);
  const category = ["Chemical", "Equipment", "Material", "Other"].includes(item.category) ? item.category : "Chemical";
  const hazard = ["None", "Low", "Moderate", "High", "Critical"].includes(item.hazard) ? item.hazard : "Low";

  return {
    ...item,
    id: String(item.id || `CL-${Date.now()}-${index}`),
    name: String(item.name || "Imported Item"),
    cas: String(item.cas || ""),
    category,
    hazard,
    quantity: Number.isFinite(quantity) ? quantity : 1,
    unit: String(item.unit || "unit"),
    packageSize: item.packageSize ? String(item.packageSize) : "",
    concentration: String(item.concentration || ""),
    cabinet: String(item.cabinet || ""),
    shelf: String(item.shelf || ""),
    expiry: String(item.expiry || ""),
    notes: String(item.notes || ""),
    msdsSummary: String(item.msdsSummary || ""),
    createdAt: String(item.createdAt || new Date().toISOString().slice(0, 10)),
  };
}

function loadItems() {
  const stored = localStorage.getItem(STORAGE_KEY);
  try {
    const loadedItems = stored ? JSON.parse(stored) : seedItems;
    if (!Array.isArray(loadedItems)) return seedItems.map(normalizeItemRecord);
    return loadedItems.map(normalizeItemRecord);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return seedItems.map(normalizeItemRecord);
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(normalizeItemRecord)));
}

function showView(viewId) {
  views.forEach((view) => view.classList.toggle("is-visible", view.id === viewId));
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewId));
  renderAll();
}

function isExpiringSoon(item) {
  if (!item.expiry) return false;
  const days = (new Date(item.expiry) - new Date()) / 86400000;
  return days <= 60;
}

function isLowStock(item) {
  return Number(item.quantity) <= 1;
}

function hazardClass(hazard) {
  return String(hazard || "Low").toLowerCase();
}

function itemLocation(item) {
  return `${item.cabinet || "Unassigned"} · ${item.shelf || "No shelf"}`;
}

function quantityMeta(item) {
  const unitText = item.unit || "unit";

  return {
    quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
    unit: unitText,
    packageSize: item.packageSize || "",
    concentration: item.concentration || "",
  };
}

function quantityUnitBlock(item) {
  const meta = quantityMeta(item);

  return `
    <div class="quantity-unit">
      <span><strong>Quantity</strong>${meta.quantity}</span>
      <span><strong>Unit</strong>${meta.unit}</span>
      ${meta.packageSize ? `<span><strong>Size / Type</strong>${meta.packageSize}</span>` : ""}
    </div>
  `;
}

function generatedImportLocation(index, preferredGroup = "") {
  const groups = Object.entries(shelfCountsByGroup)
    .filter(([, shelfCount]) => shelfCount > 0)
    .map(([group]) => group);
  const group = groups.includes(preferredGroup) ? preferredGroup : groups[index % groups.length] || "B";
  const cabinetNumber = (Math.floor(index / Math.max(1, shelfCountsByGroup[group])) % cabinetCountsByGroup[group]) + 1;
  const shelfNumber = (index % shelfCountsByGroup[group]) + 1;

  return {
    cabinet: `${group}-${String(cabinetNumber).padStart(2, "0")}`,
    shelf: `Shelf ${shelfNumber}`,
  };
}

function appendNote(notes, addition) {
  const currentNotes = String(notes || "").trim();
  const nextNote = String(addition || "").trim();
  if (!nextNote || currentNotes.includes(nextNote)) return currentNotes;
  return [currentNotes, nextNote].filter(Boolean).join(" ");
}

function storageGroupForCategory(category) {
  const normalizedCategory = normalizeCategoryValue(category, category);
  return CATEGORY_STORAGE_GROUPS[normalizedCategory] || "A";
}

function autoLocationForGroup(group, usedSpace = 0) {
  const shelfCount = Math.max(1, shelfCountsByGroup[group] || 1);
  const cabinetCount = Math.max(1, cabinetCountsByGroup[group] || 1);
  const shelfSlot = Math.floor(Math.max(0, usedSpace) / DEFAULT_IMPORT_SHELF_CAPACITY);
  const cabinetNumber = clamp(Math.floor(shelfSlot / shelfCount) + 1, 1, cabinetCount);
  const shelfNumber = clamp((shelfSlot % shelfCount) + 1, 1, shelfCount);
  const overflowed = shelfSlot >= cabinetCount * shelfCount;

  return {
    cabinet: cabinetCode(group, cabinetNumber),
    shelf: `Shelf ${shelfNumber}`,
    overflowed,
  };
}

function parseGroupContext(text) {
  const groupMatch = text.match(/\b(?:these\s+are\s+from\s+)?group\s*([A-E])\b/i);
  return groupMatch?.[1]?.toUpperCase() || "";
}

function isGroupContextLine(line) {
  return /^\s*(?:these\s+are\s+from\s+)?group\s*[A-E]\s*:?\.?\s*$/i.test(line);
}

function cabinetOptions() {
  return cabinetGroups.flatMap((group) =>
    Array.from({ length: cabinetCountsByGroup[group] }, (_, index) => `${group}-${String(index + 1).padStart(2, "0")}`),
  );
}

function shelvesForCabinet(cabinet) {
  const group = cabinet?.charAt(0)?.toUpperCase();
  const shelfCount = shelfCountsByGroup[group] || 0;
  return Array.from({ length: shelfCount }, (_, index) => `Shelf ${index + 1}`);
}

function firstVisibleCabinet() {
  const group = cabinetGroups.find((candidate) => shelfCountsByGroup[candidate] > 0) || "B";
  return `${group}-01`;
}

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function parseCabinetLocation(text) {
  const cabinetMatch =
    text.match(/cabinet\s*([A-E])(?:\s*[-#]?\s*(\d{1,2}))?/i) ||
    text.match(/\b([A-E])\s*[-#]\s*(\d{1,2})\b/i) ||
    text.match(/\b([A-E])\b(?=.*\bshelf\b)/i);
  const shelfMatch = text.match(/shelf\s*[-#]?\s*(\d{1,2})/i);

  return {
    cabinetGroup: cabinetMatch?.[1]?.toUpperCase() || "",
    cabinetNumber: Number(cabinetMatch?.[2]) || 1,
    shelfNumber: Number(shelfMatch?.[1]) || 1,
  };
}

function cabinetCode(group, cabinetNumber) {
  return `${group}-${String(cabinetNumber).padStart(2, "0")}`;
}

function parseCabinetRange(text, fallbackGroup = "") {
  const compactRange =
    text.match(/\b([A-E])\s*[-#]\s*(\d{1,2})\s*(?:to|through|thru|until|[-–—])\s*(?:[A-E]\s*[-#]\s*)?(\d{1,2})\b/i) ||
    text.match(/\bcabinet\s*([A-E])\s*[-#]?\s*(\d{1,2})\s*(?:to|through|thru|until|[-–—])\s*(?:cabinet\s*)?(?:[A-E]\s*[-#]?\s*)?(\d{1,2})\b/i);

  if (compactRange) {
    const start = Number(compactRange[2]);
    const end = Number(compactRange[3]);

    return {
      group: compactRange[1].toUpperCase(),
      start: Math.min(start, end),
      end: Math.max(start, end),
    };
  }

  const startOnly = text.match(/\b([A-E])\s*[-#]\s*(\d{1,2})\b/i);
  if (startOnly) {
    return {
      group: startOnly[1].toUpperCase(),
      start: Number(startOnly[2]),
      end: Number(startOnly[2]),
    };
  }

  return {
    group: fallbackGroup,
    start: 1,
    end: fallbackGroup ? cabinetCountsByGroup[fallbackGroup] : 1,
  };
}

function parseStartingShelf(text) {
  const startMatch = text.match(/\bstart(?:ing)?(?:\s+from)?\s*(?:cabinet\s*)?[A-E]\s*[-#]?\s*\d{1,2}\s*shelf\s*[-#]?\s*(\d{1,2})\b/i);
  return startMatch ? Number(startMatch[1]) : 1;
}

function parseShelfCapacity(text) {
  const eachShelfMatch =
    text.match(/\beach\s+shelf\b[^\d]{0,40}(\d{1,3})\s*(?:spots?|items?|things?)?/i) ||
    text.match(/\b(\d{1,3})\s*(?:spots?|items?|things?)\s*(?:per|each|on|in)?\s*(?:each\s+)?shelf\b/i);

  return eachShelfMatch ? Number(eachShelfMatch[1]) : 10;
}

function parsePlacementInstruction(text, order = 0) {
  const location = parseCabinetLocation(text);
  const groupContext = parseGroupContext(text);
  const group = location.cabinetGroup || groupContext;
  const instructionIntent = /\b(sort|soprt|only|spots?|starting|start|each\s+shelf|organize|organise|place)\b/i.test(text);
  const alphabetical = /\b(alpha|alphabet|alpheb|letter\s*A\s+first)\b/i.test(text);

  if (!group || !instructionIntent) return null;

  const range = parseCabinetRange(text, group);
  const startCabinet = clamp(range.start || location.cabinetNumber || 1, 1, cabinetCountsByGroup[group]);
  const endCabinet = clamp(range.end || cabinetCountsByGroup[group], startCabinet, cabinetCountsByGroup[group]);

  return {
    id: `placement-${order}`,
    order,
    group,
    startCabinet,
    endCabinet,
    startShelf: clamp(parseStartingShelf(text), 1, shelfCountsByGroup[group] || 1),
    shelfCapacity: Math.max(1, parseShelfCapacity(text)),
    sortAlphabetically: alphabetical || /\b(sort|soprt)\b/i.test(text),
  };
}

function placementSlots(rule) {
  const slots = [];
  const shelfCount = shelfCountsByGroup[rule.group] || 0;

  for (let cabinetNumber = rule.startCabinet; cabinetNumber <= rule.endCabinet; cabinetNumber += 1) {
    for (let shelfNumber = 1; shelfNumber <= shelfCount; shelfNumber += 1) {
      if (cabinetNumber === rule.startCabinet && shelfNumber < rule.startShelf) continue;
      slots.push({
        cabinet: cabinetCode(rule.group, cabinetNumber),
        shelf: `Shelf ${shelfNumber}`,
      });
    }
  }

  return slots;
}

function shelfSpaceCount(item) {
  const quantity = Number(item.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  return Math.max(1, Math.ceil(quantity));
}

function applyPlacementRules(rows, rules) {
  rules.forEach((rule) => {
    const slots = placementSlots(rule);
    if (slots.length === 0) return;

    const ruleRows = rows.filter((item) => item.placementRuleId === rule.id);
    const orderedRows = [...ruleRows].sort((a, b) => {
      if (rule.sortAlphabetically) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
      }

      return a.sourceIndex - b.sourceIndex;
    });

    let slotIndex = 0;
    let usedSpace = 0;

    orderedRows.forEach((item, index) => {
      const spaceCount = shelfSpaceCount(item);
      if (usedSpace > 0 && usedSpace + spaceCount > rule.shelfCapacity) {
        slotIndex += 1;
        usedSpace = 0;
      }

      const overflowed = slotIndex >= slots.length;
      const slot = slots[Math.min(slotIndex, slots.length - 1)];
      const overflowNote = overflowed ? " Placement capacity exceeded; placed in the last allowed shelf." : "";
      item.cabinet = slot.cabinet;
      item.shelf = slot.shelf;
      item.placementSortIndex = rule.order * 100000 + index;
      item.notes = `${item.notes || ""} Sorted by cabinet instruction.${overflowNote}`.trim();

      if (!overflowed) {
        usedSpace += spaceCount;
      }
    });
  });

  return rows;
}

function normalizeVisibleShelfLocation(item, index = 0, options = {}) {
  const typedLocation = parseCabinetLocation(`${item.cabinet || ""} ${item.shelf || ""}`);
  const group = typedLocation.cabinetGroup;
  const shelfCount = shelfCountsByGroup[group] || 0;

  if (group && shelfCount > 0) {
    const cabinetNumber = clamp(typedLocation.cabinetNumber, 1, cabinetCountsByGroup[group]);
    const shelfNumber = clamp(typedLocation.shelfNumber, 1, shelfCount);
    const adjusted = cabinetNumber !== typedLocation.cabinetNumber || shelfNumber !== typedLocation.shelfNumber;

    return {
      ...item,
      cabinet: `${group}-${String(cabinetNumber).padStart(2, "0")}`,
      shelf: `Shelf ${shelfNumber}`,
      notes:
        adjusted && options.noteAdjustments
          ? `${item.notes || ""} Location adjusted to the nearest visible shelf.`.trim()
          : item.notes,
    };
  }

  return {
    ...item,
    ...generatedImportLocation(index, options.preferredGroup),
    notes: options.noteAdjustments
      ? `${item.notes || ""} Auto-placed into a visible cabinet shelf.`.trim()
      : item.notes,
  };
}

function shouldAutoOrganizeImportItem(item) {
  if (item.category === "Chemical") return true;
  if (item.placementRuleId) return false;
  return !item.importHadDirectLocation;
}

function applyDefaultImportOrganization(rows) {
  const usedSpaceByGroup = {};
  const rowsToOrganize = rows
    .filter(shouldAutoOrganizeImportItem)
    .sort((a, b) => {
      const groupSort = storageGroupForCategory(a.category).localeCompare(storageGroupForCategory(b.category));
      if (groupSort !== 0) return groupSort;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    });

  rowsToOrganize.forEach((item) => {
    const group = storageGroupForCategory(item.category);
    const location = autoLocationForGroup(group, usedSpaceByGroup[group] || 0);
    const categoryNote =
      item.category === "Chemical"
        ? "Auto-sorted into Cabinet E for chemical storage."
        : `Auto-sorted into Cabinet ${group} for ${item.category.toLowerCase()} organization.`;

    item.cabinet = location.cabinet;
    item.shelf = location.shelf;
    item.notes = appendNote(item.notes, categoryNote);
    if (location.overflowed) {
      item.notes = appendNote(item.notes, "Default storage capacity exceeded; placed in the last available shelf for that group.");
    }
    usedSpaceByGroup[group] = (usedSpaceByGroup[group] || 0) + shelfSpaceCount(item);
  });

  return rows.map((item, index) =>
    normalizeVisibleShelfLocation(item, index, { noteAdjustments: true, preferredGroup: storageGroupForCategory(item.category) }),
  );
}

function stripLocationText(text) {
  return text
    .replace(/(?:these\s+are\s+from\s+)?group\s*[A-E]\s*:?/gi, "")
    .replace(/(?:(?:these\s+are\s+)?from\s+)?cabinet\s*[A-E](?:\s*[-#]?\s*\d{1,2})?/gi, "")
    .replace(/\b[A-E]\s*[-#]\s*\d{1,2}\b/gi, "")
    .replace(/shelf\s*[-#]?\s*\d{1,2}/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripListNumber(text) {
  return text.replace(/^\s*\d+(?:\.\d+)?\s*[\).:-]\s*/, "").trim();
}

function listNumberFromLine(line) {
  const match = line.match(/^\s*(\d+(?:\.\d+)?)\s*[\).:-]\s+/);
  return match ? Number(match[1]) : null;
}

function isLocationContextLine(line) {
  const stripped = stripLocationText(line).replace(/[:.\-\s]/g, "");
  return stripped === "" && /\b(group|cabinet|shelf|[A-E]\s*[-#]\s*\d{1,2})\b/i.test(line);
}

function leadingQuantity(text) {
  const match = text.match(new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s+(?!(?:${MEASUREMENT_UNIT_WORDS}|${COUNT_UNIT_WORDS})\\b)(?=[A-Za-z])`, "i"));
  return match ? Number(match[1]) : null;
}

function dashQuantityFromText(text) {
  const contextFreeText = stripLocationText(stripListNumber(text));
  const match = contextFreeText.match(
    new RegExp(
      `(?:^|\\s)[-–—]\\s*(\\d+(?:\\.\\d+)?)(?:\\s+(${COUNT_UNIT_WORDS}))?(?=\\s*(?:[,;]|$|\\bcabinet\\b|\\bshelf\\b|\\bgroup\\b|\\bhazard\\b|\\brisk\\b|\\bcategory\\b|\\btype\\b|\\bexp))`,
      "i",
    ),
  );

  if (!match) return null;

  return {
    quantity: Number(match[1]),
    unit: match[2] ? normalizeUnitText(match[2]) : "",
  };
}

function singularUnit(unit) {
  const replacements = {
    bottles: "bottle",
    boxes: "box",
    packs: "pack",
    packets: "packet",
    units: "unit",
    pcs: "piece",
    pieces: "piece",
    vials: "vial",
    jars: "jar",
    bags: "bag",
    flasks: "flask",
    beakers: "beaker",
    tubes: "tube",
    containers: "container",
    cans: "can",
    drums: "drum",
    racks: "rack",
    trays: "tray",
    rolls: "roll",
    cases: "case",
    cartons: "carton",
    syringes: "syringe",
    pipettes: "pipette",
  };

  return String(unit || "unit").replace(/\b[A-Za-z]+\b/g, (word) => replacements[word.toLowerCase()] || word);
}

function normalizeUnitText(unit) {
  const normalized = {
    ul: "uL",
    µl: "µL",
    microliter: "uL",
    microliters: "uL",
    ml: "mL",
    milliliter: "mL",
    milliliters: "mL",
    l: "L",
    liter: "L",
    liters: "L",
    mg: "mg",
    milligram: "mg",
    milligrams: "mg",
    g: "g",
    gram: "g",
    grams: "g",
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
  };

  return normalized[unit.toLowerCase()] || unit;
}

function quantityUnitFromText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { quantity: null, unit: "" };

  const countMatch = trimmed.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(${COUNT_UNIT_WORDS})$`, "i"));
  if (countMatch) {
    return {
      quantity: Number(countMatch[1]),
      unit: normalizeUnitText(countMatch[2]),
    };
  }

  const measurementMatch = trimmed.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${MEASUREMENT_UNIT_WORDS})$`, "i"));
  if (measurementMatch) {
    return {
      quantity: 1,
      unit: `${measurementMatch[1]} ${normalizeUnitText(measurementMatch[2])}`,
    };
  }

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return {
      quantity: Number(trimmed),
      unit: "",
    };
  }

  return {
    quantity: null,
    unit: trimmed,
  };
}

function parseHazard(line) {
  const text = line.toLowerCase();
  if (/\b(critical|cyanide|peroxide|pyrophoric|explosive|carcinogen|radioactive)\b/.test(text)) return "Critical";
  if (/\b(high|toxic|corrosive|flammable|oxidizer|oxidiser|acid|base|poison)\b/.test(text)) return "High";
  if (/\b(moderate|irritant|warning|harmful)\b/.test(text)) return "Moderate";
  if (/\b(low)\b/.test(text)) return "Low";
  if (/\b(none|non[-\s]?hazardous|safe)\b/.test(text)) return "None";
  return "";
}

function parseCategory(line) {
  const structuredCategory = normalizeCategoryValue(line);
  if (structuredCategory) return structuredCategory;

  const text = line.toLowerCase();
  if (/\b(balance|meter|microscope|centrifuge|hotplate|probe|sensor|equipment|instrument)\b/.test(text)) return "Equipment";
  if (/\b(gloves?|tips?|paper|filter|ppe|mask|tubes?|plates?|material|supplies)\b/.test(text)) return "Material";
  if (/\b(other|misc)\b/.test(text)) return "Other";
  return "Chemical";
}

function normalizeCategoryValue(value, fallback = "") {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return fallback;
  if (/\bchemical|reagent|solution|acid|base\b/.test(text)) return "Chemical";
  if (/\bequipment|instrument|device|machine|apparatus|balance|meter|microscope|centrifuge|hotplate\b/.test(text)) return "Equipment";
  if (/\bmaterial|supply|supplies|ppe|consumable|glassware\b/.test(text)) return "Material";
  if (/\bother|misc|miscellaneous\b/.test(text)) return "Other";
  return fallback;
}

function parseDelimitedCells(line) {
  const delimiter = line.includes("\t") ? "\t" : line.includes("|") ? "|" : line.includes(",") ? "," : "";
  if (!delimiter) return [line.trim()];

  const cells = [];
  let cell = "";
  let quoted = false;

  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += character;
  }

  cells.push(cell.trim());
  return cells;
}

function normalizedImportHeader(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function importFieldForHeader(header) {
  const normalized = normalizedImportHeader(header);
  const fields = {
    chemicalid: "cas",
    chemid: "cas",
    equipmentid: "cas",
    equipid: "cas",
    equipmentcode: "cas",
    equipmentassetid: "cas",
    id: "cas",
    chemicalcode: "cas",
    assetcode: "cas",
    cas: "cas",
    casnumber: "cas",
    chemicalname: "name",
    chemname: "name",
    equipmentname: "name",
    equipname: "name",
    name: "name",
    itemname: "name",
    originalpdfitem: "originalPdfItem",
    originalpdfitme: "originalPdfItem",
    pdfitem: "originalPdfItem",
    pdfitme: "originalPdfItem",
    originalitem: "originalPdfItem",
    pdfrow: "originalPdfItem",
    pdfnumber: "originalPdfItem",
    quantity: "quantity",
    qty: "quantity",
    amount: "quantity",
    unit: "unit",
    units: "unit",
    size: "packageSize",
    sizetype: "packageSize",
    typesize: "packageSize",
    packagesize: "packageSize",
    equipmenttype: "packageSize",
    concentration: "concentration",
    concertration: "concentration",
    conc: "concentration",
    molarity: "concentration",
    storagelocation: "location",
    location: "location",
    storage: "location",
    cabinet: "location",
    shelf: "location",
    msdssummary: "msdsSummary",
    msdssum: "msdsSummary",
    msds: "msdsSummary",
    safetydata: "msdsSummary",
    safetysummary: "msdsSummary",
    hazard: "hazard",
    hazardlevel: "hazard",
    category: "category",
    type: "category",
    expiry: "expiry",
    expiration: "expiry",
    expires: "expiry",
    notes: "notes",
    note: "notes",
  };

  return fields[normalized] || "";
}

function importFieldsFromHeader(line) {
  const cells = parseDelimitedCells(line);
  const fields = cells.map(importFieldForHeader);
  const recognized = fields.filter(Boolean).length;
  return recognized >= 2 && (fields.includes("name") || fields.includes("cas")) ? fields : [];
}

function importCategoryFromHeader(line) {
  const normalizedHeaders = parseDelimitedCells(line).map(normalizedImportHeader).join(" ");
  if (/(equipment|equip|instrument|device)/i.test(normalizedHeaders)) return "Equipment";
  if (/(chemical|chem|cas|msds|concentration|concertration)/i.test(normalizedHeaders)) return "Chemical";
  return "";
}

function labeledImportFields(text) {
  const fields = {};
  const labels = [
    ["cas", "chemical\\s*id|chem\\s*id|equipment\\s*id|equip\\s*id|chemical\\s*code|equipment\\s*code|asset\\s*code|cas(?:\\s*number)?"],
    ["name", "chemical\\s*name|chem\\s*name|equipment\\s*name|equip\\s*name|item\\s*name|name"],
    ["originalPdfItem", "original\\s*pdf\\s*(?:item|itme|itm)|pdf\\s*(?:item|itme|itm)|original\\s*item|pdf\\s*row|pdf\\s*number"],
    ["quantity", "quantity|qty|amount"],
    ["unit", "units?|package"],
    ["packageSize", "size\\s*/\\s*type|type\\s*/\\s*size|size|package\\s*size|equipment\\s*type"],
    ["concentration", "concentration|concertration|conc\\.?|molarity"],
    ["location", "storage\\s*location|location|storage"],
    ["msdsSummary", "msds\\s*summary|msds|safety\\s*data|safety\\s*summary"],
    ["hazard", "hazard|risk"],
    ["category", "category|type"],
    ["expiry", "expiry|expiration|expires"],
    ["notes", "notes?"],
  ];

  labels.forEach(([field, labelPattern], index) => {
    const nextLabels = labels
      .slice(index + 1)
      .map(([, pattern]) => pattern)
      .join("|");
    const matcher = new RegExp(
      `(?:^|[,;|\\n])\\s*(?:${labelPattern})\\s*[:=]\\s*([\\s\\S]*?)(?=\\s*(?:[,;|\\n]\\s*(?:${nextLabels})\\s*[:=]|$))`,
      "i",
    );
    const match = text.match(matcher);
    if (match?.[1]) fields[field] = match[1].trim();
  });

  return fields;
}

function structuredImportDetails(line, headerFields = []) {
  const labeledFields = labeledImportFields(line);
  const details = { ...labeledFields };

  if (headerFields.length > 0) {
    parseDelimitedCells(line).forEach((cell, index) => {
      const field = headerFields[index];
      if (field && cell) details[field] = cell.trim();
    });
  }

  if (
    !details.name &&
    !details.cas &&
    !details.quantity &&
    !details.location &&
    !details.msdsSummary &&
    !details.packageSize &&
    !details.originalPdfItem
  ) {
    return null;
  }

  return details;
}

function parseExpiry(line) {
  const isoMatch = line.match(/\b(?:exp(?:iry|iration|ires?)?\.?\s*[:=-]?\s*)?(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?\b/i);
  if (isoMatch) {
    const [, year, month, day = "1"] = isoMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const slashMatch = line.match(/\b(?:exp(?:iry|iration|ires?)?\.?\s*[:=-]?\s*)?(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/i);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return "";
}

function stripMetadataText(text) {
  return text
    .replace(/\b(?:hazard|risk)\s*[:=-]?\s*(critical|high|moderate|low|none)\b/gi, "")
    .replace(/\b(category|type)\s*[:=-]?\s*(chemical|equipment|material|other)\b/gi, "")
    .replace(/\b(?:exp(?:iry|iration|ires?)?\.?\s*[:=-]?\s*)?\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?\b/gi, "")
    .replace(/\b(?:exp(?:iry|iration|ires?)?\.?\s*[:=-]?\s*)?\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripImportParserHints(text) {
  return text
    .replace(/\b(?:qty|quantity|count|number|#)\s*[:=]?\s*\d+(?:\.\d+)?\b/gi, "")
    .replace(new RegExp(`\\b(?:unit|units|size|volume|amount|per|each)\\s*[:=]?\\s*\\d+(?:\\.\\d+)?\\s*(?:${MEASUREMENT_UNIT_WORDS}|${COUNT_UNIT_WORDS})\\b`, "gi"), "")
    .replace(new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*[x×]\\s*\\d+(?:\\.\\d+)?\\s*(?:${MEASUREMENT_UNIT_WORDS}|${COUNT_UNIT_WORDS})\\b`, "gi"), "")
    .replace(new RegExp(`(?:^|\\s)[-–—]\\s*\\d+(?:\\.\\d+)?(?:\\s+(?:${COUNT_UNIT_WORDS}))?(?=\\s*(?:[,;]|$|\\bcabinet\\b|\\bshelf\\b|\\bgroup\\b|\\bhazard\\b|\\brisk\\b|\\bcategory\\b|\\btype\\b|\\bexp))`, "gi"), " ")
    .replace(/\b(critical|high|moderate|low|none|flammable|corrosive|toxic|oxidizer|oxidiser|irritant|harmful|warning|material|equipment|chemical|other)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractImportDetails(line, parts, structuredFields = null) {
  const structured = structuredFields || {};
  const measurementUnits = MEASUREMENT_UNIT_WORDS;
  const countUnits = COUNT_UNIT_WORDS;
  const amountPattern = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(${measurementUnits}|${countUnits})\\b`, "gi");
  const casMatch = line.match(/\bCAS(?:\s*(?:no\.?|#|:))?\s*(\d{2,7}-\d{2}-\d)\b/i) || line.match(/\b(\d{2,7}-\d{2}-\d)\b/);
  const cas = structured.cas || casMatch?.[1] || "";
  const lineQuantity = leadingQuantity(line);
  const usableParts = parts.filter((part) => !cas || !part.includes(cas)).map((part, index) => (index === 0 ? stripListNumber(part) : part.trim()));
  const sourceText = usableParts.join(", ");
  const structuredQuantity = quantityUnitFromText(structured.quantity);
  const amountTokens = [...sourceText.matchAll(amountPattern)].map((match) => ({
    amount: Number(match[1]),
    rawAmount: match[1],
    unit: normalizeUnitText(match[2]),
    token: `${match[1]} ${normalizeUnitText(match[2])}`,
  }));
  const multiplierMatch = sourceText.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*(${measurementUnits}|${countUnits})\\b`, "i"));
  const explicitQuantityMatch = sourceText.match(/\b(?:qty|quantity|count|number|#)\s*[:=]?\s*(\d+(?:\.\d+)?)\b/i);
  const explicitUnitMatch = sourceText.match(new RegExp(`\\b(?:unit|units|size|volume|amount|per|each)\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*(${measurementUnits}|${countUnits})\\b`, "i"));
  const explicitUnitToken = explicitUnitMatch ? `${explicitUnitMatch[1]} ${normalizeUnitText(explicitUnitMatch[2])}` : "";
  const dashQuantity = dashQuantityFromText(sourceText);
  if (explicitUnitMatch && !amountTokens.some((token) => token.token === `${explicitUnitMatch[1]} ${normalizeUnitText(explicitUnitMatch[2])}`)) {
    amountTokens.unshift({
      amount: Number(explicitUnitMatch[1]),
      rawAmount: explicitUnitMatch[1],
      unit: normalizeUnitText(explicitUnitMatch[2]),
      token: `${explicitUnitMatch[1]} ${normalizeUnitText(explicitUnitMatch[2])}`,
    });
  }
  const countToken = amountTokens.find((token) => new RegExp(`^(${countUnits})$`, "i").test(token.unit));
  const measureToken = amountTokens.find((token) => new RegExp(`^(${measurementUnits})$`, "i").test(token.unit));
  const standaloneQuantityIndex = usableParts.findIndex((part) => /^\d+(?:\.\d+)?$/.test(part));
  const standaloneQuantity = standaloneQuantityIndex >= 0 ? usableParts[standaloneQuantityIndex] : "";
  const unitAfterStandalone = standaloneQuantity
    ? usableParts
        .slice(standaloneQuantityIndex + 1)
        .find((part) => new RegExp(`^(${measurementUnits}|${countUnits})$`, "i").test(part))
    : "";
  const fallbackUnit = usableParts.find((part) => new RegExp(`^(?:${countUnits}|${measurementUnits})$`, "i").test(part));
  const quantity = structuredQuantity.quantity !== null
    ? structuredQuantity.quantity
    : explicitQuantityMatch
    ? Number(explicitQuantityMatch[1])
    : dashQuantity
      ? dashQuantity.quantity
    : multiplierMatch
      ? Number(multiplierMatch[1])
    : countToken
      ? countToken.amount
      : standaloneQuantity && !unitAfterStandalone
        ? Number(standaloneQuantity)
        : lineQuantity || 1;
  const unit =
    structured.unit ||
    structuredQuantity.unit ||
    (structuredQuantity.quantity !== null
      ? "unit"
      : multiplierMatch
        ? `${multiplierMatch[2]} ${normalizeUnitText(multiplierMatch[3])}`
        : dashQuantity?.unit
          ? dashQuantity.unit
        : countToken
          ? countToken.unit
        : unitAfterStandalone
          ? `${standaloneQuantity} ${unitAfterStandalone}`
          : explicitUnitToken || amountTokens
            .filter((token) => !(explicitQuantityMatch && token.rawAmount === explicitQuantityMatch[1] && /^units?$/i.test(token.unit)))
            .map((token) => token.token)
            .join(", ") || fallbackUnit || "unit");
  const rawFirstPart = stripListNumber(parts[0] || "");
  const firstPart = stripLocationText(rawFirstPart.includes(":") ? rawFirstPart.split(":").pop() : rawFirstPart);
  const cleanedName =
    structured.name ||
    stripLocationText(
      stripImportParserHints(stripMetadataText(firstPart))
        .replace(/^\s*\d+(?:\.\d+)?\s+(?=[A-Za-z])/, "")
        .replace(amountPattern, "")
        .replace(new RegExp(`\\b(${measurementUnits})\\b`, "gi"), "")
        .replace(/\b\d+(?:\.\d+)?\b/g, "")
        .replace(/^\s*[,;:-]\s*/g, "")
        .replace(/\s*[,;:-]\s*$/g, "")
        .trim(),
    ) ||
    stripLocationText(stripImportParserHints(stripMetadataText(stripListNumber(line))).replace(amountPattern, "").replace(cas, ""))
      .replace(/\b\d+(?:\.\d+)?\b/g, "")
      .replace(/^\s*[,;:-]\s*/g, "")
      .replace(/\s*[,;:-]\s*$/g, "")
      .trim() ||
    "Imported Item";

  return {
    name: cleanedName,
    cas,
    quantity,
    unit,
    packageSize: structured.packageSize || "",
    concentration: structured.concentration || "",
    storageLocation: structured.location || "",
    msdsSummary: structured.msdsSummary || "",
    notes: [structured.originalPdfItem ? `Original PDF item: ${structured.originalPdfItem}.` : "", structured.notes || ""]
      .filter(Boolean)
      .join(" "),
  };
}

function focusCabinetForItem(item) {
  const group = item.cabinet?.charAt(0)?.toUpperCase();
  if (!group) return;
  activeCabinetGroup = group;
  activeCabinet = item.cabinet;
  activeShelf = item.shelf;
}

function qrPayload(item) {
  return JSON.stringify({
    id: item.id,
    name: item.name,
    code: item.cas || "",
    sizeType: item.packageSize || "",
    concentration: item.concentration || "",
    location: itemLocation(item),
    msdsSummary: item.msdsSummary || "",
  });
}

function qrImageUrl(item, size = 220) {
  const data = encodeURIComponent(qrPayload(item));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${data}`;
}

function renderMetrics() {
  const low = items.filter(isLowStock).length;
  const expiring = items.filter(isExpiringSoon).length;
  const groups = new Set(items.map((item) => item.cabinet?.charAt(0)).filter(Boolean));
  const data = [
    ["Total inventory items", items.length, "▱"],
    ["Low-stock alerts", low, "!"],
    ["Expiring soon / expired", expiring, "◈"],
    ["Cabinet groups", [...groups].sort().join("-") || "A-E", "⌬"],
  ];

  document.querySelector("#metrics").innerHTML = data
    .map(
      ([label, value, icon]) => `
        <article class="metric-card">
          <div>
            <p>${label}</p>
            <strong>${value}</strong>
          </div>
          <span class="metric-icon" aria-hidden="true">${icon}</span>
        </article>
      `,
    )
    .join("");
}

function renderCabinetBars() {
  const groups = ["A", "B", "C", "D", "E"].map((group) => {
    const groupItems = items.filter((item) => item.cabinet?.startsWith(group));
    const risk = groupItems.filter((item) => ["High", "Critical"].includes(item.hazard)).length;
    return { group, count: groupItems.length, risk };
  });
  const max = Math.max(1, ...groups.map((group) => group.count));

  document.querySelector("#cabinetBars").innerHTML = groups
    .map(
      ({ group, count, risk }) => `
        <div class="bar-row">
          <span>Type ${group}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(count / max) * 100}%"></span></span>
          <span>${count} / ${risk}</span>
        </div>
      `,
    )
    .join("");
}

function renderAlerts() {
  const alerts = items
    .filter((item) => isLowStock(item) || isExpiringSoon(item) || ["High", "Critical"].includes(item.hazard))
    .slice(0, 6);

  document.querySelector("#alerts").innerHTML =
    alerts.length === 0
      ? `<div class="empty">No low-stock or expiry alerts are currently active.</div>`
      : alerts
          .map(
            (item) => `
              <article class="alert ${item.hazard === "Critical" ? "critical" : ""}">
                <span class="alert-dot"></span>
                <div>
                  <strong>${item.name}</strong>
                  <p class="card-detail">
                    ${item.hazard} hazard · ${itemLocation(item)} · Quantity: ${quantityMeta(item).quantity} · Unit: ${quantityMeta(item).unit}
                    ${quantityMeta(item).packageSize ? ` · Size / Type: ${quantityMeta(item).packageSize}` : ""}
                  </p>
                </div>
              </article>
            `,
          )
          .join("");
}

function renderRecent() {
  const recent = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  document.querySelector("#recentItems").innerHTML = recent
    .map(
      (item) => `
        <article class="recent-card">
          <h3>${item.name}</h3>
          <p class="card-detail">${item.cas || "No code"} · ${itemLocation(item)}</p>
          <span class="pill ${hazardClass(item.hazard)}">${item.hazard}</span>
        </article>
      `,
    )
    .join("");
}

function filteredItems() {
  const query = document.querySelector("#searchInput").value.trim().toLowerCase();
  const category = document.querySelector("#categoryFilter").value;
  const hazard = document.querySelector("#hazardFilter").value;

  return items.filter((item) => {
    const haystack = [item.name, item.cas, item.packageSize, item.concentration, item.cabinet, item.shelf, item.notes, item.msdsSummary]
      .join(" ")
      .toLowerCase();
    return (
      (!query || haystack.includes(query)) &&
      (category === "All categories" || item.category === category) &&
      (hazard === "All hazards" || item.hazard === hazard)
    );
  });
}

function renderInventory() {
  const list = filteredItems();
  document.querySelector("#inventoryList").innerHTML =
    list.length === 0
      ? `<div class="empty">No matching items. Adjust filters or add a new record.</div>`
      : list.map(itemRowTemplate).join("");
}

function itemRowTemplate(item, options = {}) {
  const settings =
    typeof options === "boolean"
      ? { readonly: options, clickable: !options }
      : { readonly: false, clickable: true, ...options };

  return `
    <article
      class="item-row ${settings.clickable ? "item-clickable" : ""}"
      ${settings.clickable ? `data-item="${item.id}" role="button" tabindex="0" aria-label="Open ${item.name} details"` : ""}
    >
      <div>
        <h3>${item.name}</h3>
        <p class="card-detail">
          ${item.cas || "No item ID"}${item.concentration ? ` · ${item.concentration}` : ""} · ${item.notes || item.msdsSummary || "No notes"}
        </p>
      </div>
      <div class="item-meta">
        <span class="pill">${item.category}</span>
        <span class="pill ${hazardClass(item.hazard)}">${item.hazard}</span>
      </div>
      <div>
        ${quantityUnitBlock(item)}
        <p class="card-detail location-line">${itemLocation(item)}</p>
      </div>
      ${
        settings.readonly
          ? ""
          : `<div class="row-actions">
              <button class="secondary-button" data-edit="${item.id}">Edit</button>
              <button class="secondary-button" data-delete="${item.id}">Delete</button>
            </div>`
      }
    </article>
  `;
}

function openItemDetail(itemId) {
  selectedItemId = itemId;
  renderItemDetail();
  showView("itemDetail");
}

function renderItemDetail() {
  const item = items.find((candidate) => candidate.id === selectedItemId) || items[0];
  const content = document.querySelector("#itemDetailContent");

  if (!item) {
    document.querySelector("#detailTitle").textContent = "Item Detail";
    document.querySelector("#detailSubtitle").textContent = "No inventory item is selected.";
    content.innerHTML = `<div class="empty">No item is available to inspect.</div>`;
    return;
  }

  selectedItemId = item.id;
  const meta = quantityMeta(item);
  document.querySelector("#detailTitle").textContent = item.name;
  document.querySelector("#detailSubtitle").textContent = `${item.cas || item.id} · ${itemLocation(item)}`;
  content.innerHTML = `
    <article class="detail-card">
      <div class="panel-heading">
        <div>
          <h2>Inventory Record</h2>
          <p>${item.notes || "No notes have been added for this item."}</p>
        </div>
        <span class="pill ${hazardClass(item.hazard)}">${item.hazard}</span>
      </div>
      <div class="detail-list">
        ${detailField("Item ID", item.id)}
        ${detailField("Chemical / Equipment ID", item.cas || "Not recorded")}
        ${detailField("Category", item.category)}
        ${detailField("Quantity", meta.quantity)}
        ${detailField("Unit", meta.unit)}
        ${detailField("Concentration", meta.concentration || "Not recorded")}
        ${meta.packageSize ? detailField("Size / Type", meta.packageSize) : ""}
        ${detailField("Cabinet", item.cabinet || "Unassigned")}
        ${detailField("Shelf", item.shelf || "No shelf")}
        ${detailField("MSDS Summary", item.msdsSummary || "Not recorded")}
        ${detailField("Expiry", item.expiry || "No expiry")}
        ${detailField("Created", item.createdAt || "Unknown")}
      </div>
    </article>
    <aside class="qr-card">
      <h2>Item QR Code</h2>
      <p class="card-detail">Scan to identify this item and its assigned location.</p>
      <img class="qr-image" src="${qrImageUrl(item)}" alt="QR code for ${item.name}" />
      <p><strong>${item.id}</strong></p>
    </aside>
  `;
}

function detailField(label, value) {
  return `
    <div class="detail-field">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderCabinets() {
  document.querySelector("#cabinetGroups").innerHTML = cabinetGroups
    .map((group) => `<button class="${group === activeCabinetGroup ? "is-active" : ""}" data-group="${group}">${group}</button>`)
    .join("");

  const cabinets = Array.from(
    { length: cabinetCountsByGroup[activeCabinetGroup] },
    (_, index) => `${activeCabinetGroup}-${String(index + 1).padStart(2, "0")}`,
  );
  if (!cabinets.includes(activeCabinet)) activeCabinet = cabinets[0];
  document.querySelector("#cabinetList").innerHTML = cabinets
    .map((cabinet) => `<button class="${cabinet === activeCabinet ? "is-active" : ""}" data-cabinet="${cabinet}">${cabinet}</button>`)
    .join("");

  document.querySelector("#shelfTitle").textContent = `Shelves inside ${activeCabinet}`;
  const shelfCount = shelfCountsByGroup[activeCabinetGroup] ?? 0;
  const shelves = Array.from({ length: shelfCount }, (_, index) => `Shelf ${index + 1}`);
  if (shelves.length > 0 && !shelves.includes(activeShelf)) activeShelf = shelves[0];

  document.querySelector("#shelfGrid").innerHTML = shelves
    .map((shelf) => {
      const count = items.filter((item) => item.cabinet === activeCabinet && item.shelf === shelf).length;
      return `<button class="${shelf === activeShelf ? "is-active" : ""}" data-shelf="${shelf}">${shelf}<br>${count} items</button>`;
    })
    .join("") || `<div class="empty wide">Type ${activeCabinetGroup} cabinets do not have shelves configured.</div>`;

  if (shelves.length === 0) {
    document.querySelector("#shelfSubtitle").textContent = `${activeCabinet} has 0 configured shelves.`;
    document.querySelector("#shelfItems").innerHTML = `<div class="empty">No shelf locations are available for this cabinet group.</div>`;
    return;
  }

  const shelfItems = items.filter((item) => item.cabinet === activeCabinet && item.shelf === activeShelf);
  document.querySelector("#shelfSubtitle").textContent = `${activeShelf} currently stores ${shelfItems.length} tracked item(s).`;
  document.querySelector("#shelfItems").innerHTML =
    shelfItems.length === 0
      ? `<div class="empty">No items recorded in this exact shelf location.</div>`
      : shelfItems.map((item) => itemRowTemplate(item, { readonly: true, clickable: true })).join("");
}

function parseImportText() {
  const text = document.querySelector("#importText").value.trim();
  if (!text) return [];
  let currentGroup = "";
  let currentCabinet = currentGroup ? `${currentGroup}-01` : "";
  let currentShelf = "";
  let currentPlacementRule = null;
  let currentImportHeaders = [];
  const placementRules = [];
  const rows = [];

  text
    .split(/\n+/)
    .filter((line) => line.trim())
    .forEach((rawLine) => {
      const headerFields = importFieldsFromHeader(rawLine.trim());
      if (headerFields.length > 0) {
        currentImportHeaders = headerFields;
        return;
      }

      const lineSegments = currentImportHeaders.length > 0 ? [rawLine] : rawLine.split(/\s*;\s*/);
      lineSegments.filter((line) => line.trim()).forEach((line) => {
      const trimmedLine = line.trim();
      const structuredFields = structuredImportDetails(trimmedLine, currentImportHeaders);
      const locationText = structuredFields?.location || trimmedLine;
      const contextLocation = parseCabinetLocation(trimmedLine);
      const structuredLocation = parseCabinetLocation(locationText);
      const hasShelfContext = /\bshelf\s*[-#]?\s*\d{1,2}\b/i.test(locationText);
      const placementInstruction = parsePlacementInstruction(trimmedLine, placementRules.length);
      let contextChanged = false;

      if (contextLocation.cabinetGroup && !structuredFields) {
        currentGroup = contextLocation.cabinetGroup;
        currentCabinet = cabinetCode(contextLocation.cabinetGroup, contextLocation.cabinetNumber);
        if (!hasShelfContext) currentShelf = "";
        contextChanged = true;
      } else {
        const groupContext = parseGroupContext(trimmedLine);
        if (groupContext) {
          currentGroup = groupContext;
          currentCabinet = cabinetCode(groupContext, 1);
          currentShelf = "";
          contextChanged = true;
        }
      }

      if (placementInstruction) {
        currentPlacementRule = placementInstruction;
        currentGroup = placementInstruction.group;
        currentCabinet = cabinetCode(placementInstruction.group, placementInstruction.startCabinet);
        currentShelf = `Shelf ${placementInstruction.startShelf}`;
        placementRules.push(placementInstruction);
        return;
      }

      if (contextChanged) {
        currentPlacementRule = null;
      }

      if (hasShelfContext) {
        currentShelf = `Shelf ${contextLocation.shelfNumber}`;
      }

      if (isGroupContextLine(trimmedLine) || isLocationContextLine(trimmedLine)) return;

      const index = rows.length;
      const parts = line.split(",").map((part) => part.trim()).filter(Boolean);
      const typedLocation = structuredLocation.cabinetGroup ? structuredLocation : parseCabinetLocation(line);
      const importDetails = extractImportDetails(line, parts, structuredFields);
      const itemNumber = listNumberFromLine(line);
      const numberNote = itemNumber !== null ? `Item number: ${itemNumber}. ` : "";
      const category = normalizeCategoryValue(structuredFields?.category, parseCategory(line));
      const hazard = structuredFields?.hazard || parseHazard(line) || (category === "Equipment" || category === "Material" ? "None" : "Low");
      const expiry = structuredFields?.expiry || parseExpiry(line);
      const notes = [numberNote && numberNote.trim(), importDetails.notes, "Imported from bulk notes. Review recommended."]
        .filter(Boolean)
        .join(" ");
      const parsedItem = {
        id: `CL-${Date.now()}-${index}`,
        itemNumber,
        sourceIndex: index,
        name: importDetails.name,
        cas: importDetails.cas,
        category,
        hazard,
        quantity: importDetails.quantity,
        unit: importDetails.unit,
        packageSize: importDetails.packageSize,
        concentration: importDetails.concentration,
        cabinet: typedLocation.cabinetGroup
          ? cabinetCode(typedLocation.cabinetGroup, typedLocation.cabinetNumber)
          : currentCabinet,
        shelf: hasShelfContext ? `Shelf ${typedLocation.shelfNumber}` : currentShelf,
        expiry,
        notes,
        msdsSummary: importDetails.msdsSummary,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      if (currentPlacementRule && !typedLocation.cabinetGroup && !hasShelfContext) {
        parsedItem.placementRuleId = currentPlacementRule.id;
      }
      rows.push(normalizeVisibleShelfLocation(parsedItem, index, { noteAdjustments: true, preferredGroup: currentGroup }));
      });
    });
  return applyPlacementRules(rows, placementRules).sort((a, b) => {
    const aPlaced = Number.isFinite(a.placementSortIndex);
    const bPlaced = Number.isFinite(b.placementSortIndex);
    if (aPlaced && bPlaced) return a.placementSortIndex - b.placementSortIndex;
    if (aPlaced) return -1;
    if (bPlaced) return 1;

    const aNumbered = Number.isFinite(a.itemNumber);
    const bNumbered = Number.isFinite(b.itemNumber);
    if (aNumbered && bNumbered) return a.itemNumber - b.itemNumber;
    if (aNumbered) return -1;
    if (bNumbered) return 1;
    return a.sourceIndex - b.sourceIndex;
  });
}

function renderReview() {
  document.querySelector("#reviewPanel").hidden = parsedRows.length === 0;
  document.querySelector("#reviewList").innerHTML = parsedRows.map(reviewRowTemplate).join("");
  parsedRows.forEach((item, index) => {
    populateReviewCabinetOptions(index, item.cabinet);
    populateReviewShelfOptions(index, item.shelf);
  });
}

function reviewRowTemplate(item, index) {
  return `
    <article class="review-row" data-review-row="${index}">
      <div class="review-row-head">
        <div>
          <h3>${item.name || "Imported Item"}</h3>
          <p class="card-detail">${item.cas || "No item ID"} · ${item.notes || "No notes"} · ${itemLocation(item)}</p>
        </div>
        <span class="pill ${hazardClass(item.hazard)}">${item.hazard}</span>
      </div>
      <div class="review-grid">
        <label>
          <span>Name</span>
          <input data-review-field="name" data-review-index="${index}" value="${item.name || ""}" />
        </label>
        <label>
          <span>Chemical / Equipment ID</span>
          <input data-review-field="cas" data-review-index="${index}" value="${item.cas || ""}" />
        </label>
        <label>
          <span>Quantity</span>
          <input data-review-field="quantity" data-review-index="${index}" type="number" min="0" step="0.1" value="${item.quantity || 1}" />
        </label>
        <label>
          <span>Unit</span>
          <input data-review-field="unit" data-review-index="${index}" value="${item.unit || "unit"}" />
        </label>
        <label>
          <span>Size / Type</span>
          <input data-review-field="packageSize" data-review-index="${index}" value="${item.packageSize || ""}" />
        </label>
        <label>
          <span>Concentration</span>
          <input data-review-field="concentration" data-review-index="${index}" value="${item.concentration || ""}" />
        </label>
        <label>
          <span>Expiry</span>
          <input data-review-field="expiry" data-review-index="${index}" type="date" value="${item.expiry || ""}" />
        </label>
        <label>
          <span>Category</span>
          <select data-review-field="category" data-review-index="${index}">
            ${["Chemical", "Equipment", "Material", "Other"].map((value) => `<option ${item.category === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Hazard</span>
          <select data-review-field="hazard" data-review-index="${index}">
            ${["None", "Low", "Moderate", "High", "Critical"].map((value) => `<option ${item.hazard === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Cabinet</span>
          <select data-review-field="cabinet" data-review-index="${index}"></select>
        </label>
        <label>
          <span>Shelf</span>
          <select data-review-field="shelf" data-review-index="${index}"></select>
        </label>
        <label class="wide">
          <span>Notes</span>
          <textarea data-review-field="notes" data-review-index="${index}" rows="2">${item.notes || ""}</textarea>
        </label>
        <label class="wide">
          <span>MSDS Summary</span>
          <textarea data-review-field="msdsSummary" data-review-index="${index}" rows="2">${item.msdsSummary || ""}</textarea>
        </label>
      </div>
    </article>
  `;
}

function populateReviewCabinetOptions(index, selectedCabinet = "") {
  const cabinetField = document.querySelector(`[data-review-field="cabinet"][data-review-index="${index}"]`);
  if (!cabinetField) return;
  const selected = cabinetOptions().includes(selectedCabinet) ? selectedCabinet : firstVisibleCabinet();

  cabinetField.innerHTML = cabinetOptions()
    .map((cabinet) => {
      const group = cabinet.charAt(0);
      const disabled = shelfCountsByGroup[group] === 0 ? "disabled" : "";
      return `<option value="${cabinet}" ${cabinet === selected ? "selected" : ""} ${disabled}>${cabinet}</option>`;
    })
    .join("");
  cabinetField.value = selected;
  parsedRows[index].cabinet = selected;
}

function populateReviewShelfOptions(index, selectedShelf = "") {
  const cabinetField = document.querySelector(`[data-review-field="cabinet"][data-review-index="${index}"]`);
  const shelfField = document.querySelector(`[data-review-field="shelf"][data-review-index="${index}"]`);
  if (!cabinetField || !shelfField) return;
  const shelves = shelvesForCabinet(cabinetField.value);
  const selected = shelves.includes(selectedShelf) ? selectedShelf : shelves[0] || "";

  shelfField.disabled = shelves.length === 0;
  shelfField.innerHTML =
    shelves.map((shelf) => `<option value="${shelf}" ${shelf === selected ? "selected" : ""}>${shelf}</option>`).join("") ||
    `<option value="">No shelves available</option>`;
  shelfField.value = selected;
  parsedRows[index].shelf = selected;
}

function renderLabels() {
  document.querySelector("#labelSheet").innerHTML = items
    .map(
      (item) => {
        const meta = quantityMeta(item);
        return `
          <article class="label-card">
            <div>
              <h3>${item.name}</h3>
              <p class="card-detail">${item.cas || item.id}</p>
              <p class="card-detail">
                Quantity: ${meta.quantity}<br>
                Unit: ${meta.unit}
                ${meta.concentration ? `<br>Concentration: ${meta.concentration}` : ""}
                ${meta.packageSize ? `<br>Size / Type: ${meta.packageSize}` : ""}
              </p>
              <p><strong>${itemLocation(item)}</strong></p>
              <span class="pill ${hazardClass(item.hazard)}">${item.hazard}</span>
            </div>
            <img class="qr-image" src="${qrImageUrl(item, 160)}" alt="QR code for ${item.name}" />
          </article>
        `;
      },
    )
    .join("");
}

function openDialog(item = null) {
  document.querySelector("#dialogTitle").textContent = item ? "Edit Item" : "Add Item";
  populateCabinetOptions(item?.cabinet);
  populateShelfOptions(item?.shelf);
  document.querySelector("#itemId").value = item?.id || "";
  document.querySelector("#nameField").value = item?.name || "";
  document.querySelector("#casField").value = item?.cas || "";
  document.querySelector("#categoryField").value = item?.category || "Chemical";
  document.querySelector("#hazardField").value = item?.hazard || "Low";
  document.querySelector("#quantityField").value = item?.quantity || 1;
  document.querySelector("#unitField").value = item?.unit || "";
  document.querySelector("#packageSizeField").value = item?.packageSize || "";
  document.querySelector("#concentrationField").value = item?.concentration || "";
  document.querySelector("#expiryField").value = item?.expiry || "";
  document.querySelector("#notesField").value = item?.notes || "";
  document.querySelector("#msdsField").value = item?.msdsSummary || "";
  itemDialog.showModal();
}

function populateCabinetOptions(selectedCabinet = "") {
  const cabinetField = document.querySelector("#cabinetField");
  const selected = cabinetOptions().includes(selectedCabinet) ? selectedCabinet : firstVisibleCabinet();

  cabinetField.innerHTML = cabinetOptions()
    .map((cabinet) => {
      const group = cabinet.charAt(0);
      const disabled = shelfCountsByGroup[group] === 0 ? "disabled" : "";
      const note = disabled ? " (0 shelves)" : "";
      return `<option value="${cabinet}" ${cabinet === selected ? "selected" : ""} ${disabled}>${cabinet}${note}</option>`;
    })
    .join("");
  cabinetField.value = selected;
}

function populateShelfOptions(selectedShelf = "") {
  const cabinet = document.querySelector("#cabinetField").value;
  const shelfField = document.querySelector("#shelfField");
  const shelves = shelvesForCabinet(cabinet);
  const selected = shelves.includes(selectedShelf) ? selectedShelf : shelves[0] || "";

  shelfField.disabled = shelves.length === 0;
  shelfField.innerHTML =
    shelves.map((shelf) => `<option value="${shelf}" ${shelf === selected ? "selected" : ""}>${shelf}</option>`).join("") ||
    `<option value="">No shelves available</option>`;
  shelfField.value = selected;
}

function collectFormItem() {
  const id = document.querySelector("#itemId").value || `CL-${Date.now()}`;
  const item = {
    id,
    name: document.querySelector("#nameField").value.trim(),
    cas: document.querySelector("#casField").value.trim(),
    category: document.querySelector("#categoryField").value,
    hazard: document.querySelector("#hazardField").value,
    quantity: Number(document.querySelector("#quantityField").value) || 0,
    unit: document.querySelector("#unitField").value.trim(),
    packageSize: document.querySelector("#packageSizeField").value.trim(),
    concentration: document.querySelector("#concentrationField").value.trim(),
    cabinet: document.querySelector("#cabinetField").value,
    shelf: document.querySelector("#shelfField").value,
    expiry: document.querySelector("#expiryField").value,
    notes: document.querySelector("#notesField").value.trim(),
    msdsSummary: document.querySelector("#msdsField").value.trim(),
    createdAt: items.find((item) => item.id === id)?.createdAt || new Date().toISOString().slice(0, 10),
  };
  return normalizeVisibleShelfLocation(item, items.length, { noteAdjustments: true });
}

function renderAll() {
  renderMetrics();
  renderCabinetBars();
  renderAlerts();
  renderRecent();
  renderInventory();
  renderCabinets();
  renderReview();
  renderItemDetail();
  renderLabels();
}

tabs.forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.view)));
document.querySelectorAll("[data-jump]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.jump)));
document.querySelector("#addItemButton").addEventListener("click", () => openDialog());
document.querySelector("#cabinetField").addEventListener("change", () => populateShelfOptions());
document.querySelector("#backToInventoryButton").addEventListener("click", () => showView("inventory"));
document.querySelector("#editDetailButton").addEventListener("click", () => {
  const item = items.find((candidate) => candidate.id === selectedItemId);
  if (item) openDialog(item);
});
document.querySelector("#searchInput").addEventListener("input", renderInventory);
document.querySelector("#categoryFilter").addEventListener("change", renderInventory);
document.querySelector("#hazardFilter").addEventListener("change", renderInventory);
document.querySelector("#parseButton").addEventListener("click", () => {
  parsedRows = parseImportText();
  renderReview();
});
document.querySelector("#reviewList").addEventListener("input", (event) => {
  const field = event.target.dataset.reviewField;
  const index = Number(event.target.dataset.reviewIndex);
  if (!field || Number.isNaN(index) || !parsedRows[index]) return;

  parsedRows[index][field] = field === "quantity" ? Number(event.target.value) || 0 : event.target.value;
});
document.querySelector("#reviewList").addEventListener("change", (event) => {
  const field = event.target.dataset.reviewField;
  const index = Number(event.target.dataset.reviewIndex);
  if (!field || Number.isNaN(index) || !parsedRows[index]) return;

  parsedRows[index][field] = field === "quantity" ? Number(event.target.value) || 0 : event.target.value;
  if (field === "cabinet") {
    populateReviewShelfOptions(index);
  }
});
document.querySelector("#saveParsedButton").addEventListener("click", () => {
  const reviewedRows = parsedRows.map((item, index) => {
    const { placementRuleId, placementSortIndex, ...reviewedItem } = item;
    return normalizeVisibleShelfLocation(reviewedItem, index);
  });
  items = [...reviewedRows, ...items];
  if (reviewedRows[0]) focusCabinetForItem(reviewedRows[0]);
  parsedRows = [];
  saveItems();
  renderAll();
  showView("cabinets");
});
document.querySelector("#printLabelsButton").addEventListener("click", () => window.print());
document.querySelector("#closeDialogButton").addEventListener("click", () => itemDialog.close());
document.querySelector("#cancelDialogButton").addEventListener("click", () => itemDialog.close());
document.querySelector("#fileInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  document.querySelector("#importText").value = await file.text();
});

document.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  const itemId = event.target.closest("[data-item]")?.dataset.item;
  const group = event.target.dataset.group;
  const cabinet = event.target.dataset.cabinet;
  const shelf = event.target.dataset.shelf;

  if (editId) {
    openDialog(items.find((item) => item.id === editId));
    return;
  }
  if (deleteId) {
    items = items.filter((item) => item.id !== deleteId);
    if (selectedItemId === deleteId) selectedItemId = items[0]?.id || "";
    saveItems();
    renderAll();
    return;
  }
  if (itemId) {
    openItemDetail(itemId);
    return;
  }
  if (group) {
    activeCabinetGroup = group;
    activeCabinet = `${group}-01`;
    renderCabinets();
  }
  if (cabinet) {
    activeCabinet = cabinet;
    renderCabinets();
  }
  if (shelf) {
    activeShelf = shelf;
    renderCabinets();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const itemId = event.target.dataset.item;
  if (!itemId) return;
  event.preventDefault();
  openItemDetail(itemId);
});

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const saved = collectFormItem();
  items = items.some((item) => item.id === saved.id)
    ? items.map((item) => (item.id === saved.id ? saved : item))
    : [saved, ...items];
  saveItems();
  itemDialog.close();
  renderAll();
});

renderAll();
