import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUsage } from "../hooks/useUsage";
import { PLANS, getSuggestedUpgradePlan } from "../lib/plans";
import { Zap, ArrowUpRight } from "lucide-react";

export default function PlanLimitBanner({
  fullBleed = false,
  squareTop = false,
}: {
  fullBleed?: boolean;
  squareTop?: boolean;
}) {
  const { user, userPlan, isBetaMode } = useAuth();
  const { canCompile, canStartTraining, compileBlockReason, trainingBlockReason } = useUsage(user?.uid, userPlan, isBetaMode);

  if (!user || (canCompile && canStartTraining)) return null;
  const current = (userPlan || "free") as keyof typeof PLANS;
  const suggested = getSuggestedUpgradePlan(current);

  const reasons = [!canCompile ? compileBlockReason : null, !canStartTraining ? trainingBlockReason : null]
    .filter(Boolean) as string[];
  const reasonText = reasons.join(" ");

  return (
    <div
      style={{
        marginBottom: 0,
        width: fullBleed ? "calc(100% + 32px)" : "100%",
        maxWidth: fullBleed ? "none" : "100%",
        marginLeft: fullBleed ? "-16px" : 0,
        marginRight: fullBleed ? "-16px" : 0,
        borderRadius: squareTop ? "0 0 12px 12px" : 12,
        border: "1px solid rgba(157,39,222,0.35)",
        background: "linear-gradient(135deg, rgba(157,39,222,0.12) 0%, rgba(245,158,11,0.1) 50%, rgba(157,39,222,0.08) 100%)",
        color: "#F2F2F0",
        fontSize: 13,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        writingMode: "horizontal-tb",
        position: "relative",
        overflow: "hidden",
        animation: "limitPulse 3s ease-in-out infinite",
      }}
    >
      {/* Shimmer overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(90deg, transparent 0%, rgba(157,39,222,0.06) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 3s ease-in-out infinite",
      }} />

      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "1 1 320px", minWidth: 220, position: "relative", zIndex: 1 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(157,39,222,0.2))",
          border: "1px solid rgba(245,158,11,0.3)",
        }}>
          <Zap size={14} color="#FDE68A" />
        </span>
        <span style={{ lineHeight: 1.4, whiteSpace: "normal", wordBreak: "normal", overflowWrap: "anywhere", fontWeight: 500 }}>
          {reasonText || "Plan usage limit reached."}
        </span>
      </span>

      <Link
        to="/billing"
        className="btn-primary"
        style={{
          fontSize: 11,
          padding: "6px 14px",
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(157,39,222,0.3)",
        }}
      >
        {suggested ? `Upgrade to ${PLANS[suggested].name}` : "Manage billing"}
        <ArrowUpRight size={12} />
      </Link>

      <style>{`
        @keyframes limitPulse {
          0%, 100% { border-color: rgba(157,39,222,0.35); }
          50% { border-color: rgba(245,158,11,0.45); }
        }
      `}</style>
    </div>
  );
}
