// Fixed option lists for the quote builder. The product catalog itself
// (items, brands, unit prices) comes from the API — see slices/catalogSlice.js —
// not from here.

export const PROJECT_TYPES = ["Solar", "Battery", "Solar + Battery", "Other"];

// Additional costs add to the quote; rebates and discounts take money off it.
// Each has its own section in the quote builder, and a cost line's `kind`
// says which section it belongs to.

export const ADDITIONAL_COST_TYPES = ["Transportation", "Installation", "Civil Work", "Engineering", "Other"];

export const REBATE_TYPES = ["STC", "VEEC / ESC", "Federal battery rebate", "State rebate", "Other rebate"];

export const DISCOUNT_TYPES = ["Customer discount", "Business owner discount", "Promotional", "Other discount"];

export const COST_KINDS = {
  cost: { key: "cost", label: "Additional cost", types: ADDITIONAL_COST_TYPES, deduction: false },
  rebate: { key: "rebate", label: "Rebate", types: REBATE_TYPES, deduction: true },
  discount: { key: "discount", label: "Discount", types: DISCOUNT_TYPES, deduction: true },
};

/**
 * Which section a cost line belongs to. Lines saved before the split carry no
 * `kind`, so their cost type decides it — "Rebate" and "Discount" were the
 * two deduction types then.
 */
export function costKind(cost) {
  const kind = cost?.kind;
  if (kind && COST_KINDS[kind]) return kind;
  const type = cost?.costType;
  if (type === "Rebate" || REBATE_TYPES.includes(type)) return "rebate";
  if (type === "Discount" || DISCOUNT_TYPES.includes(type)) return "discount";
  return "cost";
}

export const TAX_TREATMENTS = [
  { key: "exclusive", label: "Exclusive of GST" },
  { key: "inclusive", label: "Inclusive of GST" },
  { key: "no_gst", label: "No GST" },
];
