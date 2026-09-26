import { MessageCircle, Mail, Users, Bot } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { StatCard } from "@/components/ui/StatCard";

const bars = [
  { d: "Lun", fb: 60, ig: 40 }, { d: "Mar", fb: 80, ig: 55 }, { d: "Mer", fb: 45, ig: 70 },
  { d: "Jeu", fb: 90, ig: 50 }, { d: "Ven", fb: 70, ig: 85 }, { d: "Sam", fb: 100, ig: 75 }, { d: "Dim", fb: 55, ig: 60 },
];

const rates = [
  { l: "Réponses automatiques", v: 78, c: theme.gold },
  { l: "Réponses manuelles", v: 16, c: theme.red },
  { l: "En attente", v: 6, c: theme.textMuted },
];

export function StatsPage() {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <StatCard icon={MessageCircle} label="Commentaires" value="1 248" trend="+12%" color={theme.gold} />
        <StatCard icon={Mail} label="Messages" value="384" trend="+8%" color={theme.redLight} />
        <StatCard icon={Users} label="Leads détectés" value="56" trend="+23%" color={theme.gold} />
        <StatCard icon={Bot} label="Réponses IA" value="142" trend="+34%" color={theme.redLight} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 rounded-2xl p-4 sm:p-5 overflow-x-auto" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <Title className="text-base">Engagement Hebdomadaire</Title>
            <div className="flex items-center gap-3 text-xs" style={{ color: theme.textMuted }}>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: theme.gold }} />Facebook</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: theme.red }} />Instagram</span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 sm:gap-3 h-48 min-w-[300px]">
            {bars.map((b) => (
              <div key={b.d} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex items-end gap-1 w-full justify-center h-full">
                  <div className="w-1/2 rounded-t-md" style={{ height: `${b.fb}%`, background: theme.gold }} />
                  <div className="w-1/2 rounded-t-md" style={{ height: `${b.ig}%`, background: theme.red }} />
                </div>
                <span className="text-[11px]" style={{ color: theme.textMuted }}>{b.d}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <Title className="text-base mb-4">Taux de Réponse</Title>
          {rates.map((r) => (
            <div key={r.l} className="mb-4">
              <div className="flex justify-between text-sm mb-1.5"><span style={{ color: theme.text }}>{r.l}</span><span className="font-semibold" style={{ color: r.c }}>{r.v}%</span></div>
              <div className="h-2 rounded-full" style={{ background: theme.bg }}><div className="h-full rounded-full" style={{ width: `${r.v}%`, background: r.c }} /></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}