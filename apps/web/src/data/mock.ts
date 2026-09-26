import type { Post, ScheduledPost } from "@/types";

const PAGES = [
  { plat: "fb" as const, page: "Boutique Tana" },
  { plat: "ig" as const, page: "@maboutique" },
  { plat: "fb" as const, page: "Artisanat Mada" },
  { plat: "ig" as const, page: "@craft.mg" },
];

const TEXTS: Record<string, string[]> = {
  shop: ["Nouvelle collection de sacs en raphia 🇲🇬", "Bijoux artisanaux faits main", "Sac à main cuir véritable, plusieurs coloris", "Robe traditionnelle revisitée, édition limitée", "Chapeaux de paille tressés à la main"],
  event: ["Vente exceptionnelle ce samedi à Analakely 🎉", "Pop-up store au centre-ville ce week-end", "Atelier découverte vannerie dimanche", "Marché artisanal mensuel — venez nombreux"],
  reels: ["Découvrez notre atelier en vidéo 🎥", "Tuto : entretenir votre sac en raphia", "Behind the scenes du shooting", "Les étapes de fabrication d'un panier"],
  lives: ["Live shopping en cours — prix cassés !", "Vente flash en direct maintenant", "Présentation nouveautés en live"],
};

const PRICES = ["85 000 Ar", "45 000 Ar", "120 000 Ar", "150 000 Ar", "20 000 Ar", null];

export function makePosts(kind: string, count: number, seedOffset = 0): Post[] {
  const arr: Post[] = [];
  const types = kind === "all" ? ["shop", "event", "reels", "lives"] : [kind];
  for (let i = 0; i < count; i++) {
    const t = types[i % types.length] as Post["kind"];
    const pg = PAGES[(i + seedOffset) % PAGES.length];
    const seed = i + seedOffset + 1;
    const isVideo = t === "reels" || t === "lives";
    arr.push({
      id: `${kind}-${seed}`,
      plat: pg.plat,
      page: pg.page,
      time: t === "lives" ? "EN DIRECT" : `il y a ${(seed % 12) + 1} h`,
      live: t === "lives",
      kind: t,
      text: TEXTS[t][i % TEXTS[t].length],
      img: `https://picsum.photos/seed/replyka${seed}/640/400`,
      isVideo,
      price: t === "shop" ? PRICES[i % (PRICES.length - 1)] : t === "lives" ? "dès 20 000 Ar" : null,
      reactions: 50 + ((seed * 37) % 1200),
      comments: 5 + ((seed * 13) % 200),
      shares: (seed * 7) % 80,
      leads: (seed * 3) % 25,
    });
  }
  return arr;
}

export const SCHEDULED: Record<number, ScheduledPost[]> = {
  3: [{ plat: "fb", time: "09:00", text: "Nouvelle collection raphia", st: "scheduled" }],
  8: [{ plat: "ig", time: "14:30", text: "Promo bijoux flash", st: "scheduled" }, { plat: "fb", time: "18:00", text: "Live shopping ce soir", st: "draft" }],
  12: [{ plat: "ig", time: "11:00", text: "Reel atelier", st: "scheduled" }],
  17: [{ plat: "fb", time: "10:00", text: "Vente Analakely samedi", st: "scheduled" }],
  21: [{ plat: "ig", time: "16:00", text: "Shooting collection", st: "draft" }],
  25: [{ plat: "fb", time: "08:30", text: "Robe traditionnelle édition limitée", st: "scheduled" }],
};