import type { MetadataRoute } from "next";

const origin = process.env.NEXT_PUBLIC_APP_ORIGIN
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const routes = ["", "/vote", "/predictions", "/leaderboard", "/winners", "/verify", "/tickets", "/contestants", "/loyalty", "/organizer", "/faq", "/security"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-09-02T00:00:00.000Z");
  return routes.map((route) => ({
    url: `${origin}${route}`,
    lastModified,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
