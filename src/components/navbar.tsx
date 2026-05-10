"use client";

import Link from "next/link";
import { Sparkles, FlaskConical, Search, Moon, Sun } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export function Navbar() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initialTheme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : systemPrefersDark
          ? "dark"
          : "light";

    applyTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
      <div className="container mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Sparkles className="size-5 text-primary" />
            <span className="font-bold tracking-tight text-lg">SourceCheck</span>
          </Link>
          
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link 
              href="/" 
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 px-2 sm:px-3")}
            >
              <Search className="size-4" />
              <span className="text-xs sm:text-sm">Research</span>
            </Link>
            <Link 
              href="/test" 
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 px-2 sm:px-3")}
            >
              <FlaskConical className="size-4" />
              <span className="text-xs sm:text-sm">Labs</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            <Moon className="size-4 dark:hidden" />
            <Sun className="size-4 hidden dark:block" />
          </Button>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted px-2 py-1 rounded border whitespace-nowrap">
            Alpha v1.2.0
          </div>
        </div>
      </div>
    </header>
  );
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
