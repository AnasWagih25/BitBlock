import { CreditCard } from "lucide-react";
import LegalPageLayout from "../components/ui/LegalPageLayout";

const sections = [
  {
    id: "fair-refund",
    title: "Fair Refund Principle",
    content: "We want refunds to be fair to users and sustainable for the platform. If paid service failed materially or was charged incorrectly, we will make it right.",
  },
  {
    id: "eligible",
    title: "Eligible Refund Cases",
    content: (
      <>
        You may be eligible for a refund when:<br />
        • You were charged due to a clear billing error (duplicate/incorrect charge)<br />
        • A technical outage or defect substantially prevented normal paid use<br />
        • Unauthorized charge is verified by our payment provider review
      </>
    ),
  },
  {
    id: "non-refundable",
    title: "Non-Refundable Cases",
    content: (
      <>
        Refunds are generally not available for (unless required by law):<br />
        • Partial periods after voluntary cancellation<br />
        • Change of mind after normal use of paid features<br />
        • Violations of Terms resulting in suspension<br />
        • Delays/issues caused by user environment, third-party hardware, or misconfiguration outside BitBlock control
      </>
    ),
  },
  {
    id: "window",
    title: "Request Window",
    content: "Submit refund requests within 14 days of the charge date. Requests outside this window may be declined unless local law requires otherwise.",
  },
  {
    id: "how-to",
    title: "How to Request a Refund",
    content: (
      <>
        Contact support via the official support channel and include:<br />
        • Account email<br />
        • Payment date and amount<br />
        • Reason for request<br />
        • Any relevant error details or screenshots<br /><br />
        We review requests in good faith and typically respond within 5 business days.
      </>
    ),
  },
  {
    id: "method",
    title: "Refund Method and Timing",
    content: "Approved refunds are issued to the original payment method via our payment processor. Timing depends on your bank/card provider, typically 5–10 business days.",
  },
  {
    id: "cancellation",
    title: "Subscription Cancellation",
    content: "You can cancel anytime from Billing settings. Cancellation stops future renewals; access generally continues through the current paid period unless otherwise stated.",
  },
  {
    id: "chargebacks",
    title: "Chargebacks",
    content: "Before filing a chargeback, contact support so we can resolve faster. Fraudulent or abusive chargebacks may result in account restrictions.",
  },
  {
    id: "consumer-rights",
    title: "Consumer Rights",
    content: "Nothing in this policy limits rights that cannot be waived under applicable consumer law.",
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      title="REFUND POLICY"
      effectiveDate="April 25, 2026"
      icon={<CreditCard size={28} color="#B94FF0" />}
      sections={sections}
      currentPath="/refund-policy"
    />
  );
}
