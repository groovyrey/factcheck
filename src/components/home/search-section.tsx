"use client";

import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SearchEngineId } from "./types";
import { SEARCH_ENGINES } from "./search-engines";

export function SearchSection(props: {
  query: string;
  onQueryChange: (next: string) => void;
  engine: SearchEngineId;
  onEngineChange: (next: SearchEngineId) => void;
  loading: boolean;
  error: string | null;
  notices?: string[];
  onSearch: () => void;
}) {
  const { query, onQueryChange, engine, onEngineChange, loading, error, notices, onSearch } =
    props;

  const selectedEngine = SEARCH_ENGINES.find((e) => e.id === engine);
  const SelectedIcon = selectedEngine?.icon ?? Search;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground">Find what you need.</p>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Enter search term..."
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="bg-muted/30 h-10 sm:h-12"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="flex-1 md:w-64">
              <Select value={engine} onValueChange={(v) => onEngineChange(v as SearchEngineId)}>
                <SelectTrigger className="bg-muted/30 h-10 sm:h-12">
                  <SelectValue placeholder="Engine">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <SelectedIcon className="size-3.5 shrink-0" />
                      <span className="truncate">{selectedEngine?.name ?? "Engine"}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SEARCH_ENGINES.map((eng) => (
                    <SelectItem key={eng.id} value={eng.id}>
                      <div className="flex items-center gap-2">
                        <eng.icon className="size-3.5" />
                        <span>{eng.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={onSearch}
              disabled={loading || !query.trim()}
              size="lg"
              className="h-10 sm:h-12 px-6"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Go"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {notices && notices.length > 0 && (
        <div className="space-y-2">
          {notices.map((n, i) => (
            <div
              key={i}
              className="bg-muted/40 border rounded-md p-3 text-sm text-muted-foreground"
            >
              {n}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
