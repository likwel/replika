$files = @(
    "apps/api/package.json",
    "apps/api/tsconfig.json",
    "apps/api/.env",
    "apps/api/.env.example",

    "apps/api/prisma/schema.prisma",

    "apps/api/src/server.ts",
    "apps/api/src/app.ts",

    "apps/api/src/config/env.ts",
    "apps/api/src/config/prisma.ts",

    "apps/api/src/middlewares/auth.middleware.ts",
    "apps/api/src/middlewares/error.middleware.ts",
    "apps/api/src/middlewares/validate.middleware.ts",
    "apps/api/src/middlewares/notFound.middleware.ts",

    "apps/api/src/utils/AppError.ts",
    "apps/api/src/utils/catchAsync.ts",
    "apps/api/src/utils/jwt.ts",
    "apps/api/src/utils/password.ts",

    "apps/api/src/modules/auth/auth.routes.ts",
    "apps/api/src/modules/auth/auth.controller.ts",
    "apps/api/src/modules/auth/auth.service.ts",
    "apps/api/src/modules/auth/auth.schema.ts",

    "apps/api/src/modules/accounts/account.routes.ts",
    "apps/api/src/modules/accounts/account.controller.ts",
    "apps/api/src/modules/accounts/account.service.ts",
    "apps/api/src/modules/accounts/account.schema.ts",

    "apps/api/src/modules/messages/message.routes.ts",
    "apps/api/src/modules/messages/message.controller.ts",
    "apps/api/src/modules/messages/message.service.ts",
    "apps/api/src/modules/messages/message.schema.ts",

    "apps/api/src/modules/automation/automation.routes.ts",
    "apps/api/src/modules/automation/automation.controller.ts",
    "apps/api/src/modules/automation/automation.service.ts",
    "apps/api/src/modules/automation/automation.schema.ts",

    "apps/api/src/modules/history/history.routes.ts",
    "apps/api/src/modules/history/history.controller.ts",
    "apps/api/src/modules/history/history.service.ts",

    "apps/api/src/routes/index.ts"
)

foreach ($file in $files) {
    $directory = Split-Path $file -Parent

    if (!(Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    if (!(Test-Path $file)) {
        New-Item -ItemType File -Path $file -Force | Out-Null
    }
}

Write-Host ""
Write-Host "✅ Structure apps/api créée avec succès !" -ForegroundColor Green