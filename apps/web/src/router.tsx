import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import { LandingPage } from "@/pages/marketing/LandingPage";
import { TermsPage } from "@/pages/marketing/TermsPage";
import { PrivacyPage } from "@/pages/marketing/PrivacyPage";
import { GuidePage } from "@/pages/marketing/GuidePage";
import { LoginPage } from "@/components/auth/LoginPage";
import { RegisterPage } from "@/components/auth/RegisterPage";
import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/components/auth/ResetPasswordPage";

import { PlannerPage } from "@/pages/app/PlannerPage";
import { LivePage } from "@/pages/app/LivePage";
import { LeadsPage } from "@/pages/app/LeadsPage";
import { StatsPage } from "@/pages/app/StatsPage";
import { ConnectionsPage } from "@/pages/app/ConnectionsPage";
import { AutomationPage } from "@/pages/app/AutomationPage";
import { SettingsPage } from "@/pages/app/SettingsPage";
import { WorkspacePage } from "@/pages/app/WorkspacePage";
import { PlaceholderPage } from "@/pages/app/PlaceholderPage";
import { DefaultPageRedirect } from "@/components/layout/DefaultPageRedirect";
import { HubRedirect } from "@/components/layout/HubRedirect";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/cgu", element: <TermsPage /> },
  { path: "/confidentialite", element: <PrivacyPage /> },
  { path: "/guide", element: <GuidePage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/app",
        element: <AppLayout />,
        children: [
          { index: true, element: <DefaultPageRedirect /> },
          { path: "gestion", element: <WorkspacePage /> },
          // Anciennes pages, désormais onglets de Gestion
          { path: "actualites", element: <HubRedirect tab={0} /> },
          { path: "planifier", element: <PlannerPage /> },
          { path: "lives", element: <LivePage /> },
          { path: "leads", element: <LeadsPage /> },
          { path: "statistiques", element: <StatsPage /> },
          { path: "connexions", element: <ConnectionsPage /> },
          { path: "messages", element: <HubRedirect tab={2} /> },
          { path: "automatisation", element: <AutomationPage /> },
          { path: "parametres", element: <SettingsPage /> },
          { path: ":section", element: <PlaceholderPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);