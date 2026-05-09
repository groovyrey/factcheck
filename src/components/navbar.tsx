"use client";

import Link from "next/link";
import { Sparkles, FlaskConical, Search, Moon, Sun } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function Navbar() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    setTheme(initialTheme);
    
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
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
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest bg-muted px-2 py-1 rounded border whitespace-nowrap">
            Alpha v1.2.0
          </div>
        </div>
      </div>
    </header>
  );
}
