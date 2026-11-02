// Fixed categorical evidence only. Never include XML, tag names supplied by the
// vendor, identifiers, amounts, dates, actor/request metadata or error text.
const shapes = ["absent", "self_closed", "self_closed_nil", "paired", "unclosed", "multiple"] as const;
type MarkupShape = typeof shapes[number];
export interface BillingResponseShape {
  expected: MarkupShape | "unknown"; versioned: MarkupShape | "unknown";
  encoded: boolean; successStatus: "explicit" | "implicit" | "unknown";
}
export function billingResponseShape(xml: string, status?: string): BillingResponseShape {
  const markup = xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g, "");
  const shape = (name: "VisitBillInfo" | "VisitBillInfoV2"): MarkupShape => {
    const prefix = "(?:[A-Za-z_][\\w.-]*:)?", openings = [...markup.matchAll(new RegExp(`<${prefix}${name}(?=[\\s/>])[^>]*>`, "gi"))];
    if (!openings.length) return "absent";
    if (openings.length > 1) return "multiple";
    if (/\/\s*>$/.test(openings[0]![0])) return /\s(?:[A-Za-z_][\w.-]*:)?nil\s*=\s*(["'])\s*(?:true|1)\s*\1/i.test(openings[0]![0]) ? "self_closed_nil" : "self_closed";
    return new RegExp(`</${prefix}${name}\\s*>`, "i").test(markup) ? "paired" : "unclosed";
  };
  return { expected: shape("VisitBillInfo"), versioned: shape("VisitBillInfoV2"),
    encoded: /(?:&lt;|&#0*60;|&#x0*3c;)(?:[A-Za-z_][\w.-]*:)?VisitBillInfo(?:V2)?(?:\s|&gt;|&#0*62;|&#x0*3e;)/i.test(markup),
    successStatus: status && /^(success|succeeded|ok)$/i.test(status.trim()) ? "explicit" : "implicit" };
}
export function safeBillingShape(value: BillingResponseShape | undefined): BillingResponseShape {
  const allowed = (shape: unknown) => shapes.includes(shape as MarkupShape) ? shape as MarkupShape : "unknown";
  return { expected: allowed(value?.expected), versioned: allowed(value?.versioned), encoded: value?.encoded === true,
    successStatus: value?.successStatus === "explicit" || value?.successStatus === "implicit" ? value.successStatus : "unknown" };
}
