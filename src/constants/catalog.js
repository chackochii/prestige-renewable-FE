// Fixed option lists for the quote builder. The product catalog itself
// (items, brands, unit prices) comes from the API — see slices/catalogSlice.js —
// not from here.

export const PROJECT_TYPES = ["Solar", "Battery", "Solar + Battery", "Other"];

export const ADDITIONAL_COST_TYPES = ["Transportation", "Installation", "Civil Work", "Engineering", "Other"];

export const TAX_TREATMENTS = [
  { key: "exclusive", label: "Exclusive of GST" },
  { key: "inclusive", label: "Inclusive of GST" },
  { key: "no_gst", label: "No GST" },
];
