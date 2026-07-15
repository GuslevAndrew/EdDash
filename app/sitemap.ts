import type { MetadataRoute } from "next";

const baseUrl = "https://eddash.info";
const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9
    },
    {
      url: `${baseUrl}/institutions`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: `${baseUrl}/specialities`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7
    },
    {
      url: `${baseUrl}/testing-center`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6
    }
  ];
}
