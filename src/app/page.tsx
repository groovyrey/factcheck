import {
  BadgeCheck,
  Sparkles,
} from "lucide-react";

import { FacebookPostImporter } from "@/components/import/facebook-post-importer";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BadgeCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-heading text-sm font-semibold leading-none">
                SourceCheck
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Social post verification
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
            <Button variant="ghost" size="sm">
              Queue
            </Button>
            <Button variant="ghost" size="sm">
              Reports
            </Button>
            <Button variant="outline" size="sm">
              Sign in
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-col gap-6">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-foreground" aria-hidden="true" />
              Claim review for Facebook post links
            </div>
            <h1 className="font-heading text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
              Check social posts before they spread.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Paste a public Facebook post URL, extract the available post
              content, and prepare a sourced fact-check report.
            </p>
          </div>

          <FacebookPostImporter />
        </div>
      </section>
    </main>
  );
}
