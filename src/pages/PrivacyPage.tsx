import { Shield } from "lucide-react";
import LegalPageLayout from "../components/ui/LegalPageLayout";

const sections = [
  {
    id: "overview",
    title: "Overview",
    content: "This Privacy Policy explains what information BitBlock collects, how we use it, and your choices. We design BitBlock to collect only what is needed to provide reliable accounts, compilation, and ML services.",
  },
  {
    id: "info-collected",
    title: "Information We Collect",
    content: (
      <>
        <strong>Account data:</strong> email, display name, profile photo, role, usage counters.<br />
        <strong>Project data:</strong> code/blocks, project metadata, model artifacts, datasets you upload.<br />
        <strong>Operational data:</strong> logs, error traces, request metadata needed for security and abuse prevention.<br />
        <strong>Device data:</strong> browser type, operating system, screen resolution, and IP address collected automatically for security and analytics.
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How We Use Data",
    content: "We use data to: (a) operate your account, (b) enforce plan limits, (c) compile firmware and train models, (d) secure the platform, (e) improve product quality, and (f) meet legal obligations.",
  },
  {
    id: "legal-basis",
    title: "Legal Basis",
    content: "Depending on jurisdiction, we process data under contract performance, legitimate interests (security/reliability), consent (when required), and legal compliance.",
  },
  {
    id: "data-sharing",
    title: "Data Sharing",
    content: "We share data only with trusted processors needed to deliver the service (hosting, storage, authentication, payment, analytics/security tooling). We do not sell personal data.",
  },
  {
    id: "international",
    title: "International Transfers",
    content: "Your data may be processed in regions where our providers operate. We use appropriate safeguards where required by law, including standard contractual clauses where applicable.",
  },
  {
    id: "retention",
    title: "Data Retention",
    content: "We keep account records while your account is active and for a limited period afterward as required for security, fraud prevention, and legal compliance. Project data is deleted upon account deletion unless required by law.",
  },
  {
    id: "your-rights",
    title: "Your Rights",
    content: "Subject to local law, you may request access, correction, deletion, portability, and objection/restriction for certain processing. You can update most profile data directly in-app. To exercise data rights not available in-app, contact support.",
  },
  {
    id: "security",
    title: "Security",
    content: "We apply technical and organizational safeguards including encrypted storage, secure authentication via Firebase, and access controls. No system is 100% secure. You should protect your credentials and use strong authentication practices.",
  },
  {
    id: "children",
    title: "Children's Privacy",
    content: "BitBlock is not directed to children under the age of 13 (or the minimum age required by applicable law). If you believe a child submitted data improperly, contact support and we will promptly delete it.",
  },
  {
    id: "cookies",
    title: "Cookies and Local Storage",
    content: "We use browser local storage and session cookies for authentication state, UX preferences, and security/session functionality. We do not use third-party advertising cookies. Analytics cookies, if used, are limited to aggregate usage metrics.",
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content: "We may update this policy as the product evolves. Material changes will be communicated in-app or via account notices where appropriate. Continued use after changes constitutes acceptance.",
  },
  {
    id: "contact",
    title: "Contact",
    content: "For privacy questions or rights requests, contact support through the official support channel in the app.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="PRIVACY POLICY"
      effectiveDate="April 25, 2026"
      icon={<Shield size={28} color="#B94FF0" />}
      sections={sections}
      currentPath="/privacy"
    />
  );
}
