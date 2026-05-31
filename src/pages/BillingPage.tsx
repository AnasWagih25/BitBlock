import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Billing page is no longer needed — BitBlock is free and open-source.
 * Redirect to profile page where users can view their usage and limits.
 */
export default function BillingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/profile", { replace: true });
  }, [navigate]);

  return null;
}
