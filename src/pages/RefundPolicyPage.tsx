import { CreditCard } from "lucide-react";
import LegalPageLayout from "../components/ui/LegalPageLayout";

const sections = [
  {
    id: "open-source",
    title: "Open Source Platform",
    content: "BitBlock is a completely free and open-source platform. We do not charge for any services, features, or limits on our core platform. Therefore, there are no purchases to refund.",
  },
  {
    id: "donations",
    title: "Donations or Sponsorships",
    content: "If you choose to voluntarily donate or sponsor the BitBlock project through external platforms (like GitHub Sponsors), those transactions are governed by the refund policies of the respective platforms.",
  },
  {
    id: "marketplace",
    title: "Community Marketplace",
    content: "The BitBlock marketplace currently only hosts free, open-source community blocks. No transactions take place on our platform.",
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
