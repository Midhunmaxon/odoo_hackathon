import {
  Discount,
  Tax,
  InvoiceLineInput,
  CalculatedLineTotal,
  CalculatedInvoiceTotals,
} from './tax-discount.types';

/**
 * Consistently rounds a number to two decimal places using standard half-up rounding.
 */
export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Normalizes a Date, string, or number to a 'YYYY-MM-DD' calendar date string for accurate date comparisons.
 */
export function normalizeDateString(date: Date | string | number | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Checks if a discount is valid on the given date and has remaining usage.
 */
export function isDiscountValidAndAvailable(discount: Discount, todayDateStr: string): boolean {
  // 1. Check start_date (must be on or before today)
  if (discount.start_date) {
    const startDateStr = normalizeDateString(discount.start_date);
    if (startDateStr && todayDateStr < startDateStr) {
      return false;
    }
  }

  // 2. Check end_date (must be on or after today)
  if (discount.end_date) {
    const endDateStr = normalizeDateString(discount.end_date);
    if (endDateStr && todayDateStr > endDateStr) {
      return false;
    }
  }

  // 3. Check usage limit
  if (discount.usage_limit !== null && discount.usage_limit !== undefined) {
    if (discount.used_count >= discount.usage_limit) {
      return false;
    }
  }

  return true;
}

/**
 * Pure function to calculate invoice totals including line-level and invoice-level discounts and taxes.
 * 
 * Rules:
 * - A discount applies only if within its dates, thresholds are met, and used_count < usage_limit.
 * - Applies discount before tax.
 * - Rounds to 2 decimals consistently.
 * - Never allows a negative total.
 * 
 * @param lines Array of line items
 * @param discounts Array or single discount applicable
 * @param taxes Array, Map, or Record of available taxes
 * @param today Reference date for validity checking (defaults to current date)
 */
export function calculateInvoiceTotals(
  lines: InvoiceLineInput[],
  discounts: Discount | Discount[] = [],
  taxes: Tax | Tax[] | Map<number, Tax> | Record<number, Tax> = [],
  today: Date | string = new Date()
): CalculatedInvoiceTotals {
  // Normalize today's date string
  const todayStr = normalizeDateString(today) || new Date().toISOString().split('T')[0];

  // Normalize discounts array
  const discountList: Discount[] = Array.isArray(discounts)
    ? discounts
    : discounts
      ? [discounts]
      : [];

  // Normalize taxes lookup map
  const taxMap = new Map<number, Tax>();
  if (taxes instanceof Map) {
    taxes.forEach((val, key) => taxMap.set(key, val));
  } else if (Array.isArray(taxes)) {
    taxes.forEach((t) => taxMap.set(t.id, t));
  } else if (taxes && typeof taxes === 'object') {
    if ('id' in taxes && typeof (taxes as any).id === 'number') {
      taxMap.set((taxes as Tax).id, taxes as Tax);
    } else {
      Object.entries(taxes).forEach(([k, v]) => taxMap.set(Number(k), v));
    }
  }

  // Handle empty lines early
  if (!lines || lines.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
      discount_total: 0,
      tax_total: 0,
    };
  }

  // Initial calculation of per-line subtotals
  interface IntermediateLine {
    input: InvoiceLineInput;
    subtotal: number;
    productDiscount: number;
    remainingAfterProductDiscount: number;
    subscriptionDiscount: number;
    totalDiscount: number;
    taxableAmount: number;
    taxRatePercent: number;
    taxAmount: number;
    total: number;
  }

  const intermediateLines: IntermediateLine[] = lines.map((l) => {
    const qty = Math.max(0, Number(l.quantity) || 0);
    const unitPrice = Math.max(0, Number(l.unit_price) || 0);
    const subtotal = roundToTwoDecimals(qty * unitPrice);
    return {
      input: l,
      subtotal,
      productDiscount: 0,
      remainingAfterProductDiscount: subtotal,
      subscriptionDiscount: 0,
      totalDiscount: 0,
      taxableAmount: subtotal,
      taxRatePercent: 0,
      taxAmount: 0,
      total: subtotal,
    };
  });

  const invoiceSubtotal = roundToTwoDecimals(
    intermediateLines.reduce((acc, l) => acc + l.subtotal, 0)
  );
  const invoiceTotalQuantity = intermediateLines.reduce(
    (acc, l) => acc + (Number(l.input.quantity) || 0),
    0
  );

  // Filter valid discounts
  const validDiscounts = discountList.filter((d) => isDiscountValidAndAvailable(d, todayStr));

  // 1. Apply PRODUCT-level discounts
  for (const line of intermediateLines) {
    const lineProductId = line.input.product_id;
    if (lineProductId == null) continue;

    const applicableProductDiscounts = validDiscounts.filter(
      (d) => d.applies_to === 'PRODUCT' && Number(d.product_id) === Number(lineProductId)
    );

    for (const d of applicableProductDiscounts) {
      // Check product-level thresholds
      if (d.min_quantity != null && (Number(line.input.quantity) || 0) < d.min_quantity) {
        continue;
      }
      if (d.min_purchase != null && line.subtotal < d.min_purchase) {
        continue;
      }

      let discountAmount = 0;
      if (d.type === 'PERCENT') {
        discountAmount = roundToTwoDecimals(line.subtotal * (Number(d.value) / 100));
      } else if (d.type === 'FIXED') {
        discountAmount = roundToTwoDecimals(Number(d.value));
      }

      // Cap discount at remaining subtotal for this line
      const allowable = Math.min(line.remainingAfterProductDiscount, discountAmount);
      line.productDiscount = roundToTwoDecimals(line.productDiscount + allowable);
      line.remainingAfterProductDiscount = roundToTwoDecimals(
        Math.max(0, line.subtotal - line.productDiscount)
      );
    }
  }

  // 2. Apply SUBSCRIPTION-level discounts
  const totalRemainingAfterProductDiscounts = roundToTwoDecimals(
    intermediateLines.reduce((acc, l) => acc + l.remainingAfterProductDiscount, 0)
  );

  const applicableSubscriptionDiscounts = validDiscounts.filter(
    (d) => d.applies_to === 'SUBSCRIPTION'
  );

  let totalSubscriptionDiscountToAllocate = 0;

  for (const d of applicableSubscriptionDiscounts) {
    // Check subscription-level thresholds against overall invoice subtotal and quantity
    if (d.min_quantity != null && invoiceTotalQuantity < d.min_quantity) {
      continue;
    }
    if (d.min_purchase != null && invoiceSubtotal < d.min_purchase) {
      continue;
    }

    let discountAmount = 0;
    if (d.type === 'PERCENT') {
      discountAmount = roundToTwoDecimals(
        totalRemainingAfterProductDiscounts * (Number(d.value) / 100)
      );
    } else if (d.type === 'FIXED') {
      discountAmount = roundToTwoDecimals(Number(d.value));
    }

    totalSubscriptionDiscountToAllocate = roundToTwoDecimals(
      totalSubscriptionDiscountToAllocate + discountAmount
    );
  }

  // Cap total subscription discount so overall discount never exceeds available subtotal
  totalSubscriptionDiscountToAllocate = Math.min(
    totalRemainingAfterProductDiscounts,
    totalSubscriptionDiscountToAllocate
  );

  // Distribute subscription discount across lines proportionally based on remaining subtotal
  if (totalSubscriptionDiscountToAllocate > 0 && totalRemainingAfterProductDiscounts > 0) {
    let allocatedSoFar = 0;
    let maxRemainingIdx = 0;
    let maxRemainingVal = -1;

    intermediateLines.forEach((line, idx) => {
      if (line.remainingAfterProductDiscount > maxRemainingVal) {
        maxRemainingVal = line.remainingAfterProductDiscount;
        maxRemainingIdx = idx;
      }

      const proportion = line.remainingAfterProductDiscount / totalRemainingAfterProductDiscounts;
      const share = roundToTwoDecimals(totalSubscriptionDiscountToAllocate * proportion);
      const cappedShare = Math.min(line.remainingAfterProductDiscount, share);
      line.subscriptionDiscount = cappedShare;
      allocatedSoFar = roundToTwoDecimals(allocatedSoFar + cappedShare);
    });

    // Clean up any 1-cent rounding difference on the line with the largest remaining amount
    const difference = roundToTwoDecimals(totalSubscriptionDiscountToAllocate - allocatedSoFar);
    if (Math.abs(difference) > 0 && intermediateLines[maxRemainingIdx]) {
      const candidate = roundToTwoDecimals(
        intermediateLines[maxRemainingIdx].subscriptionDiscount + difference
      );
      if (candidate <= intermediateLines[maxRemainingIdx].remainingAfterProductDiscount && candidate >= 0) {
        intermediateLines[maxRemainingIdx].subscriptionDiscount = candidate;
      }
    }
  }

  // 3. Compute Line Totals, Taxes, and Taxable Amounts
  // Discount applies BEFORE tax
  const calculatedLines: CalculatedLineTotal[] = intermediateLines.map((line) => {
    line.totalDiscount = roundToTwoDecimals(line.productDiscount + line.subscriptionDiscount);
    line.taxableAmount = Math.max(0, roundToTwoDecimals(line.subtotal - line.totalDiscount));

    let taxRatePercent = 0;
    let taxAmount = 0;

    if (line.input.tax_id != null) {
      const tax = taxMap.get(Number(line.input.tax_id));
      if (tax && tax.active) {
        taxRatePercent = Number(tax.rate_percent) || 0;
        taxAmount = roundToTwoDecimals(line.taxableAmount * (taxRatePercent / 100));
      }
    }

    line.taxRatePercent = taxRatePercent;
    line.taxAmount = taxAmount;
    line.total = roundToTwoDecimals(line.taxableAmount + taxAmount);

    return {
      lineId: line.input.id,
      productId: line.input.product_id,
      product_id: line.input.product_id,
      description: line.input.description,
      quantity: Number(line.input.quantity) || 0,
      unitPrice: Number(line.input.unit_price) || 0,
      unit_price: Number(line.input.unit_price) || 0,
      subtotal: line.subtotal,
      discountAmount: line.totalDiscount,
      discount_amount: line.totalDiscount,
      taxableAmount: line.taxableAmount,
      taxRatePercent,
      taxAmount,
      tax_amount: taxAmount,
      total: line.total,
    };
  });

  // 4. Overall Invoice Totals
  const subtotal = invoiceSubtotal;
  const discountTotal = roundToTwoDecimals(
    calculatedLines.reduce((acc, l) => acc + l.discountAmount, 0)
  );
  const taxTotal = roundToTwoDecimals(
    calculatedLines.reduce((acc, l) => acc + l.taxAmount, 0)
  );

  // Total must NEVER be negative
  const rawTotal = roundToTwoDecimals(subtotal - discountTotal + taxTotal);
  const total = Math.max(0, rawTotal);

  return {
    lines: calculatedLines,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    discount_total: discountTotal,
    tax_total: taxTotal,
  };
}
