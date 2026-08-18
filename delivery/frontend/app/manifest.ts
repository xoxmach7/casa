import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CASA Pro — CRM для недвижимости",
    short_name: "CASA Pro",
    description: "CRM для риелторов и застройщиков Казахстана: клиенты, сделки, новостройки.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#15325B",
    lang: "ru-KZ",
    icons: [
      { src: "/favicon-64.png", sizes: "64x64", type: "image/png" },
      { src: "/casa-mark-navy.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
