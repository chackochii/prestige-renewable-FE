// Electricity bills for the AI-assisted quote (features/pipeline/AiQuoteBill).

/** Types the AI can read a bill from — the server's list (prestige-be utils/llm.js LLM_FILE_TYPES). */
const READABLE = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/;
const READABLE_EXTENSION = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;

/** An attachment ({ mime, filename }) or a picked File ({ type, name }) the AI can read. */
export const isReadableBill = (file) =>
  READABLE.test(file?.mime || file?.type || "") || READABLE_EXTENSION.test(file?.filename || file?.name || "");

/**
 * Whether a bill reading has the usage a quote is sized from — the server's
 * rule (energyBillService.annualUsageOf), so the button can say so first.
 */
export const readingHasUsage = (reading) =>
  Boolean(
    reading &&
      (Number(reading.annualUsageKwh) > 0 ||
        Number(reading.averageDailyKwh) > 0 ||
        (Number(reading.usageKwh) > 0 && (Number(reading.billingDays) > 0 || (reading.periodStart && reading.periodEnd))) ||
        (reading.usageHistory || []).filter((entry) => entry.averageDailyKwh > 0).length >= 4),
  );
