"use client";

import { ExternalLink, Globe } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SearchResult } from "./types";

function safeHostname(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    return u.hostname || null;
  } catch {
    return null;
  }
}

export function ResultsGrid(props: {
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
}) {
  const { results, onSelect } = props;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Search Results
        </h2>
        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-bold text-muted-foreground">
          {results.length} NODES
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((res, i) => {
          const hostname = safeHostname(res.url);
          return (
            <Card
              key={`${res.url}-${i}`}
              className="hover:border-primary/50 transition-colors shadow-none flex flex-col h-full cursor-pointer group relative pt-4"
              onClick={() => onSelect(res)}
            >
              <div className="absolute top-0 left-4 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10">
                SOURCE {i + 1}
              </div>
              <CardHeader className="p-4 pb-2">
                <div className="font-bold text-sm leading-tight group-hover:text-primary flex items-start justify-between gap-2">
                  <span className="flex-1 line-clamp-2">{res.name}</span>
                  {res.url ? (
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-1 hover:bg-muted rounded-md transition-colors flex items-center gap-1.5 border border-transparent hover:border-border"
                      title="Open in new tab"
                    >
                      <ExternalLink className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        Source
                      </span>
                    </a>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-1 flex flex-col justify-between">
                <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                  {res.snippet}
                </p>
                {hostname && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase truncate border-t pt-2 mt-auto">
                    <Globe className="size-2.5" />
                    <span className="opacity-50">Source:</span>
                    <span className="hover:text-primary transition-colors flex items-center gap-1">
                      {hostname}
                      <ExternalLink className="size-2 opacity-50" />
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

