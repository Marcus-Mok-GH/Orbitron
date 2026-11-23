import type { Request, Response } from "express";
import { createOrbitronApp } from "../server/app";

let appPromise: Promise<import("express").Express> | null = null;

function getApp() {
  if (!appPromise) {
    appPromise = createOrbitronApp();
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  return app(req, res);
}
