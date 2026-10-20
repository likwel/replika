// Lance l'API et le web avec une adresse publique temporaire (tunnel Cloudflare), pour que Meta
// puisse télécharger les photos (Gescom, publications programmées). L'adresse change à chaque
// lancement : elle est passée à l'API via PUBLIC_API_URL, sans toucher à apps/api/.env.
// Remplace `npm run dev` : les deux ne peuvent pas tourner en même temps (même port).
import { spawn } from "node:child_process";
import net from "node:net";

const API_PORT = Number(process.env.PORT ?? 4000);
// Sous-domaine aléatoire en mots séparés par des tirets ; écarte api.trycloudflare.com (service du tunnel)
const URL_PATTERN = /https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com/;

const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });

// Une API déjà lancée sans adresse publique répondrait à la place de la nôtre : Meta échouerait encore
if (await portInUse(API_PORT)) {
  console.error(
    `Le port ${API_PORT} est déjà utilisé : un \`npm run dev\` tourne sans doute déjà.\n` +
      `Arrêtez-le (Ctrl+C dans son terminal), puis lancez \`npm run dev:public\` à sa place.`
  );
  process.exit(1);
}

const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://localhost:${API_PORT}`], {
  stdio: ["ignore", "pipe", "pipe"],
});
let app = null;
let stopping = false;

const timer = setTimeout(() => {
  console.error("Aucune adresse publique reçue de cloudflared après 30 s : vérifiez votre connexion Internet.");
  stop(1);
}, 30_000);

// npm ne relaie pas l'arrêt à ses enfants : on arrête tout le groupe (npm, concurrently, API, web)
function stop(code) {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  tunnel.kill("SIGINT");
  process.exitCode = code;
  if (!app) return;
  try {
    process.kill(-app.pid, "SIGINT");
  } catch {
    // groupe déjà arrêté
  }
  setTimeout(() => {
    try {
      process.kill(-app.pid, "SIGKILL");
    } catch {
      // groupe déjà arrêté
    }
    process.exit(code);
  }, 5000).unref();
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

tunnel.on("error", (e) => {
  console.error(
    e.code === "ENOENT"
      ? "cloudflared introuvable : installez-le (https://github.com/cloudflare/cloudflared/releases) puis relancez."
      : `Tunnel impossible : ${e.message}`
  );
  stop(1);
});

// La sortie du tunnel est toujours lue (sinon cloudflared se bloque), mais n'est pas affichée
function onTunnelOutput(chunk) {
  if (app || stopping) return;
  const url = chunk.toString().match(URL_PATTERN)?.[0];
  if (!url) return;
  clearTimeout(timer);
  console.log(`\n🌍 API publique : ${url}\n   Meta peut télécharger les photos tant que cette commande tourne (Ctrl+C pour arrêter).\n`);
  app = spawn("npm", ["run", "dev"], { stdio: "inherit", detached: true, env: { ...process.env, PUBLIC_API_URL: url } });
  app.on("exit", (code) => stop(code ?? 0));
}
tunnel.stdout.on("data", onTunnelOutput);
tunnel.stderr.on("data", onTunnelOutput);

tunnel.on("exit", (code) => {
  if (!stopping) console.error("Le tunnel s'est fermé : relancez `npm run dev:public`.");
  stop(code ?? 1);
});
