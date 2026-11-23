import { createOrbitronApp } from "./app";

let appPromise: Promise<import("express").Express> | null = null;

export function getApp() {
  if (!appPromise) appPromise = createOrbitronApp({ serveStatic: false });
  return appPromise;
}

if (process.env.SERVICE_PORT) {
  getApp().then((app) => {
    app.listen(Number(process.env.SERVICE_PORT), "0.0.0.0", () => {
      console.log(`Orbitron lambda listening on ${process.env.SERVICE_PORT}`);
    });
  });
}
