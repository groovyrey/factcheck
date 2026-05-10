import type { ComponentType } from "react";
import { Globe } from "lucide-react";
import type { SearchEngineId } from "./types";

type IconProps = { className?: string };

const GoogleIcon: ComponentType<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
  </svg>
);

const BingIcon: ComponentType<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13.2 2.5 5.5 8.1v13.4l8.5-4.4 7.5-3.3V2.5l-8.3 0z" />
  </svg>
);

const BaiduIcon: ComponentType<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.28 2C6.98 2 2.68 6.3 2.68 11.6c0 5.3 4.3 9.6 9.6 9.6 5.3 0 9.6-4.3 9.6-9.6C21.88 6.3 17.58 2 12.28 2zm3.3 12.8c-0.6 0.6-1.5 1.1-2.4 1.2-1.3 0.2-2.7-0.1-3.6-1.1-0.9-1-1.1-2.4-0.6-3.7 0.5-1.3 1.8-2.1 3.2-2 1.3 0.1 2.3 0.9 2.7 2.1 0.1 0.4 0.1 0.8 0 1.2-0.1 0.4-0.3 0.7-0.5 1-0.8 0.9-1.9 1.1-2.8 0.9-0.9-0.2-1.6-0.8-1.8-1.7-0.2-0.9 0.1-1.9 0.8-2.5 0.7-0.6 1.7-0.8 2.6-0.6 0.9 0.2 1.6 0.8 1.9 1.6 0.2 0.5 0.2 1 0.1 1.5l-0.3 0.5z" />
  </svg>
);

const ScholarIcon: ComponentType<IconProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zM5.63 11.09 12 14.6l6.37-3.51L12 7.59l-6.37 3.5z" />
  </svg>
);

export type SearchEngineOption = {
  id: SearchEngineId;
  name: string;
  icon: ComponentType<{ className?: string }>;
};

export const SEARCH_ENGINES: SearchEngineOption[] = [
  { id: "langsearch", name: "Lang Search (Web)", icon: Globe },
  { id: "google", name: "Google Search (SerpApi)", icon: GoogleIcon },
  { id: "google_scholar", name: "Google Scholar (SerpApi)", icon: ScholarIcon },
  { id: "bing", name: "Bing Search (SerpApi)", icon: BingIcon },
  { id: "baidu", name: "Baidu Search (SerpApi)", icon: BaiduIcon },
];
