import { FileText } from "lucide-react";
import LegalPageLayout from "../components/ui/LegalPageLayout";

const sections = [
  {
    id: "agreement",
    title: "Agreement and Scope",
    content: "These Terms govern your access to and use of BitBlock, including our web app, cloud compilation, machine-learning tooling, and related services. By using BitBlock, you agree to these Terms.",
  },
  {
    id: "eligibility",
    title: "Eligibility and Accounts",
    content: "You must provide accurate account information and keep your login credentials secure. You are responsible for activity under your account. You may not create accounts for abuse, fraud, or unlawful use.",
  },
  {
    id: "open-source-nature",
    title: "Free and Open Source",
    content: "BitBlock is provided as a free and open-source platform. There are no paid subscriptions, billing, or paywalls. Usage limits (e.g., compiles, training jobs, storage, execution time) may still be enforced to maintain platform reliability and fairness for all users.",
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    content: "You may not use BitBlock to: (a) violate laws; (b) abuse infrastructure; (c) attempt unauthorized access; (d) upload malicious code; (e) infringe third-party rights; or (f) disrupt service quality for others. We may suspend abusive accounts.",
  },
  {
    id: "user-content",
    title: "User Content and Responsibility",
    content: "You retain ownership of your projects, datasets, and model outputs. You grant us a limited license to host/process them solely to provide the service. You are responsible for obtaining rights and consent for any data you upload, including images and biometric-like data.",
  },
  {
    id: "ai-disclaimer",
    title: "AI/ML and Hardware Disclaimer",
    content: "Model outputs may be inaccurate. You must validate results before deployment in safety-critical contexts. Firmware, flashing tools, and generated code are provided as-is and should be tested on non-critical hardware first.",
  },
  {
    id: "open-source",
    title: "Open-Source Components",
    content: "BitBlock may incorporate open-source libraries and tools. Each component retains its original license. Your use of such components is subject to the respective open-source licenses, which may include obligations such as attribution or source-code availability for modifications.",
  },
  {
    id: "availability",
    title: "Service Availability and Changes",
    content: "We may modify or discontinue features to improve reliability, security, or compliance. We aim for high availability but do not guarantee uninterrupted operation.",
  },
  {
    id: "ip",
    title: "Intellectual Property",
    content: "BitBlock software, branding, and platform assets are owned by BitBlock and protected by applicable law. No ownership is transferred to you except where explicitly stated.",
  },
  {
    id: "termination",
    title: "Termination",
    content: "We may suspend or terminate access for violations, abuse, or legal requirements. You may stop using the service anytime. Upon termination, we may retain limited records for legal, security, and accounting obligations.",
  },
  {
    id: "warranty",
    title: "Warranty Disclaimer",
    content: 'BitBlock is provided on an "as is" and "as available" basis without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.',
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    content: "To the maximum extent permitted by law, BitBlock is not liable for indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or business interruption.",
  },
  {
    id: "governing-law",
    title: "Governing Law",
    content: "These Terms are governed by the laws of your primary operating jurisdiction unless local mandatory consumer law provides otherwise.",
  },
  {
    id: "contact",
    title: "Contact",
    content: "For legal or policy questions, contact support through the official support channel listed in the app.",
  },
];

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="TERMS OF SERVICE"
      effectiveDate="April 25, 2026"
      icon={<FileText size={28} color="#B94FF0" />}
      sections={sections}
      currentPath="/terms"
    />
  );
}
