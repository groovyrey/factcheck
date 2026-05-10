"use client";

import { ExternalLink, Globe, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { SearchResult } from "./types";

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function SourceModal(props: {
  result: SearchResult;
  onClose: () => void;
}) {
  const { result, onClose } = props;
  const canEmbed = isSafeHttpUrl(result.url);
  const canOpen = isSafeHttpUrl(result.url);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full h-full max-w-7xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1 min-w-0 pr-4">
            <CardTitle className="text-sm sm:text-base truncate">{result.name}</CardTitle>
            <CardDescription className="text-xs truncate flex items-center gap-1.5">
              <Globe className="size-3" />
              {result.url}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex"
              onClick={() => window.open(result.url, "_blank")}
              disabled={!canOpen}
            >
              <ExternalLink className="size-3 mr-2" />
              Source
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="size-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 bg-muted/5">
          {canEmbed ? (
            <iframe
              src={result.url}
              className="w-full h-full border-none"
              title={result.name}
              // Keep the iframe sandboxed: embed is best-effort, user can always open the source in a new tab.
              sandbox="allow-scripts allow-forms"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                This URL can’t be embedded. Open it in a new tab instead.
              </p>
              <Button onClick={() => window.open(result.url, "_blank")} disabled={!canOpen}>
                <ExternalLink className="size-4 mr-2" />
                Open Source
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
