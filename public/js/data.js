/* ============================================================
   UNI STEEL — site config + content data
   Edit values here; no need to touch the pages.
   ============================================================ */

var SITE = {
  // PENDING DECISION: which numbers go live (brief item 1). Using the caption numbers for now.
  whatsapp: "201019182323",              // international format, no + or spaces
  // People shown on the site (name + number + optional photo). `phones` is derived from this list.
  // Photos used on the site (empty = placeholder). Uploaded from the admin panel, or put files in public/img/.
  images: {
    hero: "img/hero/hero.webp", factory: "", about: "", menu: "",
    svc: ["img/services/fabrication.webp", "img/services/delivery.webp", "img/services/handover.webp"],
    venues: {
      restaurant: "img/venues/restaurant.webp", hotel: "img/venues/hotel.webp", cafe: "img/venues/cafe.webp",
      central: "img/venues/central.webp", catering: "img/venues/catering.webp"
    }
  },
  contacts: [
    { ar: "م. إسلام سلامة", en: "Eng. Islam Salama", tAr: "صاحب الشركة", tEn: "Company Owner", phone: "01019182323", photo: "" },
    { ar: "م. سيد سلامة", en: "Eng. Sayed Salama", tAr: "صاحب الشركة", tEn: "Company Owner", phone: "01067966076", photo: "img/team/sayed.webp" }
  ],
  phones: ["01019182323", "01067966076"],
  email: "",                             // PENDING: official email. Hidden while empty.
  address: { ar: "القليوبية، مصر", en: "Qalyubia, Egypt" }, // PENDING: full address + hours
  hours: { ar: "", en: "" },             // PENDING: working hours. Hidden while empty.
  mapEmbed: "",                          // PENDING: Google Maps embed URL
  formEndpoint: "",                      // optional: Formspree/Getform URL to also deliver the form by email
  // Trust sections: each shows on the home page only when filled. Example stat: { value: "1997", ar: "سنة التأسيس", en: "Founded" }
  stats: [],
  credentials: [],                       // example: [{ ar: "السجل الصناعي", en: "Industrial Registry" }]
  exportCountries: { ar: [], en: [] },   // example: { ar: ["السعودية"], en: ["Saudi Arabia"] }
  ga: "",                                // Google Analytics ID, e.g. "G-XXXXXXXXXX"
  pixel: ""                              // Meta Pixel ID
};

var CATEGORIES = [
  { id: "cooling",   ar: "التبريد",            en: "Refrigeration",
    dAr: "تلاجات رأسية، أندر كاونتر، ثلاجات وفاترينات عرض.",
    dEn: "Upright fridges, undercounter prep fridges, display fridges and showcases." },
  { id: "cooking",   ar: "الطهي",              en: "Cooking",
    dAr: "بوتجازات غاز وكهرباء، أفران بيتزا، قلايات، جريل وبلانشا.",
    dEn: "Gas and electric ranges, pizza ovens, fryers, grills and griddles." },
  { id: "holding",   ar: "الحفظ والتقديم",     en: "Holding & Serving",
    dAr: "دواليب حفظ سخن، بان ماري، كاونترات بوفيه.",
    dEn: "Hot holding cabinets, bain-maries and buffet counters." },
  { id: "bulk",      ar: "الإنتاج بالكميات",   en: "Bulk Production",
    dAr: "حلل بخارية للمطابخ المركزية والكاترينج.",
    dEn: "Steam kettles for central kitchens and catering." },
  { id: "equipment", ar: "التجهيزات",          en: "Kitchen Equipment",
    dAr: "ترابيزات تحضير، أحواض استانلس، وخطوط إنتاج متكاملة.",
    dEn: "Prep tables, stainless sinks and complete production lines." }
];

/* Product names come from the brief. Photos/specs/models: PENDING from the company.
   Photos live in public/img/products/. Add more with `images: ["img/products/x.webp", ...]`, or from the admin panel. */
var PRODUCTS = [
  { id: "upright-fridge", cat: "cooling", ar: "تلاجة رأسية استانلس باب واحد", en: "Single-Door Upright Refrigerator", dAr: "تلاجة رأسية استانلس بباب واحد، على عجل بفرامل.", dEn: "Stainless single-door upright refrigerator on braked castors.", images: ["img/products/upright-fridge.webp"], featured: true },
  { id: "undercounter-fridge", cat: "cooling", ar: "تلاجة تحضير أندر كاونتر بابين", en: "Two-Door Undercounter Prep Fridge", dAr: "تلاجة تحضير استانلس بابين وسطح عمل بظهر مرتفع، على عجل.", dEn: "Stainless two-door prep fridge with a worktop upstand, on castors.", images: ["img/products/undercounter-fridge.webp"], featured: true },
  { id: "display-fridge", cat: "cooling", ar: "ثلاجة عرض بابين زجاج مضيئة", en: "Two-Door Lit Glass Display Cooler", dAr: "ثلاجة عرض استانلس بابين زجاج وإضاءة داخلية وشاشة تحكم رقمية.", dEn: "Stainless display cooler with two glass doors, interior lighting and a digital controller.", images: ["img/products/display-fridge.webp"] },
  { id: "glass-door-cooler-single", cat: "cooling", ar: "ثلاجة عرض باب زجاج واحد (حجم صغير)", en: "Compact Single Glass-Door Cooler", dAr: "ثلاجة استانلس صغيرة بباب زجاج ورف داخلي ومروحة، وشاشة تحكم رقمية.", dEn: "Compact stainless cooler with a glass door, an inner shelf, a fan and a digital controller.", images: ["img/products/glass-door-cooler-single.webp"] },
  { id: "display-showcase", cat: "cooling", ar: "فاترينة عرض حلويات مقوسة", en: "Curved Glass Cake Showcase", dAr: "فاترينة عرض زجاج مقوس بأرفف زجاج وقاعدة سوداء وإطار نحاسي.", dEn: "Curved-glass display showcase with glass shelves, a black base and a brass-finish frame.", images: ["img/products/display-showcase.webp"], featured: true },
  { id: "pizza-oven", cat: "cooking", ar: "فرن بيتزا بقبة موزاييك ذهبي", en: "Gold Mosaic Dome Pizza Oven", dAr: "فرن بيتزا بقبة مكسوة بموزاييك ذهبي وواجهة استانلس، على ستاند بعجل.", dEn: "Pizza oven with a gold-mosaic dome and a stainless front, on a wheeled stand.", images: ["img/products/pizza-oven.webp"], featured: true },
  { id: "red-door-oven", cat: "cooking", ar: "فرن ستاند بباب أحمر ومدخنة", en: "Floor-Standing Oven with Red Door & Chimney", dAr: "فرن استانلس على ستاند بباب أحمر ومقبض طويل ومقياس حرارة، ومدخنة بغطاء مخروطي.", dEn: "Stainless floor-standing oven with a red door, a long handle and a temperature gauge, plus a chimney with a conical cap.", images: ["img/products/red-door-oven.webp"] },
  { id: "gas-range", cat: "cooking", ar: "بوتجاز غاز 6 شعلات بفرن (موديل 1)", en: "6-Burner Gas Range with Oven (Model 1)", dAr: "بوتجاز غاز بست شعلات وفرن سفلي، ومقابض بإطار أصفر.", dEn: "Six-burner gas range with a lower oven and yellow-ringed knobs.", images: ["img/products/gas-range.webp"], featured: true },
  { id: "gas-range-6-model-2", cat: "cooking", ar: "بوتجاز غاز 6 شعلات بفرن (موديل 2)", en: "6-Burner Gas Range with Oven (Model 2)", dAr: "بوتجاز غاز بست شعلات وفرن سفلي وجانب مغلق.", dEn: "Six-burner gas range with a lower oven and closed side panel.", images: ["img/products/gas-range-6-model-2.webp"] },
  { id: "gas-range-6-brass", cat: "cooking", ar: "بوتجاز غاز 6 شعلات بفرن (رؤوس نحاس)", en: "6-Burner Gas Range with Oven (Brass Burners)", dAr: "بوتجاز غاز بست شعلات برؤوس نحاسية وفرن سفلي.", dEn: "Six-burner gas range with brass burner heads and a lower oven.", images: ["img/products/gas-range-6-brass.webp"] },
  { id: "gas-range-4", cat: "cooking", ar: "بوتجاز غاز 4 شعلات بفرن", en: "4-Burner Gas Range with Oven", dAr: "بوتجاز غاز بأربع شعلات وفرن سفلي بمقبض طويل.", dEn: "Four-burner gas range with a lower oven and a long handle.", images: ["img/products/gas-range-4.webp"] },
  { id: "electric-range", cat: "cooking", ar: "بوتجاز كهرباء 4 عيون (ترابيزة)", en: "4-Plate Electric Cooktop (Countertop)", dAr: "بوتجاز كهرباء بأربعة أقراص تسخين ومفتاح تحكم لكل قرص، للتركيب على سطح.", dEn: "Electric cooktop with four hot plates and a control knob for each, for countertop use.", images: ["img/products/electric-range.webp"] },
  { id: "electric-hot-plate", cat: "cooking", ar: "سخان كهرباء عين واحدة", en: "Single Electric Hot Plate", dAr: "سخان كهرباء بقرص تسخين واحد ومفتاح تحكم وأضواء بيان، للاستخدام على سطح.", dEn: "Electric hot plate with one heating disc, a control knob and indicator lights, for countertop use.", images: ["img/products/electric-hot-plate.webp"] },
  { id: "modular-cooking-line", cat: "cooking", ar: "خط طهي كهربائي مودولر على ستاند", en: "Modular Electric Cooking Line on Stand", dAr: "أربع وحدات على ستاند واحد: بلانشا، وحوض بان ماري، وسخان بعينتين، ووحدة بسلة مثقبة.", dEn: "Four units on one stand: a griddle, a bain-marie pan, a two-plate hob and a unit with a perforated basket.", images: ["img/products/modular-cooking-line.webp"], featured: true },
  { id: "fryer", cat: "cooking", ar: "قلاية مزدوجة بدولاب", en: "Double Fryer with Cabinet", dAr: "قلاية بحوضين ومفتاح تحكم لكل حوض، ودولاب تخزين بابين.", dEn: "Fryer with two baskets, a control knob for each, and a two-door storage cabinet.", images: ["img/products/fryer.webp"] },
  { id: "tilting-braising-pan", cat: "cooking", ar: "طاسة قلابة بغطاء", en: "Tilting Braising Pan with Lid", dAr: "طاسة طبخ قلابة بغطاء مفصلي وعجلة قلب يدوية ومفتاح تحكم.", dEn: "Tilting braising pan with a hinged lid, a hand wheel for tilting and a control knob.", images: ["img/products/tilting-braising-pan.webp"] },
  { id: "grill", cat: "cooking", ar: "جريل", en: "Grill", dAr: "جريل للمشويات والستيك والبرجر.", dEn: "Grill for steaks, burgers and grilled items.", images: [] },
  { id: "plancha", cat: "cooking", ar: "بلانشا", en: "Griddle (Plancha)", dAr: "بلانشا للشاورما والبرجر والفطور.", dEn: "Griddle for shawarma, burgers and breakfast.", images: [] },
  { id: "hot-holding", cat: "holding", ar: "دولاب حفظ سخن", en: "Hot Holding Cabinet", dAr: "يحفظ الأكل ساخن لحد وقت التقديم.", dEn: "Keeps food hot until service.", images: [] },
  { id: "bain-marie", cat: "holding", ar: "بان ماري", en: "Bain-Marie", dAr: "بان ماري لتقديم وحفظ الأطباق الساخنة.", dEn: "Bain-marie for serving and holding hot dishes.", images: [] },
  { id: "buffet-counter", cat: "holding", ar: "كاونتر بوفيه", en: "Buffet Counter", dAr: "كاونتر بوفيه للفنادق والكاترينج والمطاعم.", dEn: "Buffet counter for hotels, catering and restaurants.", images: [] },
  { id: "steam-kettle", cat: "bulk", ar: "حلة بخارية بغطاء", en: "Steam Kettle with Lid", dAr: "حلة طبخ بخارية بغطاء دائري وصنبور ومانومتر، على قاعدة استانلس.", dEn: "Steam-jacketed cooking kettle with a round lid, a tap and a pressure gauge, on a stainless base.", images: ["img/products/steam-kettle.webp"], featured: true },
  { id: "stainless-sink", cat: "equipment", ar: "حوض استانلس بحوض واحد وفتحة تفريغ مخلفات", en: "Single-Bowl Sink with Waste Chute", dAr: "ترابيزة حوض استانلس بحوض واحد وفتحة تفريغ مخلفات فوق سلة تجميع.", dEn: "Stainless sink table with one bowl and a waste chute over a collection bin.", images: ["img/products/stainless-sink.webp"] },
  { id: "hand-wash-sink", cat: "equipment", ar: "حوض غسيل أيدي بدواسة", en: "Knee-Operated Hand Wash Basin", dAr: "حوض غسيل أيدي استانلس بصنبور ودواسة تشغيل.", dEn: "Stainless hand wash basin with a tap and a knee-operated pedal.", images: ["img/products/hand-wash-sink.webp"] },
  { id: "mobile-control-unit", cat: "equipment", ar: "وحدة استانلس متنقلة بلوحة تحكم", en: "Mobile Stainless Unit with Control Panel", dAr: "وحدة استانلس متنقلة بباب، ولوحة تحكم رقمية وأضواء بيان.", dEn: "Mobile stainless unit with a door, a digital controller and indicator lights.", images: ["img/products/mobile-control-unit.webp"] },
  { id: "mobile-stainless-cart", cat: "equipment", ar: "عربة استانلس متنقلة بغطاء وفتحات تهوية", en: "Mobile Stainless Cart with Lid & Vented Panels", dAr: "عربة استانلس متنقلة بغطاء مفصلي وجوانب مفرّغة، على عجل بفرامل.", dEn: "Mobile stainless cart with a hinged lid and perforated sides, on braked castors.", images: ["img/products/mobile-stainless-cart.webp"] },
  { id: "prep-table", cat: "equipment", ar: "ترابيزة تحضير", en: "Prep Table", dAr: "ترابيزة تحضير استانلس بالمقاس المناسب للمكان.", dEn: "Stainless prep table sized to your space.", images: [] },
  { id: "production-line", cat: "equipment", ar: "خط إنتاج متكامل", en: "Complete Production Line", dAr: "خط إنتاج متكامل مصمم حسب منيو العميل وحجم الإنتاج.", dEn: "A full production line designed around your menu and volume.", images: [] }
];

/* Sample projects: PLACEHOLDERS until the company sends 5–10 real ones (with client permission).
   Add `images: [...]` and `video` once available. */
var PROJECTS = [
  { id: "p1", type: "restaurant", ar: "مطبخ مطعم",           en: "Restaurant Kitchen",
    items: { ar: "بوتجازات، قلايات، ترابيزات تحضير، تلاجات", en: "Ranges, fryers, prep tables, fridges" } },
  { id: "p2", type: "hotel",      ar: "مطبخ فندق",           en: "Hotel Kitchen",
    items: { ar: "خط إنتاج، حلل بخارية، كاونترات بوفيه", en: "Production line, steam kettles, buffet counters" } },
  { id: "p3", type: "cafe",       ar: "كافيه",               en: "Café",
    items: { ar: "فاترينات عرض، أندر كاونتر، ترابيزة باريستا", en: "Display showcases, undercounters, barista table" } },
  { id: "p4", type: "central",    ar: "مطبخ مركزي",          en: "Central Kitchen",
    items: { ar: "حلل بخارية، أحواض، تلاجات رأسية", en: "Steam kettles, sinks, upright fridges" } },
  { id: "p5", type: "catering",   ar: "شركة كاترينج",        en: "Catering Company",
    items: { ar: "دواليب حفظ سخن، بان ماري، ترابيزات", en: "Hot holding cabinets, bain-maries, tables" } },
  { id: "p6", type: "restaurant", ar: "مطعم بيتزا",          en: "Pizza Restaurant",
    items: { ar: "أفران بيتزا، أندر كاونتر، ترابيزات تحضير", en: "Pizza ovens, undercounters, prep tables" } }
];

var PROJECT_TYPES = [
  { id: "restaurant", ar: "مطاعم", en: "Restaurants" },
  { id: "hotel",      ar: "فنادق", en: "Hotels" },
  { id: "cafe",       ar: "كافيهات", en: "Cafés" },
  { id: "central",    ar: "مطابخ مركزية", en: "Central Kitchens" },
  { id: "catering",   ar: "كاترينج", en: "Catering" }
];

/* Lets server.js reuse these as the built-in defaults (ignored in the browser). */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SITE: SITE, CATEGORIES: CATEGORIES, PRODUCTS: PRODUCTS, PROJECTS: PROJECTS, PROJECT_TYPES: PROJECT_TYPES };
}
