$files = @(
"apps/web/index.html",
"apps/web/package.json",
"apps/web/tsconfig.json",
"apps/web/vite.config.ts",
"apps/web/tailwind.config.js",
"apps/web/postcss.config.js",
"apps/web/src/main.tsx",
"apps/web/src/App.tsx",
"apps/web/src/index.css",
"apps/web/src/theme.ts",
"apps/web/src/types.ts",
"apps/web/src/data/menus.ts",
"apps/web/src/data/mock.ts",
"apps/web/src/components/ui/Button.tsx",
"apps/web/src/components/ui/Title.tsx",
"apps/web/src/components/ui/StatCard.tsx",
"apps/web/src/components/ui/Logo.tsx",
"apps/web/src/components/layout/Header.tsx",
"apps/web/src/components/layout/Sidebar.tsx",
"apps/web/src/components/layout/MobileNav.tsx",
"apps/web/src/components/feed/FeedTabs.tsx",
"apps/web/src/components/feed/PostCard.tsx",
"apps/web/src/components/feed/ActivityFeed.tsx",
"apps/web/src/components/feed/MediaGallery.tsx",
"apps/web/src/components/planner/Composer.tsx",
"apps/web/src/pages/NewsPage.tsx",
"apps/web/src/pages/PlannerPage.tsx",
"apps/web/src/pages/StatsPage.tsx",
"apps/web/src/pages/ConnectionsPage.tsx",
"apps/web/src/pages/PlaceholderPage.tsx"
)

foreach ($file in $files) {
    $dir = Split-Path $file -Parent
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    New-Item -ItemType File -Force -Path $file | Out-Null
}

Write-Host "Structure créée avec succès !"