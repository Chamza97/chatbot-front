"use client";

import Image from "next/image"; // 1. Make sure Image is imported
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { MyRuntimeProvider } from "@/components/MyRuntimeProvider";

export const Assistant = () => {
  return (
    <MyRuntimeProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {/* 2. This container aligns the icon and text */}
                    <div className="flex items-center gap-2">
                      <Image
                        src="/flag-qatar.png" // 3. Ensure the path is correct
                        alt="Qatar Flag"
                        width={22}
                        height={22}
                      />
                      {/* 3. The text is now styled */}
                      <span className="text-lg font-semibold text-zinc-800">
                        بن غيث للمحاماة
                      </span>
                    </div>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <Thread />
        </SidebarInset>
      </SidebarProvider>
    </MyRuntimeProvider>
  );
};