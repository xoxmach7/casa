import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CASA Pro — CRM для недвижимости",
    short_name: "CASA Pro",
    description: "CRM для риелторов и застройщиков Казахстана: клиенты, сделки, новостройки.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#141f3a",
    lang: "ru-KZ",
    icons: [{ src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" }],
  };
}
