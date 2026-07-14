import { Sunrise, Wind, Dumbbell, BatteryCharging, Utensils, Moon, Clock, HeartPulse, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GuidanceCard, GuidanceCategory } from '../../content/guidance-types';

const CATEGORY_ICON: Record<GuidanceCategory, LucideIcon> = {
  'pre-run': Sunrise,
  'post-run': Wind,
  supplementary: Dumbbell,
  recovery: BatteryCharging,
  eat: Utensils,
  sleep: Moon,
  time: Clock,
  'readiness-edu': HeartPulse,
  'safety-disclaimer': ShieldAlert,
};

const BOOK_LABEL: Record<string, string> = {
  CH3: 'Ch3', CH4: 'Ch4', CH5: 'Ch5', CH6: 'Ch6', CH7: 'Ch7', CH8: 'Ch8', CH9: 'Ch9',
};

const COMPACT_LIMIT = 2;

interface GuidanceCardListProps {
  cards: GuidanceCard[];
  /** Condenses to the top cards on compact (Journal) rendering; full list on prominent (Dashboard). */
  compact?: boolean;
}

/**
 * Renders the guidance cards selected by select-guidance-cards.ts — pre/post-run,
 * bài bổ trợ, R.E.S.T (REST day), readiness-education — below the recommendation.
 * The safety-disclaimer card always renders in full (never condensed away).
 *
 * XSS discipline: every field is a static Vietnamese literal from src/content/ —
 * no user input reaches this component, no dangerouslySetInnerHTML. Citation
 * links use rel="noopener noreferrer" per phase-02 Security Considerations.
 */
export default function GuidanceCardList({ cards, compact = false }: GuidanceCardListProps) {
  if (cards.length === 0) return null;

  const disclaimer = cards.find((c) => c.category === 'safety-disclaimer');
  const content = cards.filter((c) => c.category !== 'safety-disclaimer');
  const visible = compact ? content.slice(0, COMPACT_LIMIT) : content;
  const hiddenCount = content.length - visible.length;

  return (
    <div className="space-y-2 pt-2 border-t border-white/10">
      {visible.map((card) => {
        const Icon = CATEGORY_ICON[card.category];
        return (
          <div key={card.id} className="bg-white/5 border border-white/10 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-maf-violet shrink-0" />
              <p className="text-[12px] font-bold text-white">{card.title}</p>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{card.body}</p>
            <p className="text-[10px] text-slate-500">
              {card.citation.url ? (
                <a
                  href={card.citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-maf-violet underline underline-offset-2"
                >
                  {card.citation.label}
                </a>
              ) : (
                card.citation.label
              )}
              {card.citation.bookRef && <span> · {BOOK_LABEL[card.citation.bookRef]}</span>}
            </p>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <p className="text-[10px] text-slate-500 italic">+{hiddenCount} nội dung khác trên bản đầy đủ</p>
      )}

      {disclaimer && <p className="text-[10px] text-slate-500 italic pt-1">{disclaimer.body}</p>}
    </div>
  );
}
